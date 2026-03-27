# /env — Switch Active Environment

Use this command to switch to a specific environment locally. It will fetch all remote branches, checkout the correct branch, pull latest, and align **all** env files (Next.js + FastAPI `api/`).

## Usage

```
/env [development|staging|production]
```

## What It Does Per Environment

| Environment | Branch | Next.js env | `api/.env` source | `NODE_ENV` | `DEPLOY_ENV` |
|-------------|--------|-------------|-------------------|-----------|-------------|
| `development` | `develop` | remove `.env.local` (auto-loads `.env.development`) | `api/.env.development` | `development` | `development` |
| `staging` | `staging` | `cp .env.staging .env.local` | `api/.env.staging` | `test` | `staging` |
| `production` | `production` | `cp .env.production .env.local` | `api/.env.production` | `production` | `production` |

## Steps (run in order)

### `/env development`
```bash
git fetch --all
git checkout develop
git pull origin develop
rm -f .env.local
cp api/.env.development api/.env
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
cp api/.env.staging api/.env
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
cp api/.env.production api/.env
```

## Rules
- Always `git fetch --all` first — ensures remote branches are available locally before checkout
- Always pull latest before running — avoids stale code with wrong env
- Never commit any `.env.*` files — all are git-ignored
- `api/.env` is always overwritten by the target env file — both Next.js and FastAPI must be on the same tier
- `DEPLOY_ENV` is the runtime differentiator — `NODE_ENV` does not support `staging`
- For Vercel: set vars directly in **Project Settings → Environment Variables** per project tier
- `api/.env.development` must exist — it is the source of truth for the development api env
