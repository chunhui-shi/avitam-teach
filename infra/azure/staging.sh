#!/usr/bin/env bash
# Provision, deploy, verify, inspect, or delete the standalone Azure proof stack.
set -euo pipefail

action=${1:-status}
location=${AVITAM_AZURE_LOCATION:-westus2}
resource_group=${AVITAM_AZURE_RESOURCE_GROUP:-rg-avitam-teach-stage-westus2}
cluster=${AVITAM_AKS_CLUSTER:-aks-avitam-teach-stage}
namespace=avitam-teach
postgres_admin=avitam_admin
postgres_database=avitam_teach
storage_container=uploads

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
config_root=${XDG_CONFIG_HOME:-$HOME/.config}/avitam-teach/azure
secret_file=$config_root/staging.env
ssh_key=$config_root/id_ed25519

subscription_id=$(az account show --query id -o tsv)
tenant_id=$(az account show --query tenantId -o tsv)
suffix=$(printf '%s' "$subscription_id" | tr -d '-' | cut -c1-8)
acr=${AVITAM_AZURE_ACR:-atstage${suffix}}
storage_account=${AVITAM_AZURE_STORAGE_ACCOUNT:-atstage${suffix}}
workload_identity=${AVITAM_AZURE_IDENTITY:-id-avitam-teach-stage}

case "$resource_group" in
  rg-avitam-teach-stage-*) ;;
  *)
    echo "Refusing resource group outside the dedicated avitam-teach staging prefix: $resource_group" >&2
    exit 1
    ;;
esac

require_tools() {
  for command in az kubectl docker openssl; do
    command -v "$command" >/dev/null || { echo "$command is required" >&2; exit 1; }
  done
}

load_or_create_secrets() {
  if [[ -n ${DATABASE_PASSWORD:-} && -n ${JWT_SECRET:-} ]]; then
    return
  fi
  mkdir -p "$config_root"
  chmod 700 "$config_root"
  if [[ ! -f "$secret_file" ]]; then
    umask 077
    {
      printf 'DATABASE_PASSWORD=%s\n' "$(openssl rand -hex 24)"
      printf 'JWT_SECRET=%s\n' "$(openssl rand -hex 32)"
    } > "$secret_file"
  fi
  # shellcheck disable=SC1090
  source "$secret_file"
  : "${DATABASE_PASSWORD:?missing DATABASE_PASSWORD in $secret_file}"
  : "${JWT_SECRET:?missing JWT_SECRET in $secret_file}"
}

ensure_provider() {
  local provider=$1
  if [[ $(az provider show --namespace "$provider" --query registrationState -o tsv) != Registered ]]; then
    az provider register --namespace "$provider" --wait
  fi
}

ensure_group() {
  if [[ $(az group exists --name "$resource_group") == true ]]; then
    local project
    project=$(az group show --name "$resource_group" --query tags.project -o tsv)
    [[ $project == avitam-teach ]] || {
      echo "Refusing existing unowned resource group $resource_group" >&2
      exit 1
    }
  else
    local expires_at
    expires_at=$(date -u -d '+12 hours' +%Y-%m-%dT%H:%M:%SZ)
    az group create --name "$resource_group" --location "$location" \
      --tags project=avitam-teach environment=staging lifecycle=ephemeral \
      managed-by=azure-cli "expires-at=$expires_at" --output none
  fi
}

ensure_ssh_key() {
  if [[ ! -f $ssh_key ]]; then
    ssh-keygen -q -t ed25519 -N '' -f "$ssh_key"
  fi
}

