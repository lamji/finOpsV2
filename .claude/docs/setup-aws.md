# AWS EC2 Deployment Guide — FinOps Dashboard

**Instance:** `ec2-52-53-251-25.us-west-1.compute.amazonaws.com`
**User:** `ubuntu`
**Repo:** `https://github.com/lamji/finOpsV2.git`

---

## Prerequisites — EC2 Security Group Inbound Rules

| Port | Protocol | Source    |
|------|----------|-----------|
| 22   | TCP      | Your IP   |
| 3000 | TCP      | 0.0.0.0/0 |
| 8000 | TCP      | 0.0.0.0/0 |

---

## Step 1 — SSH into EC2

```bash
ssh -i "C:\Users\akrizu\Downloads\finOps.pem" ubuntu@ec2-52-53-251-25.us-west-1.compute.amazonaws.com
```

---

## Step 2 — Install Docker

Run these one at a time:

**1.**
```bash
sudo apt update
```

**2.**
```bash
sudo apt install -y ca-certificates curl
```

**3.**
```bash
sudo install -m 0755 -d /etc/apt/keyrings
```

**4.**
```bash
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
```

**5.**
```bash
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

**6.**
```bash
printf 'Types: deb\nURIs: https://download.docker.com/linux/ubuntu\nSuites: noble\nComponents: stable\nSigned-By: /etc/apt/keyrings/docker.asc\n' | sudo tee /etc/apt/sources.list.d/docker.sources
```

**7.**
```bash
sudo apt update
```

**8.**
```bash
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

**9.**
```bash
sudo usermod -aG docker ubuntu && newgrp docker
```

**10.**
```bash
docker --version && docker compose version
```

---

## Step 3 — Clone the Repo

**11.**
```bash
sudo apt install -y git
```

**12.**
```bash
git clone https://github.com/lamji/finOpsV2.git ~/finOps
```

**13.**
```bash
cd ~/finOps
```

**14.**
```bash
ls
```

---

## Step 4 — Create Environment File

**15.**
```bash
nano .env.local
```

Paste this content (all credentials match `.env.local` from local project):

```
GCP_PROJECT_ID=your-gcp-project-id
GCP_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GCP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
BQ_DATASET=your_dataset
BQ_TABLE=your_table
ANTHROPIC_API_KEY=your-anthropic-api-key
REDIS_URL=redis://redis:6379
LOG_LEVEL=info
NODE_ENV=production
DEPLOY_ENV=production
```

Save: `Ctrl+X` → `Y` → `Enter`

> **Note:** Root `.env.local` is used by both the UI build arg and the API container via `env_file` in docker-compose.yml. No separate `api/.env` needed for Docker deployments.

---

## Step 5 — Deploy

**16.**
```bash
NEXT_PUBLIC_API_URL=http://ec2-52-53-251-25.us-west-1.compute.amazonaws.com:8000 docker compose up --build -d
```

Takes 3-5 minutes. Monitor with:

```bash
docker compose logs -f
```

---

## Step 6 — Verify

```bash
docker compose ps
```

```bash
docker compose logs api --tail=20
```

---

## Access URLs

| Service | URL |
|---------|-----|
| UI      | http://ec2-52-53-251-25.us-west-1.compute.amazonaws.com:3000 |
| API     | http://ec2-52-53-251-25.us-west-1.compute.amazonaws.com:8000/dashboard |

---

## Re-deploy After Code Changes

```bash
cd ~/finOps
git pull
NEXT_PUBLIC_API_URL=http://ec2-52-53-251-25.us-west-1.compute.amazonaws.com:8000 docker compose up --build -d
```

---

## Stop All Services

```bash
docker compose down
```
