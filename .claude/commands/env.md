# /env — Switch Active Environment

Use this command to switch to a specific environment locally. It will checkout the correct branch, pull latest, then start the dev server with the right env file.

## Usage

```
/env [development|staging|production]
```

## What It Does Per Environment

| Environment | Branch | Env File | `NODE_ENV` | `DEPLOY_ENV` |
|-------------|--------|----------|-----------|-------------|
| `development` | `develop` | `.env.development` | `development` | `development` |
| `staging` | `staging` | `.env.staging` | `test` | `staging` |
| `production` | `production` | `.env.production` | `production` | `production` |

## Steps (run in order)

### `/env development`
```bash
git add -A
git commit -m "chore: save changes before switching to development"
git push origin HEAD
git fetch --all
git checkout develop
git pull origin develop
npm run dev
```

### `/env staging`
```bash
git fetch --all
git checkout staging
git pull origin staging
npx dotenv-cli -e .env.staging -- npm run dev
```

### `/env production`
```bash
git fetch --all
git checkout production
git pull origin production
npm run build && npm run start
```

## Rules
- Always pull latest before running — avoids stale code with wrong env
- Never commit `.env.development`, `.env.staging`, or `.env.production` — all are git-ignored
- `DEPLOY_ENV` is the runtime differentiator — `NODE_ENV` does not support `staging`
- For Vercel: set vars directly in **Project Settings → Environment Variables** per project tier
