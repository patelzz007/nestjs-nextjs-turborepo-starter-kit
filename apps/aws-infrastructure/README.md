# AWS Storage Platform (CDK)

Creates S3 buckets, CloudFront, virus-scanner Lambda hooks, and API upload credentials — **one stack per environment**.

> **Full beginner guide (A to Z):** [docs/infrastructure/storage.md §8](../../docs/infrastructure/storage.md#8-cdk-deploy-guide--a-to-z-beginner-friendly)

---

## What you get

| Resource | What it's for |
|----------|----------------|
| Private bucket | All uploads (`staging/…` → `kyb/`, `products/`, … after complete) |
| Public bucket + CloudFront | CDN origin for public images (logos, product photos) |
| IAM upload user | AWS keys for the API (S3 upload/download) |

> **Note:** The API stores all files in the **private** bucket name you configure. `STORAGE_S3_PUBLIC_BUCKET` is optional and not read by the API today — see [One bucket vs two buckets](../../docs/infrastructure/storage.md#5-one-bucket-vs-two-buckets-s3).

---

## Quick start (already have AWS CLI configured)

```bash
export AWS_REGION=ap-southeast-5
export CDK_DEFAULT_REGION=$AWS_REGION
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)

cd apps/aws-infrastructure
pnpm install

# One time per account + region
npx cdk bootstrap aws://$CDK_DEFAULT_ACCOUNT/$AWS_REGION

# Deploy development stack
pnpm run deploy -- \
  -c environment=development \
  -c browserOrigins=http://localhost:3000,http://localhost:3001,http://localhost:3003
```

Use `pnpm run deploy --` (with `--`). `pnpm deploy -c …` is the wrong command.

---

## Copy outputs → `apps/api/.env`

```bash
aws cloudformation describe-stacks \
  --stack-name StoragePlatform-development \
  --region $AWS_REGION \
  --query "Stacks[0].Outputs" \
  --output table
```

| Output | → `.env` variable | Required? |
|--------|-------------------|-----------|
| `PrivateBucketName` | `STORAGE_S3_PRIVATE_BUCKET` or `STORAGE_S3_BUCKET` | **Yes** |
| `CloudFrontDomain` | `STORAGE_CLOUDFRONT_PUBLIC_DOMAIN` | For public images |
| `PublicOriginBucketName` | `STORAGE_S3_PUBLIC_BUCKET` | Optional (not read by API today) |
| `ApiUploadUserName` | — | Create access keys → `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` |

**Example `.env`:**

```bash
STORAGE_PROVIDER=s3
STORAGE_S3_PRIVATE_BUCKET=app-development-private
STORAGE_CLOUDFRONT_PUBLIC_DOMAIN=d123456abcdef.cloudfront.net
AWS_REGION=ap-southeast-5
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

---

## Using your own bucket instead of CDK

If you already have a bucket (e.g. `rewardhub`), you can skip CDK entirely:

```bash
STORAGE_PROVIDER=s3
STORAGE_S3_BUCKET=rewardhub
AWS_REGION=ap-southeast-5
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

Apply CORS manually:

```bash
aws s3api put-bucket-cors \
  --bucket rewardhub \
  --region $AWS_REGION \
  --cors-configuration file://config/private-bucket-cors.json
```

See [storage.md §5](../../docs/infrastructure/storage.md#5-one-bucket-vs-two-buckets-s3) and [§7 Option A](../../docs/infrastructure/storage.md#7-local-dev-with-real-s3-optional).

---

## Environments

| Environment | Stack name | Deploy command flag |
|-------------|------------|---------------------|
| development | `StoragePlatform-development` | `-c environment=development` |
| staging | `StoragePlatform-staging` | `-c environment=staging` |
| production | `StoragePlatform-production` | `-c environment=production` |

**Staging:**

```bash
pnpm run deploy -- \
  -c environment=staging \
  -c browserOrigins=https://staging-merchant.example.com,https://staging-admin.example.com
```

**Production:**

```bash
pnpm run synth -- -c environment=production   # preview
pnpm run deploy -- \
  -c environment=production \
  -c browserOrigins=https://merchant.example.com,https://admin.example.com
```

---

## Prerequisites

- AWS account with CLI access (`aws sts get-caller-identity` works)
- Node.js 22+
- IAM user credentials for deploy — **not** root
- First-time? Follow the full [A–Z CDK guide](../../docs/infrastructure/storage.md#8-cdk-deploy-guide--a-to-z-beginner-friendly)

---

## Preview / test without deploying

```bash
pnpm run synth -- -c environment=development
pnpm run diff -- -c environment=development
pnpm test
```

---

## CloudFront fails on new accounts?

Some new AWS accounts must be verified before CloudFront works. Open an AWS Support case, or use [local dev mode](../../docs/infrastructure/storage.md#6-local-dev-no-aws--start-here) / a [single existing bucket](../../docs/infrastructure/storage.md#5-one-bucket-vs-two-buckets-s3) until approved.

---

## Project layout

| Path | Purpose |
|------|---------|
| `bin/app.ts` | CDK app entry — reads `environment` context |
| `lib/storage-platform-stack.ts` | Buckets, CloudFront, IAM, queues, Lambdas |
| `config/private-bucket-cors.json` | CORS template for manual bucket setup |
| `test/storage-platform-stack.test.ts` | Synth snapshot tests |