create_infrastructure() {
  require_tools
  load_or_create_secrets
  ensure_provider Microsoft.ContainerService
  ensure_provider Microsoft.ContainerRegistry
  ensure_provider Microsoft.Storage
  ensure_provider Microsoft.ManagedIdentity
  ensure_group
  ensure_ssh_key

  if ! az acr show --resource-group "$resource_group" --name "$acr" >/dev/null 2>&1; then
    az acr create --resource-group "$resource_group" --name "$acr" \
      --location "$location" --sku Basic --admin-enabled false --output none
  fi

  if ! az storage account show --resource-group "$resource_group" --name "$storage_account" >/dev/null 2>&1; then
    az storage account create --resource-group "$resource_group" --name "$storage_account" \
      --location "$location" --sku Standard_LRS --kind StorageV2 \
      --min-tls-version TLS1_2 --allow-blob-public-access false --output none
  fi
  local storage_key
  storage_key=$(az storage account keys list --resource-group "$resource_group" \
    --account-name "$storage_account" --query '[0].value' -o tsv)
  az storage container create --account-name "$storage_account" --account-key "$storage_key" \
    --name "$storage_container" --public-access off --output none
  unset storage_key

  if ! az identity show --resource-group "$resource_group" --name "$workload_identity" >/dev/null 2>&1; then
    az identity create --resource-group "$resource_group" --name "$workload_identity" \
      --location "$location" --output none
  fi

  if ! az aks show --resource-group "$resource_group" --name "$cluster" >/dev/null 2>&1; then
    az aks create --resource-group "$resource_group" --name "$cluster" \
      --location "$location" --tier free --node-count 1 \
      --node-vm-size Standard_D2s_v6 --nodepool-name system \
      --node-osdisk-type Managed --node-osdisk-size 64 --max-pods 30 \
      --enable-managed-identity --enable-oidc-issuer --enable-workload-identity \
      --network-plugin azure --network-plugin-mode overlay \
      --pod-cidr 192.168.0.0/16 --service-cidr 10.44.0.0/16 \
      --dns-service-ip 10.44.0.10 --node-os-upgrade-channel None \
      --auto-upgrade-channel none --ssh-key-value "${ssh_key}.pub" \
      --attach-acr "$acr" \
      --tags project=avitam-teach environment=staging lifecycle=ephemeral \
      --output none
  fi

  local identity_principal storage_id storage_scope
  identity_principal=$(az identity show --resource-group "$resource_group" \
    --name "$workload_identity" --query principalId -o tsv)
  storage_id=$(az storage account show --resource-group "$resource_group" \
    --name "$storage_account" --query id -o tsv)
  storage_scope="$storage_id/blobServices/default/containers/$storage_container"
  if ! az role assignment list --assignee-object-id "$identity_principal" \
    --scope "$storage_scope" --role 'Storage Blob Data Contributor' \
    --query '[0].id' -o tsv | grep -q .; then
    az role assignment create --assignee-object-id "$identity_principal" \
      --assignee-principal-type ServicePrincipal --scope "$storage_scope" \
      --role 'Storage Blob Data Contributor' --output none
  fi

  local issuer credential_name
  issuer=$(az aks show --resource-group "$resource_group" --name "$cluster" \
    --query oidcIssuerProfile.issuerUrl -o tsv)
  credential_name=avitam-teach-aks
  if ! az identity federated-credential show --resource-group "$resource_group" \
    --identity-name "$workload_identity" --name "$credential_name" >/dev/null 2>&1; then
    az identity federated-credential create --resource-group "$resource_group" \
      --identity-name "$workload_identity" --name "$credential_name" \
      --issuer "$issuer" --subject "system:serviceaccount:$namespace:avitam-teach" \
      --audiences api://AzureADTokenExchange --output none
  fi

  az aks get-credentials --resource-group "$resource_group" --name "$cluster" \
    --overwrite-existing --output none
  echo "Standalone Azure infrastructure is ready in $resource_group."
}

render_manifest() {
  local source=$1 destination=$2 web_image=$3 worker_image=$4
  sed -e "s|WEB_IMAGE|$web_image|g" -e "s|WORKER_IMAGE|$worker_image|g" \
    "$source" > "$destination"
}

