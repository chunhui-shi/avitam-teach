# Azure staging runbook

This runbook creates a standalone, temporary Azure proof environment. It does
not reuse any cluster, registry, storage account, or resource group belonging
to another project. Review current Azure pricing before starting.

Use synthetic teaching data only. The preserved application still has known
production-dependency audit findings that require a separate framework
upgrade. The proof endpoint is HTTP, so do not submit credentials, API keys, or
real course material through the browser.

## Prerequisites

- Azure CLI, Docker, `kubectl`, OpenSSL, and an enabled Azure subscription.
- Permission to create a resource group, AKS cluster, managed identity, role
  assignment, ACR, Storage account, managed disk, and public IP.
- At least two available regional vCPUs for `Standard_D2s_v6`.
- Optional `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` environment variables when
  testing live RAG. They are not required for the deployment proof.

The default group is `rg-avitam-teach-stage-westus2`. Override location and
group only with the project-specific variables below. The script refuses a
group that does not begin with `rg-avitam-teach-stage-`.

```bash
export AVITAM_AZURE_LOCATION=westus2
export AVITAM_AZURE_RESOURCE_GROUP=rg-avitam-teach-stage-westus2
```

## Deploy and verify

From the repository root:

```bash
az login
infra/azure/staging.sh create
infra/azure/staging.sh deploy
infra/azure/staging.sh verify
```

The first local run creates random database and JWT secrets in
`~/.config/avitam-teach/azure/staging.env` with owner-only permissions. A CI
runner instead supplies `DATABASE_PASSWORD` and `JWT_SECRET` as environment
secrets. Secret values are never written to the repository.

`create` provisions one AKS node, ACR, Blob Storage, and a workload identity.
`deploy` builds and pushes web and worker images, resolves their digests, starts
pgvector, runs the schema and backfill job, and then releases web and worker.
`verify` checks the public health and course endpoints and performs a private
Blob round trip through federated workload identity.

Inspect the live boundary at any time:

```bash
infra/azure/staging.sh status
kubectl logs -n avitam-teach job/avitam-teach-migration
kubectl logs -n avitam-teach deployment/web
kubectl logs -n avitam-teach deployment/worker
```

Record the output of `verify`. It contains the staging URL, Git revision, pod
state, and digest-qualified web and worker images.

## GitHub Actions

The manual workflow uses Azure OIDC login and should be protected by reviewer
approval on the `staging` environment. Configure:

- Variables: `AZURE_LOCATION`, `AZURE_RESOURCE_GROUP`.
- Secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`,
  `DATABASE_PASSWORD`, and `JWT_SECRET`.
- Optional secrets: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`.

The Azure identity used by the workflow needs rights only for this standalone
resource group plus permission to create its scoped role assignments.

## Rollback

Images are deployed by digest. Obtain a previously recorded digest and update
the affected deployment:

```bash
kubectl set image -n avitam-teach deployment/web \
  web=REGISTRY/avitam-teach-stage-web@sha256:PREVIOUS_DIGEST
kubectl rollout status -n avitam-teach deployment/web --timeout=10m
scripts/smoke-staging.sh http://STAGING_IP
```

Use the equivalent command for the worker. Database changes in this checkpoint
are additive. A future destructive migration needs a backward-compatible
rollback design.

## Teardown

The following operation intentionally deletes only the dedicated project
resource group. It also deletes the cluster disk and all proof data:

```bash
infra/azure/staging.sh delete
```

The script verifies the `project=avitam-teach` tag before deletion and confirms
that the resource group is absent afterward. Preserve evidence outside the
group before running it.
