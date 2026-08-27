# v6-cloud-staged: bounded Azure staging deployment

## Purpose

Deploy the evolved application to a real, temporary Azure environment and
collect evidence at the boundaries that local tests cannot exercise. This is a
reader bonus and proof exercise, not a production deployment promise.

## Standalone topology

- A dedicated resource group owns every project resource and carries an expiry
  tag. The lifecycle script refuses resource groups outside the
  `rg-avitam-teach-stage-*` prefix.
- Azure Kubernetes Service runs one small system node. Separate web, ingestion
  worker, migration job, and pgvector workloads share that node.
- Azure Container Registry stores revision-tagged images. Kubernetes receives
  digest-qualified image references.
- An Azure managed disk backs the single-replica PostgreSQL StatefulSet.
- A private Azure Blob container stores instructor material.
- Microsoft Entra workload identity gives the application access only to that
  Blob container. No storage key enters Kubernetes.
- An Azure Load Balancer exposes the short-lived web proof endpoint.

The PostgreSQL workload is intentionally a staging compromise. It proves
persistence, migration ordering, and pgvector behavior on Kubernetes, but it
does not provide managed backups, high availability, or a production database
service. The one-node cluster can interrupt every workload if its node fails.

## Deployment contract

1. Infrastructure creation is idempotent and scoped to the dedicated resource
   group.
2. Web and worker images are pushed before their registry digests are resolved.
3. PostgreSQL must be ready before the migration job starts.
4. A failed migration prevents web and worker rollout.
5. Readiness and liveness probes call `/api/health`.
6. The smoke test checks health and the database-backed Basic Python course.
7. A storage acceptance test writes, reads, compares, and deletes a private Blob
   object through workload identity.
8. The evidence records the Git revision and both deployed image digests.
9. Deleting the dedicated resource group removes the AKS cluster, managed disk,
   registry, Blob data, identity, and load balancer.

## Promotion rule

Repository artifacts do not establish that a deployment happened. A
`v6-cloud-staged` tag must not be created until a dated record shows a
successful migration, stable workloads, passing HTTP smoke test, and passing
Blob workload-identity round trip.

## Explicit limits

- The public proof endpoint is HTTP and is suitable only for synthetic smoke
  data. Do not enter credentials or real course material. A longer-lived stage
  needs an ingress controller, trusted certificate, and HTTPS-only policy.
- API provider keys are optional. Without them, deployment and storage are
  proven, but live embedding and assistant completion are not.
- A single PostgreSQL pod and disk are not a production data architecture.
- This checkpoint proves one temporary Azure topology. It does not certify
  production readiness or promise ongoing hosting.
