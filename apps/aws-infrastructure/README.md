# AWS Storage Platform (CDK)

Creates S3 buckets, virus-scanner Lambda, CloudFront, and API upload credentials — **one stack per environment**.

> **Full ELI5 guide:** [docs/infrastructure/storage.md](../../docs/infrastructure/storage.md)

---

## What you get

| Resource | What it's for |
|----------|----------------|
| Private bucket | Uploads (`staging/…` → `kyb/`, `products/`, … after scan) |
| Public bucket + CloudFront | Product images / logos via CDN |
| ClamAV Lambda | Virus scan (API calls it on upload complete) |
| IAM upload user | AWS keys for the API (S3 + invoke Lambda only) |

---

## Deploy cheat sheet

### 1. One-time bootstrap (per AWS account + region)

```bash
export AWS_REGION=ap-southeast-5
export CDK_DEFAULT_REGION=ap-southeast-5
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)

cd apps/aws-infrastructure
pnpm install
npx cdk bootstrap aws://$CDK_DEFAULT_ACCOUNT/$AWS_REGION
```

Bootstrap ≠ deploy. After bootstrap, stacks still don't exist until step 2.

### 2. Deploy

```bash
cd apps/aws-infrastructure

# Development (localhost apps)
pnpm run deploy -- \
  -c environment=development \
  -c browserOrigins=http://localhost:3000,http://localhost:3001,http://localhost:3003

# Staging
pnpm run deploy -- \
  -c environment=staging \
  -c browserOrigins=https://staging-merchant.example.com,https://staging-admin.example.com

# Production
pnpm run deploy -- \
  -c environment=production \
  -c browserOrigins=https://merchant.example.com,https://admin.example.com
```

Use `pnpm run deploy --` (with `--`). `pnpm deploy -c …` is the wrong command.

### 3. Copy outputs → `apps/api/.env`

```bash
aws cloudformation describe-stacks \
  --stack-name StoragePlatform-development \
  --region ap-southeast-5 \
  --query "Stacks[0].Outputs" \
  --output table
```

| Output | → `.env` variable |
|--------|-------------------|
| `PrivateBucketName` | `STORAGE_S3_PRIVATE_BUCKET` |
| `PublicOriginBucketName` | `STORAGE_S3_PUBLIC_BUCKET` |
| `CloudFrontDomain` | `STORAGE_CLOUDFRONT_PUBLIC_DOMAIN` |
| `ClamAvScannerArn` | `STORAGE_SCANNER_LAMBDA_ARN` |

Create IAM access keys for `ApiUploadUserName` → `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`.

See [env var section](../../docs/infrastructure/storage.md#7-fill-in-appsapenv) in the storage guide.

---

## Prerequisites

- AWS CLI (`aws sts get-caller-identity` works)
- Node.js 22+
- IAM user credentials — **not** root

---

## Preview / test without deploying

```bash
pnpm run synth -- -c environment=development
pnpm test
```

---

## Manual bucket CORS

If you use a bucket **outside** CDK:

```bash
aws s3api put-bucket-cors \
  --bucket YOUR_PRIVATE_BUCKET \
  --region YOUR_REGION \
  --cors-configuration file://config/private-bucket-cors.json
```

---

## CloudFront fails on new accounts?

Some new AWS accounts must be verified before CloudFront works. Open an AWS Support case, or use [local dev mode](../../docs/infrastructure/storage.md#4-local-dev-no-aws--start-here) until approved.
