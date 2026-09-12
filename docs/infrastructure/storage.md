---
title: "Storage Platform — Setup & Operations"
tags: ["storage", "s3", "infrastructure", "operations", "kyb"]
description: "ELI5 guide for file uploads: local dev, real S3, and deploying to dev / staging / production."
order: 20
author: "Acme Inc."
lastUpdated: 1789257600000
coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80"
---

# File storage — the simple guide

This doc explains **how file uploads work** and **what to configure** for:

- **Local dev** (no AWS account needed)
- **Dev / staging / production** (real S3)

Same upload flow everywhere. Only the `.env` values change.

---

## Table of contents

1. [30-second summary](#1-30-second-summary)
2. [What happens when someone uploads a file](#2-what-happens-when-someone-uploads-a-file)
3. [Pick your mode](#3-pick-your-mode)
4. [Local dev (no AWS) — start here](#4-local-dev-no-aws--start-here)
5. [Local dev with real S3 (optional)](#5-local-dev-with-real-s3-optional)
6. [Deploy AWS infrastructure (dev / staging / prod)](#6-deploy-aws-infrastructure-dev--staging--prod)
7. [Fill in `apps/api/.env`](#7-fill-in-appsapenv)
8. [Test that it works](#8-test-that-it-works)
9. [Troubleshooting](#9-troubleshooting)
10. [Quick cheat sheet](#10-quick-cheat-sheet)

---

## 1. 30-second summary

| Piece | What it does |
|-------|----------------|
| **Browser** | Picks a file (KYB PDF, product image, …) |
| **API** | Hands out a temporary upload ticket, then scans the file |
| **S3** (or local folder) | Stores the actual bytes |
| **PostgreSQL** | Stores metadata (`stored_files` — name, status, path) |
| **ClamAV or Lambda** | Virus scan before the file is marked safe |

**Two storage backends:**

| Mode | When | AWS needed? |
|------|------|-------------|
| **Local filesystem** | Default local dev | No |
| **S3** | Staging / production (or local S3 testing) | Yes |

The API picks the backend automatically: if `STORAGE_S3_PRIVATE_BUCKET` (or legacy `STORAGE_S3_BUCKET`) is set to a **real** bucket name, it uses S3. Otherwise files go to `apps/api/.object-storage/`.

---

## 2. What happens when someone uploads a file

Think of it like dropping a package at a security desk:

```
1. Browser asks API:  "I want to upload invoice.pdf"
2. API creates a DB row (status: PENDING) and returns an upload ticket
3. Browser uploads the file directly to storage (S3 or local shim)
4. Browser tells API: "I'm done"
5. API checks the file arrived (size + checksum)
6. API scans it for viruses (ClamAV or Lambda)
7. Clean  → move to final folder, status READY
   Dirty → delete file, status QUARANTINED
8. Later, download uses a short-lived signed link
```

**File statuses you'll see:**

| Status | Meaning |
|--------|---------|
| `PENDING` | Upload ticket issued, file not confirmed yet |
| `SCANNING` | Upload done, scan running |
| `READY` | Safe to view / download |
| `QUARANTINED` | Failed scan (infected or scanner error) |
| `DELETED` | Soft-deleted; physical delete happens later |

Scanning runs **inside** `POST /files/:id/complete` — there is no separate “wait for a queue” step in normal use.

---

## 3. Pick your mode

```
Do you want to use a real S3 bucket name in .env?
│
├─ NO  → Local mode (easiest)
│        • Files in apps/api/.object-storage/
│        • Scanner: ClamAV in Docker (port 3310)
│        • No AWS keys, no CORS
│
└─ YES → S3 mode
         • Files in your S3 bucket (staging/* then kyb/, products/, …)
         • Scanner: lambda (recommended) or clamav
         • Need AWS keys + CORS on the bucket
```

| | Local | S3 (dev / staging / prod) |
|--|-------|---------------------------|
| Bucket env | Leave unset | `STORAGE_S3_PRIVATE_BUCKET=...` |
| AWS keys | Not needed | `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` |
| Scanner | `STORAGE_SCANNER_MODE=clamav` | `lambda` + `STORAGE_SCANNER_LAMBDA_ARN` (or clamav) |
| CORS | Not needed | Required for browser uploads |
| ClamAV Docker | `docker compose up -d clamav` | Optional if using lambda |

---

## 4. Local dev (no AWS) — start here

**Best for:** everyday coding. No AWS bill, no CDK, no CORS headaches.

### Step 1 — Database

```bash
# from repo root
pnpm db:deploy
```

### Step 2 — ClamAV (virus scanner)

```bash
docker compose up -d clamav
```

Wait until healthy (`docker compose ps` — clamav should be `healthy`).

### Step 3 — API env

In `apps/api/.env`:

```bash
# Do NOT set STORAGE_S3_PRIVATE_BUCKET (or leave it commented out)

STORAGE_SCANNER_MODE=clamav
STORAGE_CLAMAV_HOST=127.0.0.1
STORAGE_CLAMAV_PORT=3310
```

### Step 4 — Run apps

```bash
pnpm dev
```

### Step 5 — Try an upload

1. Open merchant app → `http://localhost:3003`
2. Go to business verification (KYB)
3. Upload a PDF or image
4. You should see **Scanning** → **Ready**

Files land here on disk:

```text
apps/api/.object-storage/local-private-bucket/
```

**That's it for local dev.** You do not need CDK, Lambda, or AWS CLI.

---

## 5. Local dev with real S3 (optional)

**Best for:** testing presigned uploads, CORS, and production-like behaviour before go-live.

You need:

1. An S3 bucket (from CDK **or** your own, e.g. `rewardhub`)
2. IAM user with S3 permissions (CDK creates one for you)
3. CORS on the bucket
4. Scanner config (`lambda` or `clamav`)

See [§6](#6-deploy-aws-infrastructure-dev--staging--prod) to create buckets via CDK, or use an existing bucket and apply CORS manually (§9).

---

## 6. Deploy AWS infrastructure (dev / staging / prod)

Infrastructure lives in `apps/aws-infrastructure`. One CDK stack per environment:

| Environment | Stack name | Bucket name pattern |
|-------------|------------|---------------------|
| **development** | `StoragePlatform-development` | `app-development-private`, … |
| **staging** | `StoragePlatform-staging` | `app-staging-private`, … |
| **production** | `StoragePlatform-production` | `app-production-private`, … |

### Before you start

1. **AWS CLI** installed and logged in (`aws sts get-caller-identity`)
2. **Node.js 22+**
3. Use an IAM user — **never** root access keys on the API

### One-time: bootstrap CDK (per AWS account + region)

Bootstrap prepares CDK tooling. It does **not** create your buckets yet.

```bash
export AWS_REGION=ap-southeast-5          # your region
export CDK_DEFAULT_REGION=ap-southeast-5
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)

cd apps/aws-infrastructure
pnpm install
npx cdk bootstrap aws://$CDK_DEFAULT_ACCOUNT/$AWS_REGION
```

You should see: `Environment aws://ACCOUNT/REGION bootstrapped.`

### Deploy to **development**

```bash
cd apps/aws-infrastructure

pnpm run deploy -- \
  -c environment=development \
  -c browserOrigins=http://localhost:3000,http://localhost:3001,http://localhost:3003
```

> **Important:** use `pnpm run deploy --` (not `pnpm deploy`). The `--` passes flags to CDK.

Type `y` when CDK asks to approve changes.

At the end, copy the **Outputs** block. You need at least:

| Output | Use for |
|--------|---------|
| `PrivateBucketName` | `STORAGE_S3_PRIVATE_BUCKET` |
| `PublicOriginBucketName` | `STORAGE_S3_PUBLIC_BUCKET` |
| `CloudFrontDomain` | `STORAGE_CLOUDFRONT_PUBLIC_DOMAIN` |
| `ClamAvScannerArn` | `STORAGE_SCANNER_LAMBDA_ARN` |
| `ApiUploadUserName` | Create access keys in AWS Console → IAM |

**Get outputs later:**

```bash
aws cloudformation describe-stacks \
  --stack-name StoragePlatform-development \
  --region ap-southeast-5 \
  --query "Stacks[0].Outputs" \
  --output table
```

### Deploy to **staging**

Same commands, change the environment name and browser origins:

```bash
cd apps/aws-infrastructure

pnpm run deploy -- \
  -c environment=staging \
  -c browserOrigins=https://staging-merchant.example.com,https://staging-admin.example.com
```

Stack name: `StoragePlatform-staging`.

### Deploy to **production**

```bash
cd apps/aws-infrastructure

# Preview first (optional)
pnpm run synth -- -c environment=production

pnpm run deploy -- \
  -c environment=production \
  -c browserOrigins=https://merchant.example.com,https://admin.example.com
```

Stack name: `StoragePlatform-production`.

**Suggested order:** dev → staging → production. Run the [test checklist](#8-test-that-it-works) on each before promoting.

### What CDK creates

| Resource | Plain English |
|----------|----------------|
| Private S3 bucket | Where uploads land (`staging/…` first, then `kyb/`, `products/`, …) |
| Public S3 bucket | Processed public images (logos, product photos) |
| CloudFront | CDN in front of public bucket |
| ClamAV Lambda | Virus scanner the API calls directly |
| IAM upload user | API credentials (limited to S3 + invoke scanner) |
| SQS + alarms | Background image processing (placeholder) + failure alerts |

### CloudFront blocked on new AWS accounts?

If deploy fails with:

> *Your account must be verified before you can add new CloudFront resources*

1. Open [AWS Support](https://console.aws.amazon.com/support/home) → request CloudFront account verification
2. **While waiting:** use **local dev mode** (§4) — you don't need CloudFront for KYB uploads
3. Or use an **existing bucket** you already have (§5) with clamav scanner

### Using your own bucket (not CDK)

If you already have a bucket (e.g. `rewardhub`):

1. Skip CDK (or deploy later for CloudFront / Lambda)
2. Set `STORAGE_S3_PRIVATE_BUCKET=rewardhub` in `.env`
3. Apply CORS (see §9)
4. Use clamav scanner locally, or deploy CDK only for the Lambda ARN

---

## 7. Fill in `apps/api/.env`

Restart the API after any change.

### Local (no S3)

```bash
STORAGE_SCANNER_MODE=clamav
STORAGE_CLAMAV_HOST=127.0.0.1
STORAGE_CLAMAV_PORT=3310
# Leave STORAGE_S3_PRIVATE_BUCKET unset
```

### Development (S3 + Lambda scanner)

```bash
STORAGE_S3_PRIVATE_BUCKET=app-development-private
STORAGE_S3_PUBLIC_BUCKET=app-development-public-origin
STORAGE_CLOUDFRONT_PUBLIC_DOMAIN=d123456abcdef.cloudfront.net

AWS_REGION=ap-southeast-5
AWS_ACCESS_KEY_ID=AKIA...          # from IAM user ApiUploadUser — NOT root
AWS_SECRET_ACCESS_KEY=...

STORAGE_SCANNER_MODE=lambda
STORAGE_SCANNER_LAMBDA_ARN=arn:aws:lambda:ap-southeast-5:123456789012:function:app-development-clamav-scanner

STORAGE_DOWNLOAD_TTL_SECONDS=300
```

### Staging / production

Same shape — swap bucket names, region, origins, and Lambda ARN for that environment:

```bash
STORAGE_S3_PRIVATE_BUCKET=app-production-private
STORAGE_S3_PUBLIC_BUCKET=app-production-public-origin
STORAGE_CLOUDFRONT_PUBLIC_DOMAIN=d123456abcdef.cloudfront.net

AWS_REGION=ap-southeast-5
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

STORAGE_SCANNER_MODE=lambda
STORAGE_SCANNER_LAMBDA_ARN=arn:aws:lambda:ap-southeast-5:123456789012:function:app-production-clamav-scanner
```

### Env var reference

| Variable | Required when | What it does |
|----------|---------------|--------------|
| `STORAGE_S3_PRIVATE_BUCKET` | S3 mode | Main bucket for uploads. Alias: `STORAGE_S3_BUCKET` (legacy) |
| `STORAGE_S3_PUBLIC_BUCKET` | Public images | Bucket for CDN-backed assets |
| `STORAGE_CLOUDFRONT_PUBLIC_DOMAIN` | Public images | CloudFront hostname from CDK |
| `AWS_REGION` | S3 mode | Must match bucket region |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | S3 mode | IAM upload user keys |
| `STORAGE_SCANNER_MODE` | Always | `clamav` (local) or `lambda` (S3) |
| `STORAGE_SCANNER_LAMBDA_ARN` | `lambda` mode | From CDK output `ClamAvScannerArn` |
| `STORAGE_CLAMAV_HOST` / `STORAGE_CLAMAV_PORT` | `clamav` mode | Default `127.0.0.1:3310` |
| `STORAGE_DOWNLOAD_TTL_SECONDS` | Optional | Signed download link lifetime (default 300) |
| `STORAGE_PHYSICAL_DELETE_DELAY_MS` | Optional | Default 1h dev, 30d production |
| `STORAGE_PROCESSING_CALLBACK_SECRET` | Rare | Only if external workers call `/files/processing-callback` |

**How the API chooses S3 vs local** (`storage.module.ts`):

- Bucket env **unset** → local filesystem
- Bucket name starts with `local-` → local filesystem
- Any other bucket name → **S3** (requires AWS keys)

---

## 8. Test that it works

Run this on **local first**, then repeat on staging / production.

### Start services

```bash
pnpm db:deploy
pnpm dev
# local mode: docker compose up -d clamav
```

### Merchant upload

1. Log in → merchant app (`:3003`)
2. KYB → upload a PDF or image (≤ 5 MiB)
3. Submit
4. Status should go **Scanning** → **Ready**

### Admin review

1. Log in → admin (`:3001`)
2. Reward Hub → KYB review
3. **View** opens preview, **Download** saves the file

### Success checklist

| Check | Local | S3 |
|-------|-------|-----|
| File exists | `apps/api/.object-storage/local-private-bucket/kyb/…` | `aws s3 ls s3://BUCKET/kyb/` |
| DB row | `stored_files.status = READY` in Prisma Studio | Same |
| No CORS errors | N/A | Browser DevTools → Network tab clean on upload |
| API logs | `[FileScanService] Scan finished: clean` | Same |

### Legacy KYB documents (one-time migration)

If old documents were stored as base64 in JSON:

```bash
pnpm --filter @workspace/api kyb:backfill -- --dry-run
pnpm --filter @workspace/api kyb:backfill
```

---

## 9. Troubleshooting

### `Stack StoragePlatform-development does not exist`

You ran `aws cloudformation describe-stacks` **before** deploying. Bootstrap ≠ deploy.

Fix: run `pnpm run deploy -- -c environment=development …` (§6).

### `pnpm deploy -c environment=…` → `unexpected argument '-c'`

Wrong command. Use:

```bash
pnpm run deploy -- -c environment=development ...
```

### Upload stuck on "Scanning"

| Cause | Fix |
|-------|-----|
| ClamAV not running | `docker compose up -d clamav` |
| Lambda ARN missing | Set `STORAGE_SCANNER_LAMBDA_ARN` from CDK output |
| Scanner error | Check API logs for `[FileScanService]` |
| Old broken row | Re-upload the file |

### CORS error in browser (S3 mode)

Browser uploads talk to S3 directly. The bucket needs CORS rules.

**CDK buckets:** pass `browserOrigins` at deploy time.

**Manual bucket:**

```bash
aws s3api put-bucket-cors \
  --bucket YOUR_BUCKET \
  --region YOUR_REGION \
  --cors-configuration file://apps/aws-infrastructure/config/private-bucket-cors.json
```

### `S3 storage is enabled but AWS_ACCESS_KEY_ID … are missing`

You set a bucket name but forgot AWS keys. Create keys for the CDK IAM upload user.

### `useS3Storage` is false but I set a bucket

Bucket name must **not** start with `local-`. Use `STORAGE_S3_PRIVATE_BUCKET`, not a placeholder.

### Mass ESLint errors on `@ApiOkResponse` / decorators

Usually a broken `@nestjs/swagger` install (missing `dist/`). Fix:

```bash
pnpm install --force
# or
pnpm --filter @workspace/api add @nestjs/swagger@12.0.1 --force
```

Verify: `ls apps/api/node_modules/@nestjs/swagger/dist/index.js`

### CloudFront deploy failed (new AWS account)

See [CloudFront blocked](#cloudfront-blocked-on-new-aws-accounts) in §6. Use local mode until AWS approves.

---

## 10. Quick cheat sheet

### Commands

```bash
# Database (all environments)
pnpm db:deploy

# CDK bootstrap (once per account/region)
cd apps/aws-infrastructure
npx cdk bootstrap aws://ACCOUNT_ID/REGION

# CDK deploy
pnpm run deploy -- -c environment=development \
  -c browserOrigins=http://localhost:3000,http://localhost:3001,http://localhost:3003

pnpm run deploy -- -c environment=staging \
  -c browserOrigins=https://staging-merchant.example.com,https://staging-admin.example.com

pnpm run deploy -- -c environment=production \
  -c browserOrigins=https://merchant.example.com,https://admin.example.com

# Read stack outputs
aws cloudformation describe-stacks \
  --stack-name StoragePlatform-development \
  --region ap-southeast-5 \
  --query "Stacks[0].Outputs" \
  --output table

# Local ClamAV
docker compose up -d clamav

# KYB backfill
pnpm --filter @workspace/api kyb:backfill -- --dry-run
```

### Code map

| What | Where |
|------|-------|
| S3 SDK wrapper | `apps/api/src/modules/storage/s3-object-storage.service.ts` |
| Upload orchestration | `apps/api/src/modules/files/services/file.service.ts` |
| Browser upload client | `packages/client/src/lib/storage/direct-upload.ts` |
| CDK stack | `apps/aws-infrastructure/lib/storage-platform-stack.ts` |
| Env template | `apps/api/.env.example` |

### Related docs

- [Getting started](../getting-started.md)
- [apps/aws-infrastructure/README.md](../../apps/aws-infrastructure/README.md)
