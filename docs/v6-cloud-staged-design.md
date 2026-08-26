# v6-cloud-staged: bounded AWS staging deployment

## Purpose

Deploy the evolved application to a real, temporary staging environment and
record whether its environmental assumptions hold. This checkpoint is not a
production certification and does not promise an always-on public service.

## Target topology

- Amazon ECR stores immutable application and worker images.
- Amazon ECS on Fargate runs separate web and ingestion-worker tasks.
- Amazon RDS for PostgreSQL stores application data and the vector index.
- Amazon S3 stores instructor material.
- AWS Secrets Manager supplies application credentials.
- An Application Load Balancer exposes only the web task.
- CloudWatch receives task logs and basic service metrics.
- Terraform describes the staging environment and supports complete teardown.

## Delivery contract

1. CI runs lint, type-checking, integration tests, and image builds.
2. A migration task runs before the service update.
3. The deployment uses an immutable image digest.
4. Health checks must pass before the smoke test begins.
5. Smoke tests verify the health endpoint and one database-backed path.
6. The runbook records rollback to the previous task definition.
7. `terraform destroy` removes the staging environment when the exercise ends.

## Evidence boundary

A successful run establishes that one reviewed revision was deployed to the
described staging environment and passed the recorded checks. It does not
establish availability, capacity, incident response quality, or safety under
real user traffic.
