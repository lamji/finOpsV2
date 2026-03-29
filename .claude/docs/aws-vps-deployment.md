# AWS VPS Deployment

This guide deploys `finOps` on a single AWS EC2 VPS using Docker Compose.

It uses:
- one EC2 Ubuntu server
- one domain
- Docker and Docker Compose
- the existing [`docker-compose.yml`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/docker-compose.yml)
- Nginx as reverse proxy
- optional HTTPS with Let's Encrypt

## 1. AWS free tier

AWS free tier rules changed after July 15, 2025.

- If your AWS account was created before July 15, 2025, you may still be under the older 12-month free tier model.
- If your AWS account was created on or after July 15, 2025, AWS uses the newer free-tier experience with up to `$200` credits and a 6-month free plan.

Check your exact eligibility in AWS Billing before creating resources. Do not assume EC2 usage is free.

Recommended low-cost instance for this project:
- `t3.small` or `t3.medium` for smoother Docker builds

If you must stay on the smallest budget:
- start with `t2.micro` or `t3.micro`
- expect slower Next.js build performance

## 2. Architecture

This repo runs three containers on one VPS:

- `ui` on port `3000`
- `api` on port `8000`
- `redis` on port `6379`

Nginx sits in front and routes traffic to the UI and API.

Recommended domain layout:

- `app.yourdomain.com` -> UI
- `api.yourdomain.com` -> API

## 3. Prerequisites

You need:

- an AWS account
- a registered domain
- GitHub access to this repository
- your production secrets:
  - `GCP_PROJECT_ID`
  - `GCP_CLIENT_EMAIL`
  - `GCP_PRIVATE_KEY`
  - `BQ_DATASET`
  - `BQ_TABLE`
  - `ANTHROPIC_API_KEY`

## 4. Create the EC2 instance

In AWS:

1. Open `EC2`
2. Click `Launch instance`
3. Name it `finops-prod`
4. Choose `Ubuntu Server 24.04 LTS`
5. Choose instance type:
   - `t3.small` recommended
   - `t3.micro` if you are constrained by cost
6. Create or select an SSH key pair
7. In network settings, allow:
   - `22` from your IP only
   - `80` from anywhere
   - `443` from anywhere
8. Create the instance
9. Allocate and attach an Elastic IP if this is a long-lived deployment

## 5. Point your domain

In your DNS provider:

- create an `A` record for `app.yourdomain.com` -> EC2 public IP
- create an `A` record for `api.yourdomain.com` -> EC2 public IP

If you want one domain only, you can use:

- `yourdomain.com` -> UI
- `yourdomain.com/api` -> API

Subdomains are simpler for this repo.

## 6. SSH into the server

From your local machine:

```bash
ssh -i /path/to/your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

## 7. Install Docker

On the server:

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg nginx
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
docker --version
docker compose version
```

## 8. Clone the repo

```bash
git clone https://github.com/lamji/finOpsV2.git
cd finOpsV2
git checkout develop
```

If your deployment branch changes, switch to that branch instead.

## 9. Create the production env file

Create `.env.production` in the repo root.

Example:

```env
GCP_PROJECT_ID=your-gcp-project-id
GCP_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GCP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"
BQ_DATASET=your_dataset
BQ_TABLE=your_table
ANTHROPIC_API_KEY=your_anthropic_key
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
DEPLOY_ENV=production
```

Notes:

- `GCP_PRIVATE_KEY` can be multiline or `\n` escaped. The backend code now normalizes both formats.
- `NEXT_PUBLIC_API_URL` must point to the public API URL because the UI bakes it in at build time.

## 10. Build and run the stack

Use the repo's compose file with the production env file:

```bash
ENV_FILE=.env.production docker compose up --build -d --remove-orphans
```

Check status:

```bash
docker compose ps
docker compose logs -f api
docker compose logs -f ui
```

Expected local ports:

- UI: `3000`
- API: `8000`
- Redis: `6379`

## 11. Configure Nginx

Create the Nginx config:

```bash
sudo nano /etc/nginx/sites-available/finops
```

Paste:

```nginx
server {
    server_name app.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/finops /etc/nginx/sites-enabled/finops
sudo nginx -t
sudo systemctl restart nginx
```

## 12. Add HTTPS

Install Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

Request certificates:

```bash
sudo certbot --nginx -d app.yourdomain.com -d api.yourdomain.com
```

Test renewal:

```bash
sudo certbot renew --dry-run
```

## 13. Verify deployment

Test the API:

```bash
curl https://api.yourdomain.com/health
curl https://api.yourdomain.com/dashboard
```

Then open:

- `https://app.yourdomain.com`

Check:

- the dashboard loads
- browser network requests go to `https://api.yourdomain.com`
- no request goes to `localhost`

## 14. Updating the app

On the server:

```bash
cd ~/finOpsV2
git pull origin develop
ENV_FILE=.env.production docker compose up --build -d --remove-orphans
```

## 15. Troubleshooting

### `dashboard` returns 503

Check API logs:

```bash
docker compose logs -f api
```

Common causes:

- missing `GCP_*` variables
- broken `GCP_PRIVATE_KEY`
- BigQuery IAM permission issues
- wrong `BQ_DATASET` or `BQ_TABLE`

### UI still calls localhost

Cause:
- `NEXT_PUBLIC_API_URL` was wrong during build

Fix:

```bash
ENV_FILE=.env.production docker compose down
ENV_FILE=.env.production docker compose up --build -d --remove-orphans
```

### Nginx 502

Check:

```bash
docker compose ps
docker compose logs -f ui
docker compose logs -f api
sudo systemctl status nginx
```

## 16. Security minimums

At minimum:

- restrict SSH port `22` to your IP
- use HTTPS only
- do not commit `.env.production`
- rotate secrets if they were ever exposed
- consider removing public Redis port mapping if not needed externally

## 17. Repo-specific files

Main deployment files in this repo:

- [`docker-compose.yml`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/docker-compose.yml)
- [`Dockerfile`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/Dockerfile)
- [`api/Dockerfile`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/api/Dockerfile)
- [`api/app/main.py`](/C:/Users/akrizu/Documents/DigitalFuture/finOps/api/app/main.py)
