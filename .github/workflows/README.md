# CI/CD Pipelines

This directory contains the GitHub Actions workflows for RomaneioHub.

## Pipeline Overview

### CI Pipeline (`ci.yml`)

Runs on every pull request and push to `main`. Validates code quality and build integrity for `backend/` and `frontend/` independently, since they're separate npm projects (not a monorepo/workspaces setup).

**`backend` job:**

1. Install dependencies (`npm ci`)
2. Generate Prisma Client
3. Lint
4. Test (Jest)
5. Build (`nest build`)

**`frontend` job:**

1. Install dependencies (`npm ci`)
2. Lint (`next lint`)
3. Build (`next build`)

The two jobs run in parallel and are independent — a failure in one doesn't block the other.

## Deployment

There is no deploy pipeline in this repository. Deployment is handled by the hosting platforms directly, triggered by pushes to `main`:

- **Backend** — [Railway](https://railway.com), building `backend/Dockerfile`. Database migrations (`prisma migrate deploy`) run automatically on container start.
- **Frontend** — [Vercel](https://vercel.com), building the `frontend/` directory (Next.js).

Both platforms are connected to this GitHub repository and redeploy automatically on push. No GitHub Actions secrets are required for deployment.

## Troubleshooting

### Lint fails
- Check ESLint output in the job logs
- Run `npm run lint` locally inside `backend/` or `frontend/` to reproduce

### Backend tests fail
- Check test output for specific failures
- Run `npm test` locally inside `backend/` to reproduce

### Build fails
- Check TypeScript compilation errors in the logs
- For the backend, ensure `npx prisma generate` ran successfully first (the Prisma Client must exist before `nest build`)
