# /env — Switch Active Environment

Use this command to switch to a specific environment locally. It will checkout the correct branch, pull latest, activate the correct env file, and start the server.

## Prerequisite — Start FastAPI first

FastAPI must be running on port 8000 before switching. Pass `DEPLOY_ENV` so it loads the right env overlay:

```bash
# development
cd api && DEPLOY_ENV=development uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# staging
cd api && DEPLOY_ENV=staging uvicorn app.main:app --host 0.0.0.0 --port 8000

# production
cd api && DEPLOY_ENV=production uvicorn app.main:app --host 0.0.0.0 --port 8000
```

`config.py` loads `api/.env` + `api/.env.{DEPLOY_ENV}` — the overlay wins on conflicts.

## Usage

```
/env [development|staging|production]
```

## What It Does Per Environment

| Environment | Branch | Next.js env file | How Next.js picks it up | FastAPI env files | `NODE_ENV` | `DEPLOY_ENV` |
|-------------|--------|-----------------|------------------------|------------------|-----------|-------------|
| `development` | `develop` | `.env.development` | Auto-loaded by `npm run dev` | `api/.env` + `api/.env.development` | `development` | `development` |
| `staging` | `staging` | `.env.staging` | Copied to `.env.local` (overrides all) | `api/.env` + `api/.env.staging` | `test` | `staging` |
| `production` | `production` | `.env.production` | Auto-loaded by `npm run build/start` | `api/.env` + `api/.env.production` | `production` | `production` |

## Steps (run in order)

### `/env development`
```bash
git add -A
git commit -m "chore: save changes before switching to development"
git push origin HEAD
git fetch --all
git checkout develop
git pull origin develop
```

### `/env staging`
```bash
git fetch --all
git checkout staging
git pull origin staging
cp .env.staging .env.local
```

### `/env production`
```bash
git fetch --all
git checkout production
git pull origin production
npm run build
npm run start
```

## Rules
- Always pull latest before running — avoids stale code with wrong env
- Never commit any `.env.*` or `.env.local` — all are git-ignored
- `DEPLOY_ENV` is the runtime differentiator — `NODE_ENV` does not support `staging`
- `.env.local` always overrides `.env.[NODE_ENV]` — that's how staging vars win over development defaults
- Clean up after staging: `rm .env.local` before switching back to development
- FastAPI and Next.js must use the same `DEPLOY_ENV` — mismatched tiers will use different configs
