# /env — Switch Active Environment

Use this command to switch to a specific environment locally. It will fetch all remote branches, checkout the correct branch, and pull latest.

## Usage

```
/env [development|staging|production]
```

## What It Does Per Environment

| Environment | Branch | Env file for Docker | `NODE_ENV` | `DEPLOY_ENV` |
|-------------|--------|---------------------|-----------|-------------|
| `development` | `develop` | `.env.local` (or `.env.development` fallback) | `development` | `development` |
| `staging` | `staging` | `.env.staging` → copy to `.env.local` | `test` | `staging` |
| `production` | `production` | `.env.production` → copy to `.env.local` | `production` | `production` |

> The `api` service reads env vars from the **root** `.env.local` via `docker-compose.yml` (`env_file: ${ENV_FILE:-.env.local}`). There are no `api/.env*` files — the api dir has no env files.

## Steps (run in order)

### `/env development`
```bash
git fetch --all
git checkout develop
git pull origin develop
```

### `/env staging`
```bash
git add -A
git commit -m "chore: save changes before switching to staging"
git push
git fetch --all
git checkout staging
git pull origin staging
cp .env.staging .env.local
```

### `/env production`
```bash
git add -A
git commit -m "chore: save changes before switching to production"
git push
git fetch --all
git checkout production
git pull origin production
cp .env.production .env.local
```

## Rules
- Always `git fetch --all` first — ensures remote branches are available locally before checkout
- Always pull latest before running — avoids stale code with wrong env
- Never commit any `.env.*` files — all are git-ignored
- Both Next.js UI and FastAPI read from the same root `.env.local` — one file per tier
- `DEPLOY_ENV` is the runtime differentiator — `NODE_ENV` does not support `staging`
- For Vercel: set vars directly in **Project Settings → Environment Variables** per project tier
