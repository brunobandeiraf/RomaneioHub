# CI/CD Pipelines

This directory contains the GitHub Actions workflows for ComprasHub.

## Pipelines Overview

### CI Pipeline (`ci.yml`)

Runs on every pull request and push to `main`. Validates code quality and build integrity.

**Stages (sequential):**

1. **Lint** — Runs ESLint across all workspaces via `turbo run lint`
2. **Test** — Runs unit tests across all workspaces via `turbo run test`
3. **Build** — Builds all workspaces via `turbo run build`

Each stage depends on the previous one. If any stage fails, subsequent stages are skipped.

### Deploy Pipeline (`deploy.yml`)

Runs on push to `main` (deploys to dev) or when a release is published (deploys to prod).

**Stages (sequential):**

1. **Lint** — Same as CI
2. **Test** — Same as CI
3. **Build** — Same as CI
4. **Determine Environment** — Resolves target environment (dev or prod) based on trigger
5. **Migrate** — Runs `prisma migrate deploy` against the target database
6. **Deploy API** — Deploys NestJS Lambda via Terraform
7. **Deploy Web** — Deploys Next.js to AWS Amplify via Terraform

Deploy API and Deploy Web run in parallel after migration succeeds.

## Environment Determination

| Trigger | Environment | Database Secret |
|---------|-------------|-----------------|
| Push to `main` | dev | `DATABASE_URL_DEV` |
| Release published (tag `v*`) | prod | `DATABASE_URL_PROD` |

## Migration Failure Handling

If the `prisma migrate deploy` stage fails:

- The pipeline halts immediately
- Neither `deploy-api` nor `deploy-web` will execute
- The failure is reported in the GitHub Actions run summary
- The operator should investigate the migration error, fix the migration files, and re-trigger the pipeline

This ensures the application is never deployed against a database with a schema mismatch.

## Required GitHub Secrets

Configure these secrets in your GitHub repository settings (Settings → Secrets and variables → Actions):

### AWS Credentials

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | AWS IAM access key for deployments |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret key for deployments |
| `AWS_REGION` | AWS region (e.g., `us-east-1`) |

### Database

| Secret | Description |
|--------|-------------|
| `DATABASE_URL_DEV` | PostgreSQL connection string for dev environment |
| `DATABASE_URL_PROD` | PostgreSQL connection string for prod environment |

### Stripe

| Secret | Description |
|--------|-------------|
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |

## Triggering Production Deployments

Production deployments are triggered by creating a GitHub Release:

1. Go to the repository's **Releases** page
2. Click **Draft a new release**
3. Create a new tag following semver (e.g., `v1.2.3`)
4. Fill in the release title and notes
5. Click **Publish release**

This triggers the deploy pipeline targeting the `prod` environment.

Alternatively, using the GitHub CLI:

```bash
gh release create v1.2.3 --title "Release v1.2.3" --notes "Description of changes"
```

## Caching Strategy

Both pipelines use:

- **npm cache** — Caches `node_modules` via `actions/setup-node` built-in caching
- **Turbo cache** — Caches `.turbo` directory to skip unchanged workspace tasks

Cache keys include the OS, turbo.json hash, and commit SHA for precise invalidation.

## Troubleshooting

### Lint fails
- Check ESLint output in the job logs
- Run `turbo run lint` locally to reproduce

### Tests fail
- Check test output for specific failures
- Run `turbo run test` locally to reproduce

### Build fails
- Check TypeScript compilation errors in the logs
- Ensure `packages/db` builds first (Turbo handles dependency ordering)

### Migration fails
- Check Prisma migration output for SQL errors
- Verify the `DATABASE_URL_*` secret is correct and the database is reachable
- Test locally with `npx prisma migrate deploy` against a dev database
- If a migration is broken, create a corrective migration and push again

### Deploy fails
- Verify AWS credentials are valid and have sufficient permissions
- Check Terraform state for drift or conflicts
- Review the Terraform plan output in the job logs