deploy_application() {
  require_tools
  load_or_create_secrets
  az aks get-credentials --resource-group "$resource_group" --name "$cluster" \
    --overwrite-existing --output none

  local tag login_server web_repo worker_repo
  tag="$(git -C "$repo_root" rev-parse --short=12 HEAD)-$(date -u +%Y%m%d%H%M%S)"
  login_server=$(az acr show --resource-group "$resource_group" --name "$acr" \
    --query loginServer -o tsv)
  web_repo="$login_server/avitam-teach-stage-web"
  worker_repo="$login_server/avitam-teach-stage-worker"
  az acr login --name "$acr" --output none
  docker build --target runner -t "$web_repo:$tag" "$repo_root/spine"
  docker build --target worker -t "$worker_repo:$tag" "$repo_root/spine"
  docker push "$web_repo:$tag"
  docker push "$worker_repo:$tag"

  local web_digest worker_digest web_image worker_image
  web_digest=$(az acr repository show --name "$acr" --image "avitam-teach-stage-web:$tag" \
    --query digest -o tsv)
  worker_digest=$(az acr repository show --name "$acr" --image "avitam-teach-stage-worker:$tag" \
    --query digest -o tsv)
  web_image="$web_repo@$web_digest"
  worker_image="$worker_repo@$worker_digest"

  local identity_client
  identity_client=$(az identity show --resource-group "$resource_group" \
    --name "$workload_identity" --query clientId -o tsv)

  kubectl create namespace "$namespace" --dry-run=client -o yaml | kubectl apply -f -
  kubectl create serviceaccount avitam-teach --namespace "$namespace" \
    --dry-run=client -o yaml | kubectl apply -f -
  kubectl annotate serviceaccount avitam-teach --namespace "$namespace" \
    "azure.workload.identity/client-id=$identity_client" --overwrite
  kubectl create configmap avitam-teach-config --namespace "$namespace" \
    --from-literal=NODE_ENV=production \
    --from-literal=DATABASE_SSL=false \
    --from-literal=PGHOST=postgres \
    --from-literal=PGPORT=5432 \
    --from-literal=PGDATABASE="$postgres_database" \
    --from-literal=STORAGE_DRIVER=azure \
    --from-literal=AZURE_STORAGE_ACCOUNT_URL="https://${storage_account}.blob.core.windows.net" \
    --from-literal=AZURE_STORAGE_CONTAINER="$storage_container" \
    --from-literal=AZURE_CLIENT_ID="$identity_client" \
    --from-literal=AZURE_TENANT_ID="$tenant_id" \
    --dry-run=client -o yaml | kubectl apply -f -
  kubectl create secret generic avitam-teach-secrets --namespace "$namespace" \
    --from-literal=PGUSER="$postgres_admin" \
    --from-literal=PGPASSWORD="$DATABASE_PASSWORD" \
    --from-literal=JWT_SECRET="$JWT_SECRET" \
    --from-literal=OPENAI_API_KEY="${OPENAI_API_KEY:-}" \
    --from-literal=ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}" \
    --dry-run=client -o yaml | kubectl apply -f -

  kubectl apply -f "$repo_root/infra/azure/k8s/database.yaml"
  kubectl rollout status statefulset/postgres --namespace "$namespace" --timeout=10m

  local render_dir
  render_dir=$(mktemp -d)
  trap 'rm -rf "$render_dir"' RETURN
  render_manifest "$repo_root/infra/azure/k8s/migration-job.yaml" \
    "$render_dir/migration-job.yaml" "$web_image" "$worker_image"
  render_manifest "$repo_root/infra/azure/k8s/workloads.yaml" \
    "$render_dir/workloads.yaml" "$web_image" "$worker_image"

  kubectl delete job avitam-teach-migration --namespace "$namespace" \
    --ignore-not-found --wait=true
  kubectl apply -f "$render_dir/migration-job.yaml"
  if ! kubectl wait --namespace "$namespace" --for=condition=complete \
    job/avitam-teach-migration --timeout=10m; then
    kubectl logs --namespace "$namespace" job/avitam-teach-migration >&2 || true
    return 1
  fi
  kubectl apply -f "$render_dir/workloads.yaml"
  kubectl rollout status deployment/web --namespace "$namespace" --timeout=10m
  kubectl rollout status deployment/worker --namespace "$namespace" --timeout=10m

  printf '%s\n' "$web_image" > "$config_root/last-web-image"
  printf '%s\n' "$worker_image" > "$config_root/last-worker-image"
  echo "Digest-pinned application images deployed after a successful migration."
}

staging_url() {
  local address
  address=$(kubectl get service web --namespace "$namespace" \
    --output jsonpath='{.status.loadBalancer.ingress[0].ip}')
  [[ -n $address ]] || return 1
  printf 'http://%s\n' "$address"
}

verify_application() {
  az aks get-credentials --resource-group "$resource_group" --name "$cluster" \
    --overwrite-existing --output none
  local url=''
  for _ in $(seq 1 60); do
    url=$(staging_url 2>/dev/null || true)
    [[ -n $url ]] && break
    sleep 5
  done
  [[ -n $url ]] || { echo 'Timed out waiting for the staging load balancer' >&2; exit 1; }
  "$repo_root/scripts/smoke-staging.sh" "$url"
  kubectl exec --namespace "$namespace" deployment/worker -- npm run smoke:azure-storage
  kubectl get pods --namespace "$namespace" -o wide
  printf 'Staging URL: %s\n' "$url"
  printf 'Revision: %s\n' "$(git -C "$repo_root" rev-parse HEAD)"
  printf 'Web image: %s\n' "$(< "$config_root/last-web-image")"
  printf 'Worker image: %s\n' "$(< "$config_root/last-worker-image")"
}

show_status() {
  az group show --name "$resource_group" \
    --query '{name:name,location:location,state:properties.provisioningState,tags:tags}' -o yaml
  az resource list --resource-group "$resource_group" \
    --query '[].{name:name,type:type,location:location}' -o table
  if az aks show --resource-group "$resource_group" --name "$cluster" >/dev/null 2>&1; then
    az aks get-credentials --resource-group "$resource_group" --name "$cluster" \
      --overwrite-existing --output none
    kubectl get nodes,pods,services --namespace "$namespace" -o wide
  fi
}

delete_stack() {
  [[ $(az group exists --name "$resource_group") == true ]] || {
    echo "$resource_group is already absent."
    return
  }
  local project
  project=$(az group show --name "$resource_group" --query tags.project -o tsv)
  [[ $project == avitam-teach ]] || {
    echo "Refusing to delete unowned resource group $resource_group" >&2
    exit 1
  }
  az group delete --name "$resource_group" --yes
  [[ $(az group exists --name "$resource_group") == false ]] || {
    echo "$resource_group still exists after deletion returned" >&2
    exit 1
  }
  echo "Deleted and verified absent: $resource_group"
}

case "$action" in
  create) create_infrastructure ;;
  deploy) deploy_application ;;
  verify) verify_application ;;
  status) show_status ;;
  all) create_infrastructure; deploy_application; verify_application ;;
  delete) delete_stack ;;
  *) echo "usage: $0 {create|deploy|verify|status|all|delete}" >&2; exit 2 ;;
esac
