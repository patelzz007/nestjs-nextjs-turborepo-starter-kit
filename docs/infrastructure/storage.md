---
title: "Storage Platform — Setup & Operations"
tags: ["storage", "s3", "infrastructure", "operations", "kyb"]
description: "ELI5 guide for file uploads: local dev, AWS S3, Firebase Storage, and deploying to dev / staging / production."
order: 20
author: "Acme Inc."
lastUpdated: 1757692800000
coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80"
---

# File storage — the simple guide

This doc explains **how file uploads work** and **what to configure** for:

- **Local dev** (no cloud account needed)
- **Dev / staging / production** (AWS S3 or Firebase Storage)

Same upload flow everywhere. Only the `.env` values change.

---

## Table of contents

1. [30-second summary](#1-30-second-summary)
2. [What happens when someone uploads a file](#2-what-happens-when-someone-uploads-a-file)
3. [How the storage adapter works (ELI5)](#3-how-the-storage-adapter-works-eli5)
4. [Pick your mode](#4-pick-your-mode)
5. [One bucket vs two buckets (S3)](#5-one-bucket-vs-two-buckets-s3)
6. [Local dev (no AWS) — start here](#6-local-dev-no-aws--start-here)
7. [Local dev with real S3 (optional)](#7-local-dev-with-real-s3-optional)
8. [CDK deploy guide — A to Z (beginner friendly)](#8-cdk-deploy-guide--a-to-z-beginner-friendly)
9. [Fill in `apps/api/.env`](#9-fill-in-appsapenv)
10. [Firebase Storage (ELI5)](#10-firebase-storage-eli5)
11. [Test that it works](#11-test-that-it-works)
12. [Troubleshooting](#12-troubleshooting)
13. [Quick cheat sheet](#13-quick-cheat-sheet)

---

## 1. 30-second summary

| Piece | What it does |
|-------|----------------|
| **Browser** | Picks a file (KYB PDF, product image, …) |
| **API** | Hands out a temporary upload ticket, then finalizes the file |
| **Storage provider** (local / S3 / Firebase) | Stores the actual bytes |
| **PostgreSQL** | Stores metadata (`stored_files` — name, status, path) |
**Three storage providers (one active per deployment):**

| Provider | When | Cloud account? |
|----------|------|----------------|
| **Local filesystem** | Default local dev | No |
| **AWS S3** | Staging / production on AWS | Yes (AWS) |
| **Firebase Storage** | Staging / production on GCP | Yes (Firebase/GCP) |

Set `STORAGE_PROVIDER=local|s3|firebase`. If unset, the API infers `s3` when `STORAGE_S3_PRIVATE_BUCKET` (or legacy `STORAGE_S3_BUCKET`) is a real bucket name; otherwise it uses local files in `apps/api/.object-storage/`.

Every `stored_files` row records which provider stored it (`storage_provider`, `storage_container`, `object_revision`). A deployment refuses to read files whose recorded provider differs from the active one.

---

## 2. What happens when someone uploads a file

Think of it like dropping a package at a security desk:

```
1. Browser asks API:  "I want to upload invoice.pdf"
2. API creates a DB row (status: PENDING) and returns an upload ticket
3. Browser uploads the file directly to storage (multipart POST for local/S3, signed PUT for Firebase)
4. Browser tells API: "I'm done"
5. API checks the file arrived (size + checksum)
6. API promotes it to the final folder, status READY
7. Later, download uses a short-lived signed link
```

**File statuses you'll see:**

| Status | Meaning |
|--------|---------|
| `PENDING` | Upload ticket issued, file not confirmed yet |
| `SCANNING` | Upload done, scan running |
| `READY` | Safe to view / download |
| `QUARANTINED` | Rejected by external processing callback |
| `DELETED` | Soft-deleted; physical delete happens later |

Scanning runs **inside** `POST /files/:id/complete` — there is no separate “wait for a queue” step in normal use.

---

## 3. How the storage adapter works (ELI5)

Imagine your app needs to **store files**, but you might use a **folder on your laptop**, **AWS S3**, or **Firebase** depending on the environment.

Instead of writing `if (s3) … else if (firebase) …` in every feature, we use **adapters** — one translator per provider that all speak the same language.

### The big picture

```
┌─────────────┐     upload ticket      ┌──────────────┐
│   Browser   │ ◄────────────────────► │  Files API   │
└──────┬──────┘                        └──────┬───────┘
       │ direct upload                      │ uses ports
       ▼                                      ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│    Local    │   │     S3      │   │  Firebase   │
│   adapter   │   │   adapter   │   │   adapter   │
└─────────────┘   └─────────────┘   └─────────────┘
```

The **Files API** (`file.service.ts`) never imports AWS or Firebase SDKs. It only talks to two **ports** (interfaces):

| Port | Plain English | Examples |
|------|---------------|----------|
| `ObjectStorage` | Private file cupboard — upload, read, delete, copy, check size | KYB PDFs, staging uploads |
| `PublicDelivery` | Shop window — turn a processed image into a stable public URL | Product photos, store logos |

At startup, `storage.module.ts` reads `STORAGE_PROVIDER` and plugs in **one** private adapter and **one** public-delivery adapter. Everyone else just asks for `OBJECT_STORAGE` or `PUBLIC_DELIVERY` — they don't care which cloud you picked.

### The address card: `StorageObjectLocator`

Every file is pointed to with the same shape, no matter the provider:

```text
provider   →  local | s3 | firebase
container  →  bucket name (e.g. rewardhub, my-project.appspot.com, local-private-bucket)
path       →  folder + filename (e.g. staging/kyb/org-id/file-id/invoice.pdf)
revision   →  optional version id (S3 generation, GCS generation, etc.)
```

Think of it like a mailing label: **who** (provider), **which building** (container), **which room** (path), **which copy** (revision).

The database stores this on every `stored_files` row (`storage_provider`, `storage_container`, `storage_path`, `object_revision`). Legacy columns (`storage_bucket`, `object_generation`) are still written during the compatibility window.

**Important rule:** if a row says `provider = s3` but your deployment runs `STORAGE_PROVIDER=firebase`, the API **refuses** to read it. We don't silently hop between clouds — migration is a separate, explicit job.

### What each adapter must do

Every adapter implements the same checklist:

| Job | When it's used |
|-----|----------------|
| `createBrowserUploadTicket` | User picks a file → API hands browser a one-time upload pass |
| `headObject` | After upload → API checks size / checksum before finalize |
| `getObject` | Checksum verification when the provider does not return a hash |
| `copyObject` | On complete → move from `staging/…` to final folder |
| `deleteObject` | Quarantine, cleanup, or delayed physical delete |
| `getSignedDownloadUrl` | Private KYB download links (expire after a few minutes) |
| `publishAsset` | Public images get a stable URL (CloudFront, local shim, or Firebase token) |

Provider SDK types (AWS `S3Client`, Firebase `getStorage`, etc.) **stay inside** the adapter file. Nothing else in the repo should import them.

### Upload tickets: same flow, different transport

The browser always does the same dance:

1. `POST /files/upload-url` → get a **ticket**
2. Upload bytes **directly** to storage (not through the API body)
3. `POST /files/:id/complete` → API verifies and scans

The ticket tells the client **how** to upload:

| Provider | Ticket `method` | What the browser does |
|----------|-----------------|------------------------|
| Local | `POST_MULTIPART` | POST form to API shim (`/files/:id/local-upload`) |
| S3 | `POST_MULTIPART` | POST form straight to S3 presigned URL |
| Firebase | `PUT` | PUT file bytes to a signed GCS URL with `Content-Type` header |

The client helper `packages/client/src/lib/storage/direct-upload.ts` reads `ticket.method` and picks the right fetch call. Your React pages don't branch on provider.

### Who calls what (code map)

| Layer | File | Knows about providers? |
|-------|------|------------------------|
| Browser client | `packages/client/src/lib/storage/direct-upload.ts` | Only ticket `method` (POST vs PUT) |
| Upload orchestration | `apps/api/src/modules/files/services/file.service.ts` | No — uses locators + ports |
| Provider registry | `storage/storage.module.ts` + `factory/storage-adapter.factory.ts` | Yes — picks adapter at boot |
| Local adapter | `adapters/local/local-object-storage.adapter.ts` | Yes |
| S3 adapter | `adapters/s3/s3-object-storage.adapter.ts` | Yes |
| Firebase adapter | `adapters/firebase/firebase-object-storage.adapter.ts` | Yes |
| Locator helpers | `utils/storage-locator.util.ts` | Maps DB rows ↔ locators |

### Adding a new provider later

To add (say) Azure Blob Storage:

1. Create `adapters/azure/azure-object-storage.adapter.ts` implementing `ObjectStorage` + `PublicDelivery`
2. Add `"azure"` to `StorageProvider` in `packages/shared`
3. Register it in `storage.module.ts` factory
4. Add env vars + docs
5. **Do not** change `file.service.ts` unless the upload ticket shape needs a new `method`

That's the whole point of the adapter pattern — swap the plug, keep the wall socket.

---

## 4. Pick your mode

```
Which STORAGE_PROVIDER do you need?
│
├─ local (default) → apps/api/.object-storage/
│
├─ s3 → AWS S3 bucket (staging/* then kyb/, products/, …)
│       Needs AWS keys + S3 CORS
│
└─ firebase → Firebase / GCS bucket
              Auth: Application Default Credentials (service account locally)
              Browser uploads: signed PUT + Firebase Storage CORS
```

| | Local | S3 | Firebase |
|--|-------|-----|----------|
| `STORAGE_PROVIDER` | `local` (or unset) | `s3` | `firebase` |
| Container env | optional | `STORAGE_S3_BUCKET` (legacy), `STORAGE_S3_PRIVATE_BUCKET`, or `STORAGE_PRIVATE_CONTAINER` | `FIREBASE_STORAGE_BUCKET` |
| Cloud keys | Not needed | `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` | `GOOGLE_APPLICATION_CREDENTIALS` (local) or GCP ADC |
| Browser upload | multipart POST to API shim | multipart POST to S3 | signed PUT to GCS |
| Public URLs | API `local-download` shim | CloudFront domain | per-object Firebase download token |
| CORS | Not needed | S3 bucket CORS | Firebase Storage CORS |

---

## 5. One bucket vs two buckets (S3)

You do **not** need separate public and private buckets for the API to work. A single bucket is enough for uploads, promotion, and private downloads.

### How the API picks the bucket

All uploads and file moves use **one** container name, resolved in this order:

```text
STORAGE_PRIVATE_CONTAINER
  → STORAGE_S3_PRIVATE_BUCKET
  → STORAGE_S3_BUCKET          ← legacy alias, still fully supported
  → FIREBASE_STORAGE_BUCKET
  → local-private-bucket       (fallback when nothing is set)
```

So this is valid and common:

```bash
STORAGE_PROVIDER=s3
STORAGE_S3_BUCKET=rewardhub
AWS_REGION=ap-southeast-5
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

`STORAGE_S3_PRIVATE_BUCKET=rewardhub` does the same thing — pick one style and stick with it.

### What actually happens in S3 mode

| Step | Bucket used |
|------|-------------|
| Browser upload ticket | Private container (`rewardhub`) |
| Staging path (`staging/…`) | Same bucket |
| Promote to final path (`kyb/`, `products/`, …) | Same bucket — copy within the bucket |
| Private download (KYB) | Same bucket — short-lived signed URL |
| Public asset URL (product image) | Same bucket path — URL built by `publishAsset` |

The API **does not** copy objects into `STORAGE_S3_PUBLIC_BUCKET` today. That variable exists for future/CDK alignment but is **not read** by upload or finalize code.

### When you still need CloudFront

Public file categories (product images, logos, avatars) store a stable `publicUrl` in the database. In S3 mode the adapter builds that URL as:

- `https://{STORAGE_CLOUDFRONT_PUBLIC_DOMAIN}/{path}` when CloudFront is configured, **or**
- `https://{bucket}.s3.{region}.amazonaws.com/{path}` as a fallback

If your bucket blocks public access (recommended), the direct S3 fallback URL will **not** load in a browser. You need CloudFront (or another public delivery layer) for public images to render.

**Single-bucket + CloudFront:** point CloudFront at `rewardhub` and set `STORAGE_CLOUDFRONT_PUBLIC_DOMAIN`. You still do not need a second bucket.

### CDK two-bucket layout (optional)

The CDK stack in `apps/aws-infrastructure` creates **two** buckets per environment:

| Bucket | Name pattern (dev) | Purpose |
|--------|-------------------|---------|
| Private | `app-development-private` | Uploads, KYB, staging |
| Public origin | `app-development-public-origin` | CDN origin for processed public images |

This is a **recommended production layout** (clean separation, background image workers can copy between buckets). The API still works if you only configure the private bucket name — or your own single bucket like `rewardhub`.

### Quick decision guide

```
Do you already have one S3 bucket (e.g. rewardhub)?
├─ Yes → Set STORAGE_S3_BUCKET=rewardhub + AWS keys + CORS
│         Add CloudFront later when you need public product images
└─ No  → Deploy CDK (§8) to create buckets, IAM user, and CloudFront for you
```

---

## 6. Local dev (no AWS) — start here

**Best for:** everyday coding. No AWS bill, no CDK, no CORS headaches.

### Step 1 — Database

```bash
# from repo root
pnpm db:deploy
```

### Step 2 — API env

In `apps/api/.env`:

```bash
# Do NOT set STORAGE_S3_PRIVATE_BUCKET (or leave it commented out)
```

### Step 3 — Run apps

```bash
pnpm dev
```

### Step 4 — Try an upload

1. Open merchant app → `http://localhost:3003`
2. Go to business verification (KYB)
3. Upload a PDF or image
4. You should see the file reach **Ready**

Files land here on disk:

```text
apps/api/.object-storage/local-private-bucket/
```

**That's it for local dev.** You do not need CDK or AWS CLI.

---

## 7. Local dev with real S3 (optional)

**Best for:** testing presigned uploads, CORS, and production-like behaviour before go-live.

### Option A — use an existing bucket (fastest)

If you already have a bucket (e.g. `rewardhub`):

1. Set `STORAGE_S3_BUCKET=rewardhub` (or `STORAGE_S3_PRIVATE_BUCKET=rewardhub`) in `apps/api/.env`
2. Add AWS credentials with S3 read/write on that bucket
3. Apply CORS (see [§12 Troubleshooting — CORS](#cors-error-in-browser-s3-mode))
4. Set `STORAGE_PROVIDER=s3` and restart the API

KYB uploads and private downloads work immediately. Add CloudFront when you need public product images (§5).

### Option B — let CDK create everything

Follow the full walkthrough in [§8](#8-cdk-deploy-guide--a-to-z-beginner-friendly).

---

## 8. CDK deploy guide — A to Z (beginner friendly)

This section assumes you have **never used AWS CDK before**. By the end you will have S3 buckets, CloudFront, and an IAM user ready for `apps/api/.env`.

Infrastructure code lives in `apps/aws-infrastructure`. One stack per environment:

| Environment | Stack name | Private bucket | Public origin bucket |
|-------------|------------|----------------|----------------------|
| **development** | `StoragePlatform-development` | `app-development-private` | `app-development-public-origin` |
| **staging** | `StoragePlatform-staging` | `app-staging-private` | `app-staging-public-origin` |
| **production** | `StoragePlatform-production` | `app-production-private` | `app-production-public-origin` |

### What is CDK?

**AWS CDK** (Cloud Development Kit) lets you define cloud resources in TypeScript instead of clicking through the AWS Console. When you run `cdk deploy`, CDK turns your code into a **CloudFormation** template and creates/updates resources in your AWS account.

Plain English: you run one command, AWS creates the buckets and permissions for you.

### What CDK creates for you

| Resource | Plain English |
|----------|----------------|
| Private S3 bucket | Uploads land here (`staging/…` → `kyb/`, `products/`, …) |
| Public S3 bucket | Origin for CDN-backed public images (logos, product photos) |
| CloudFront distribution | CDN in front of the public bucket |
| IAM upload user | Dedicated identity for the API (create access keys for `.env`) |
| SQS queues + Lambdas | Background image processing hooks (placeholder scanners) |
| CORS on private bucket | Browser can POST uploads directly to S3 |

Both buckets block public internet access. CloudFront reaches the public bucket via Origin Access Control (OAC).

### Prerequisites checklist

Before you start, confirm:

- [ ] An **AWS account** (not the root user for day-to-day work)
- [ ] **Node.js 22+** (`node -v`)
- [ ] **pnpm** (from repo root: `pnpm install` already done)
- [ ] **AWS CLI v2** installed
- [ ] This repo cloned locally

---

### Step 1 — Install the AWS CLI

**macOS (Homebrew):**

```bash
brew install awscli
```

**Windows:** download the MSI from [AWS CLI install guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).

**Linux:**

```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

Verify:

```bash
aws --version
# aws-cli/2.x.x ...
```

---

### Step 2 — Create an IAM user (if you don't have one)

1. Sign in to the [AWS Console](https://console.aws.amazon.com/) as an admin (not root for daily use).
2. Go to **IAM** → **Users** → **Create user**.
3. Name it e.g. `cdk-deployer`.
4. Attach policy **`AdministratorAccess`** for a first-time dev setup, **or** a tighter custom policy if your org requires it (CDK needs CloudFormation, S3, IAM, Lambda, SQS, CloudFront permissions).
5. Create the user → open it → **Security credentials** → **Create access key** → choose **Command Line Interface (CLI)**.
6. Save the **Access key ID** and **Secret access key** somewhere safe (password manager). You will not see the secret again.

> **Never** put root account keys in `.env` or commit them to git.

---

### Step 3 — Configure the AWS CLI

```bash
aws configure
```

Enter when prompted:

| Prompt | Example |
|--------|---------|
| AWS Access Key ID | `AKIA...` |
| AWS Secret Access Key | `...` |
| Default region name | `ap-southeast-5` (or your region) |
| Default output format | `json` |

Verify you are logged in:

```bash
aws sts get-caller-identity
```

Expected output (your values will differ):

```json
{
  "UserId": "AIDA...",
  "Account": "123456789012",
  "Arn": "arn:aws:iam::123456789012:user/cdk-deployer"
}
```

If this fails, fix credentials before continuing.

---

### Step 4 — Pick your AWS region

The bucket and all resources are created in **one region**. Pick the region closest to your users and keep it consistent everywhere.

```bash
export AWS_REGION=ap-southeast-5          # change if needed
export CDK_DEFAULT_REGION=$AWS_REGION
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)

echo "Deploying to account $CDK_DEFAULT_ACCOUNT in $AWS_REGION"
```

`apps/api/.env` must use the **same** `AWS_REGION` as the bucket.

---

### Step 5 — Install CDK dependencies

From the **repo root**:

```bash
cd apps/aws-infrastructure
pnpm install
```

---

### Step 6 — Bootstrap CDK (one time per account + region)

Bootstrap prepares a staging bucket and IAM roles CDK needs to deploy stacks. It does **not** create your app buckets yet.

```bash
npx cdk bootstrap aws://$CDK_DEFAULT_ACCOUNT/$AWS_REGION
```

Success looks like:

```text
 ✅  Environment aws://123456789012/ap-southeast-5 bootstrapped.
```

Run bootstrap **once** per AWS account per region. If you deploy to `us-east-1` later, bootstrap there too.

---

### Step 7 — Preview changes (optional but recommended)

Synth compiles the stack to CloudFormation **without** creating anything:

```bash
pnpm run synth -- -c environment=development
```

You should see `StoragePlatform-development` in the output and a `cdk.out/` folder. No AWS charges from this step.

To see what would change on an already-deployed stack:

```bash
pnpm run diff -- -c environment=development
```

---

### Step 8 — Deploy the development stack

```bash
pnpm run deploy -- \
  -c environment=development \
  -c browserOrigins=http://localhost:3000,http://localhost:3001,http://localhost:3003
```

> **Important:** use `pnpm run deploy --` (with `--`). `pnpm deploy -c …` is the wrong command — pnpm treats `-c` as its own flag.

What happens:

1. CDK shows a list of resources to create (buckets, CloudFront, IAM user, …)
2. Type **`y`** to approve
3. Wait 5–15 minutes (CloudFront is the slowest part)
4. At the end, CDK prints **Outputs**

**`browserOrigins`** must list every frontend origin that uploads files in the browser (scheme + host + port). CDK writes these into the private bucket CORS rules. Missing origins cause CORS errors in DevTools.

---

### Step 9 — Save stack outputs

Copy the **Outputs** block from the deploy summary, or fetch them later:

```bash
aws cloudformation describe-stacks \
  --stack-name StoragePlatform-development \
  --region $AWS_REGION \
  --query "Stacks[0].Outputs" \
  --output table
```

| Output | Maps to `.env` | Required for API? |
|--------|----------------|-------------------|
| `PrivateBucketName` | `STORAGE_S3_PRIVATE_BUCKET` (or `STORAGE_S3_BUCKET`) | **Yes** |
| `CloudFrontDomain` | `STORAGE_CLOUDFRONT_PUBLIC_DOMAIN` | For public images |
| `PublicOriginBucketName` | `STORAGE_S3_PUBLIC_BUCKET` | Optional (not read by API today) |
| `ApiUploadUserName` | — | Create access keys for this user |

---

### Step 10 — Create API access keys (upload IAM user)

CDK creates an IAM **user** for the API (`ApiUploadUserName` output). It does not create access keys automatically.

1. AWS Console → **IAM** → **Users**
2. Search for the user name from `ApiUploadUserName` (e.g. `StoragePlatform-development-ApiUploadUser-…`)
3. **Security credentials** → **Create access key** → **Application running outside AWS**
4. Copy **Access key ID** → `AWS_ACCESS_KEY_ID`
5. Copy **Secret access key** → `AWS_SECRET_ACCESS_KEY`

These keys go in `apps/api/.env` only — never in frontend env vars.

---

### Step 11 — Configure `apps/api/.env`

Restart the API after any change.

**Minimum (uploads + private KYB):**

```bash
STORAGE_PROVIDER=s3
STORAGE_S3_PRIVATE_BUCKET=app-development-private
AWS_REGION=ap-southeast-5
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

**Full (includes public product images via CDN):**

```bash
STORAGE_PROVIDER=s3
STORAGE_S3_PRIVATE_BUCKET=app-development-private
STORAGE_CLOUDFRONT_PUBLIC_DOMAIN=d123456abcdef.cloudfront.net

AWS_REGION=ap-southeast-5
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

STORAGE_DOWNLOAD_TTL_SECONDS=300
```

`STORAGE_S3_PUBLIC_BUCKET` is optional — the API does not copy files there today. Keep it only if you plan to wire background workers to the CDK public bucket.

See [§9](#9-fill-in-appsapenv) for all env shapes (single bucket, staging, production).

---

### Step 12 — Verify uploads work

```bash
# from repo root
pnpm db:deploy
pnpm dev
```

1. Open merchant app → `http://localhost:3003`
2. Upload a KYB document
3. Confirm status reaches **Ready**
4. In AWS Console → S3 → `app-development-private` → browse `kyb/`

Full checklist: [§11 Test that it works](#11-test-that-it-works).

---

### Deploy to staging

```bash
cd apps/aws-infrastructure

pnpm run deploy -- \
  -c environment=staging \
  -c browserOrigins=https://staging-merchant.example.com,https://staging-admin.example.com
```

Stack name: `StoragePlatform-staging`. Copy outputs into staging `.env` / secrets manager.

---

### Deploy to production

Preview first:

```bash
pnpm run synth -- -c environment=production
pnpm run diff -- -c environment=production
```

Deploy:

```bash
pnpm run deploy -- \
  -c environment=production \
  -c browserOrigins=https://merchant.example.com,https://admin.example.com
```

**Suggested order:** development → staging → production. Run the test checklist on each before promoting.

---

### Updating an existing stack

Change `browserOrigins`, edit `lib/storage-platform-stack.ts`, or bump CDK versions, then:

```bash
pnpm run diff -- -c environment=development    # preview
pnpm run deploy -- -c environment=development  # apply
```

CDK updates only what changed. Buckets use `RemovalPolicy.RETAIN` — deleting the stack does **not** delete bucket data.

---

### Destroying a stack (caution)

```bash
pnpm run cdk destroy StoragePlatform-development
```

This removes CloudFormation-managed resources. S3 buckets may be retained (empty them manually if you need a clean slate). **Do not** run destroy on production unless you mean it.

---

### CloudFront blocked on new AWS accounts?

If deploy fails with:

> *Your account must be verified before you can add new CloudFront resources*

1. Open [AWS Support](https://console.aws.amazon.com/support/home) → request CloudFront account verification
2. **While waiting:** use **local dev mode** (§6) — KYB uploads work without CloudFront
3. Or use a **single existing bucket** (§5, §7 Option A) for S3 uploads until CloudFront is approved

---

### CDK troubleshooting quick reference

| Problem | Fix |
|---------|-----|
| `pnpm deploy -c …` → `unexpected argument '-c'` | Use `pnpm run deploy -- -c …` |
| `Stack … does not exist` | You ran `describe-stacks` before deploy — run Step 8 |
| `Need to perform AWS calls for account …` | Run bootstrap (Step 6) |
| CORS error in browser | Add your origin to `browserOrigins` and redeploy |
| `S3 storage is enabled but AWS_ACCESS_KEY_ID …` | Create keys for `ApiUploadUserName` (Step 10) |
| Bucket name already taken | S3 names are global — change `namePrefix` in `storage-platform-stack.ts` or use your own bucket |

More fixes: [§12 Troubleshooting](#12-troubleshooting).

---

## 9. Fill in `apps/api/.env`

Restart the API after any change.

### Local (no cloud)

```bash
STORAGE_PROVIDER=local
```

### Single existing bucket (e.g. `rewardhub`)

Minimum config — uploads, promotion, and private KYB downloads:

```bash
STORAGE_PROVIDER=s3
STORAGE_S3_BUCKET=rewardhub          # legacy alias; same as STORAGE_S3_PRIVATE_BUCKET
AWS_REGION=ap-southeast-5
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

Add `STORAGE_CLOUDFRONT_PUBLIC_DOMAIN` when you have a CDN in front of `rewardhub` and need public product images to load in the browser.

### Development (CDK stack)

```bash
STORAGE_PROVIDER=s3
STORAGE_S3_PRIVATE_BUCKET=app-development-private
STORAGE_CLOUDFRONT_PUBLIC_DOMAIN=d123456abcdef.cloudfront.net   # for public images

AWS_REGION=ap-southeast-5
AWS_ACCESS_KEY_ID=AKIA...          # from IAM user ApiUploadUser — NOT root
AWS_SECRET_ACCESS_KEY=...

STORAGE_DOWNLOAD_TTL_SECONDS=300
```

`STORAGE_S3_PUBLIC_BUCKET` is optional — the API does not read it today. Include it only if you are aligning with the CDK public-origin bucket for future workers.

### Staging / production

Same shape — swap bucket names, region, and CloudFront domain for that environment:

```bash
STORAGE_PROVIDER=s3
STORAGE_S3_PRIVATE_BUCKET=app-production-private
STORAGE_CLOUDFRONT_PUBLIC_DOMAIN=d123456abcdef.cloudfront.net

AWS_REGION=ap-southeast-5
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

### Development / staging / production (Firebase Storage)

```bash
STORAGE_PROVIDER=firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
STORAGE_PRIVATE_CONTAINER=your-project-id.appspot.com

# Local dev only — path to a service-account JSON key
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
```

On GCP (Cloud Run, GKE, Compute Engine), omit `GOOGLE_APPLICATION_CREDENTIALS` and attach a service account with Storage Object Admin (or a tighter custom role). The Firebase adapter uses Application Default Credentials.

Configure **Firebase Storage CORS** so the browser can `PUT` signed upload URLs:

```json
[
  {
    "origin": ["https://merchant.example.com", "http://localhost:3000"],
    "method": ["PUT", "GET", "HEAD"],
    "responseHeader": ["Content-Type", "x-goog-meta-file-id"],
    "maxAgeSeconds": 3600
  }
]
```

Public assets use per-object Firebase download tokens — never enable anonymous bucket-wide access.

> **Want the full Firebase story?** See [§10 Firebase Storage (ELI5)](#10-firebase-storage-eli5).

### Env var reference

| Variable | Required when | What it does |
|----------|---------------|--------------|
| `STORAGE_PROVIDER` | Recommended | `local`, `s3`, or `firebase` (one per deployment) |
| `STORAGE_PRIVATE_CONTAINER` | Optional | Neutral private container name (aliases to legacy S3 bucket vars) |
| `STORAGE_PUBLIC_CONTAINER` | Public images | Neutral public container name |
| `FIREBASE_PROJECT_ID` | Firebase mode | Firebase / GCP project id |
| `FIREBASE_STORAGE_BUCKET` | Firebase mode | Default Storage bucket (`*.appspot.com`) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Firebase local dev | Path to service-account JSON for ADC |
| `STORAGE_S3_PRIVATE_BUCKET` | S3 mode | Main bucket for all uploads and file moves |
| `STORAGE_S3_BUCKET` | S3 mode | Legacy alias for `STORAGE_S3_PRIVATE_BUCKET` — either one is fine |
| `STORAGE_S3_PUBLIC_BUCKET` | Optional | **Not read by the API today.** Reserved for CDK public-origin alignment |
| `STORAGE_CLOUDFRONT_PUBLIC_DOMAIN` | Public images | CloudFront hostname — required for browser-visible public image URLs |
| `AWS_REGION` | S3 mode | Must match bucket region |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | S3 mode | IAM upload user keys |
| `STORAGE_DOWNLOAD_TTL_SECONDS` | Optional | Signed download link lifetime (default 300) |
| `STORAGE_PHYSICAL_DELETE_DELAY_MS` | Optional | Default 1h dev, 30d production |
| `STORAGE_PROCESSING_CALLBACK_SECRET` | Rare | Only if external workers call `/files/processing-callback` |

**How the API chooses a provider** (`storage.module.ts`):

- `STORAGE_PROVIDER=local|s3|firebase` wins when set
- Otherwise: real `STORAGE_S3_PRIVATE_BUCKET` or `STORAGE_S3_BUCKET` (not `local-*`) → **S3**
- Otherwise → **local** filesystem
- Each stored file row records its provider; cross-provider reads are rejected

---

## 10. Firebase Storage (ELI5)

Firebase mode uses **Google Cloud Storage** under the hood (Firebase Storage is GCS with a friendlier console). Our API talks to it through the **Firebase adapter** — same upload flow as local/S3, different wire format.

### The cast of characters

| Piece | Role | ELI5 |
|-------|------|------|
| **Browser** | Uploads the file | Gets a signed PUT URL, sends bytes directly to Google |
| **API** (`firebase-object-storage.service.ts`) | Translator | Signs URLs, reads/writes objects via `firebase-admin` |
| **Service account** | API's ID badge | Proves the server is allowed to touch the bucket |
| **Firebase bucket** | Filing cabinet | `your-project.appspot.com` — where bytes live |
| **PostgreSQL** | Index card | Remembers path, provider, status — not the bytes |

**What we deliberately do NOT do:**

- Ship Firebase **client** SDK or service-account JSON to the browser
- Make the whole bucket public

### Upload flow (step by step)

```
1. Merchant picks invoice.pdf in the browser
2. Browser → API: "I want to upload" (+ SHA-256 checksum)
3. API creates stored_files row (PENDING)
4. API asks Firebase adapter for a signed PUT ticket
      method: PUT
      uploadUrl: https://storage.googleapis.com/...?X-Goog-Signature=...
      headers: { Content-Type: application/pdf }
5. Browser PUTs the file straight to that URL (not to our API)
6. Browser → API: POST /files/:id/complete
7. API headObject → checks size
8. API downloads bytes (if needed) → verifies SHA-256 checksum
9. Copy staging/… → kyb/… → status READY
```

Same security desk story as §2 — only step 4–5 look different from S3 (PUT instead of multipart POST).

### How the API authenticates (ADC)

**ADC = Application Default Credentials.** Plain English: *"Google, figure out who I am from the environment."*

| Where API runs | How Google knows it's you |
|----------------|---------------------------|
| **Your laptop** | `GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json` |
| **Cloud Run / GKE / GCE** | Attached service account on the VM / pod (no JSON file) |

The adapter calls `applicationDefault()` once at startup. You never paste secrets into React code.

**Service account permissions (minimum):**

- `roles/storage.objectAdmin` on the bucket, **or**
- A custom role with: create/read/update/delete objects, get bucket metadata

### Browser upload ticket (Firebase-specific)

S3 gives the browser a **multipart form** (hidden fields + file input). Firebase gives a **signed PUT URL**:

```text
PUT https://storage.googleapis.com/bucket-name/staging/kyb/.../file.pdf?X-Goog-...
Headers:
  Content-Type: application/pdf
Body:
  <raw file bytes>
```

The API sets `Content-Type` in the signature so the browser can't swap file types mid-upload.

### Private vs public files

| Visibility | How users access it | Firebase mechanism |
|------------|---------------------|-------------------|
| **Private** (KYB docs) | Short-lived signed URL from `GET /files/:id/download-url` | GCS V4 signed read URL (expires in ~5 min) |
| **Public** (product images) | Stable URL stored in `stored_files.public_path` | Per-object `firebaseStorageDownloadTokens` metadata |

For public assets the adapter:

1. Generates a random download token (UUID)
2. Writes it to object metadata (`firebaseStorageDownloadTokens`)
3. Returns URL like `https://firebasestorage.googleapis.com/v0/b/BUCKET/o/PATH?alt=media&token=TOKEN`

Each file gets its **own** token. You don't open the bucket to the whole internet.

### Setup checklist (first time)

1. **Firebase console** → create project → enable Storage → note bucket name (`*.appspot.com`)
2. **GCP console** → IAM → create service account → grant Storage Object Admin → download JSON key
3. **Local `.env`:**
   ```bash
   STORAGE_PROVIDER=firebase
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
   GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/key.json
   ```
4. **CORS** on the bucket (so browser PUT works) — `gsutil cors set cors.json gs://your-bucket`:
   ```json
   [
     {
       "origin": ["http://localhost:3003", "https://merchant.example.com"],
       "method": ["PUT", "GET", "HEAD"],
       "responseHeader": ["Content-Type", "x-goog-meta-file-id"],
       "maxAgeSeconds": 3600
     }
   ]
   ```
5. `pnpm dev` → upload a KYB file → should reach **Ready**

### Production on GCP

- Deploy API to Cloud Run (or similar) with a **service account attached** to the service
- Remove `GOOGLE_APPLICATION_CREDENTIALS` — ADC picks up the runtime identity automatically
- Restrict CORS origins to your real merchant/admin domains
### Firebase troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `FIREBASE_PROJECT_ID is required` | Provider set to firebase but project id missing | Set `FIREBASE_PROJECT_ID` |
| `Could not load the default credentials` | No JSON locally, no attached SA in cloud | Set `GOOGLE_APPLICATION_CREDENTIALS` or attach SA |
| Browser `failed to fetch` on PUT | CORS not configured | Apply bucket CORS (see above) |
| `403` on PUT | Service account can't write | Grant Storage Object Admin |
| Upload completes but checksum fails | Wrong `Content-Type` header | Client must send ticket's `headers.Content-Type` |
### Code pointers

| What | Where |
|------|-------|
| Firebase adapter | `apps/api/src/modules/storage/adapters/firebase/firebase-object-storage.adapter.ts` |
| Provider switch | `apps/api/src/modules/storage/factory/storage-adapter.factory.ts` |
| Client PUT upload | `packages/client/src/lib/storage/direct-upload.ts` (`putSignedUploadToStorage`) |
| Env template | `apps/api/.env.example` → STORAGE — FIREBASE block |

---

## 11. Test that it works

Run this on **local first**, then repeat on staging / production.

### Start services

```bash
pnpm db:deploy
pnpm dev
```

### Merchant upload

1. Log in → merchant app (`:3003`)
2. KYB → upload a PDF or image (≤ 5 MiB)
3. Submit
4. Status should reach **Ready**

### Admin review

1. Log in → admin (`:3001`)
2. Reward Hub → KYB review
3. **View** opens preview, **Download** saves the file

### Success checklist

| Check | Local | S3 | Firebase |
|-------|-------|-----|----------|
| File exists | `apps/api/.object-storage/local-private-bucket/kyb/…` | `aws s3 ls s3://BUCKET/kyb/` | Firebase console → Storage → browse `kyb/` |
| DB row | `stored_files.status = READY` | Same | Same (`storage_provider = firebase`) |
| No CORS errors | N/A | DevTools → Network clean on POST | DevTools → Network clean on PUT |
| API logs | No errors on `POST /files/:id/complete` | Same | Same |

### Legacy KYB documents (one-time migration)

If old documents were stored as base64 in JSON:

```bash
pnpm --filter @workspace/api kyb:backfill -- --dry-run
pnpm --filter @workspace/api kyb:backfill
```

---

## 12. Troubleshooting

### `Stack StoragePlatform-development does not exist`

You ran `aws cloudformation describe-stacks` **before** deploying. Bootstrap ≠ deploy.

Fix: run `pnpm run deploy -- -c environment=development …` (§8).

### `pnpm deploy -c environment=…` → `unexpected argument '-c'`

Wrong command. Use:

```bash
pnpm run deploy -- -c environment=development ...
```

### Upload stuck on "Processing"

| Cause | Fix |
|-------|-----|
| Finalize error | Check API logs for errors on `POST /files/:id/complete` |
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

### Provider is `local` but I set a bucket

Either set `STORAGE_PROVIDER=s3` explicitly, or ensure `STORAGE_S3_PRIVATE_BUCKET` / `STORAGE_S3_BUCKET` is a real bucket name that does **not** start with `local-`.

### Public image URL returns 403

The bucket blocks public access (correct). Direct `https://bucket.s3.region.amazonaws.com/...` URLs will not work.

Fix: set `STORAGE_CLOUDFRONT_PUBLIC_DOMAIN` to a CloudFront distribution that can read the object path, or use private download URLs for non-public categories.

### I only set `STORAGE_S3_BUCKET` — is that enough?

Yes. It resolves to the same private container as `STORAGE_S3_PRIVATE_BUCKET`. You do not need a separate public bucket env var for the API to accept uploads.

### Mass ESLint errors on `@ApiOkResponse` / decorators

Usually a broken `@nestjs/swagger` install (missing `dist/`). Fix:

```bash
pnpm install --force
# or
pnpm --filter @workspace/api add @nestjs/swagger@12.0.1 --force
```

Verify: `ls apps/api/node_modules/@nestjs/swagger/dist/index.js`

### CloudFront deploy failed (new AWS account)

See [CloudFront blocked](#cloudfront-blocked-on-new-aws-accounts) in §8. Use local mode until AWS approves.

### Firebase PUT fails / CORS / credentials

See the [Firebase troubleshooting table](#firebase-troubleshooting) in §10.

---

## 13. Quick cheat sheet

### Commands

```bash
# Database (all environments)
pnpm db:deploy

# Single existing bucket — apps/api/.env only (no CDK)
STORAGE_PROVIDER=s3
STORAGE_S3_BUCKET=rewardhub
AWS_REGION=ap-southeast-5
# + AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY

# CDK bootstrap (once per account/region)
cd apps/aws-infrastructure
export AWS_REGION=ap-southeast-5
export CDK_DEFAULT_REGION=$AWS_REGION
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
npx cdk bootstrap aws://$CDK_DEFAULT_ACCOUNT/$AWS_REGION

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

# KYB backfill
pnpm --filter @workspace/api kyb:backfill -- --dry-run
```

### Code map

| What | Where |
|------|-------|
| `ObjectStorage` port | `apps/api/src/modules/storage/domain/object-storage.port.ts` |
| `PublicDelivery` port | `apps/api/src/modules/storage/domain/public-delivery.port.ts` |
| DI tokens | `apps/api/src/modules/storage/domain/storage.tokens.ts` |
| Provider factory | `apps/api/src/modules/storage/factory/storage-adapter.factory.ts` |
| Nest module | `apps/api/src/modules/storage/storage.module.ts` |
| Locator helpers | `apps/api/src/modules/storage/utils/storage-locator.util.ts` |
| Local adapter | `apps/api/src/modules/storage/adapters/local/local-object-storage.adapter.ts` |
| S3 adapter | `apps/api/src/modules/storage/adapters/s3/s3-object-storage.adapter.ts` |
| Firebase adapter | `apps/api/src/modules/storage/adapters/firebase/firebase-object-storage.adapter.ts` |
| Upload orchestration | `apps/api/src/modules/files/services/file.service.ts` |
| Browser upload client | `packages/client/src/lib/storage/direct-upload.ts` |
| Shared schemas | `packages/shared/src/schemas/domain/storage.ts` |
| CDK stack (S3 only) | `apps/aws-infrastructure/lib/storage-platform-stack.ts` |
| Env template | `apps/api/.env.example` |

### Related docs

- [Getting started](../getting-started.md)
- [apps/aws-infrastructure/README.md](../../apps/aws-infrastructure/README.md)
