# AWS Storage Platform (CDK)

Creates S3 buckets, CloudFront and the API's **IAM role** (no IAM users, no access keys; no queues, Lambdas or scanners — the API scans uploads itself) — **one stack per environment**.

> **Full step-by-step guide:** [Set up AWS S3 storage](../../docs/technical/storage/aws-s3.md) (IAM role and trust policies, CORS, CloudFront, `.env`, local-development credentials, verification, troubleshooting).

---

## What you get

| Resource | What it's for |
|----------|----------------|
| Private bucket | All uploads (`staging/…` → `kyb/`, `products/`, … after complete) |
| Public origin bucket + CloudFront | READY public images (logos, banners, product photos, avatars) are copied here by the API and served from the CloudFront domain |
| IAM role `app-<env>-api` | The API's only AWS identity; least-privilege S3 grants plus `cloudfront:CreateInvalidation` on this distribution only; temporary credentials via the AWS SDK default chain |

The API never uses access keys in a deployment: it runs with this role (ECS task role by default) and config validation rejects `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` on a deployed production environment.

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

# Deploy development stack (API runs on ECS/Fargate: default trust)
pnpm run deploy -- \
  -c environment=development \
  -c browserOrigins=http://localhost:3000,http://localhost:3001,http://localhost:3003
```

Use `pnpm run deploy --` (with `--`). `pnpm deploy -c …` is the wrong command.

### Who may assume the API role

| Context | Trust |
|---------|-------|
| `-c apiTrust=ecs-task` (default) | `ecs-tasks.amazonaws.com`, pinned to this account (`aws:SourceAccount`) |
| `-c apiTrust=ec2-instance` | `ec2.amazonaws.com`, pinned to this account; also creates an instance profile |
| `-c apiTrust=eks-irsa -c apiTrustOidcProviderArn=<oidc provider ARN> -c apiTrustServiceAccount=<namespace>:<name>` | The EKS cluster's OIDC provider, one service account, audience `sts.amazonaws.com` |
| `-c apiTrust=aws-role -c apiTrustRoleArn=<role ARN>` | An existing IAM role (`sts:AssumeRole`) |

Invalid or incomplete trust context fails `cdk synth` (`Invalid API role trust …`).

---

## Copy outputs → `apps/api/.env`

```bash
aws cloudformation describe-stacks \
  --stack-name StoragePlatform-development \
  --region $AWS_REGION \
  --query "Stacks[0].Outputs" \
  --output table
```

| Output | → where | Required? |
|--------|---------|-----------|
| `PrivateBucketName` | `STORAGE_PRIVATE_CONTAINER` (or `STORAGE_S3_PRIVATE_BUCKET`) | **Yes** |
| `PublicOriginBucketName` | `STORAGE_PUBLIC_CONTAINER` (or `STORAGE_S3_PUBLIC_BUCKET`) | **Yes** (s3) |
| `CloudFrontDomain` | `STORAGE_CLOUDFRONT_PUBLIC_DOMAIN` | **Yes** (s3) |
| `CloudFrontDistributionId` | `STORAGE_CLOUDFRONT_DISTRIBUTION_ID` (deleted public assets are invalidated in it) | **Yes** (s3) |
| `ApiRoleArn` | ECS `taskRoleArn` / EKS service-account annotation `eks.amazonaws.com/role-arn` / caller profile `role_arn` | **Yes** |
| `ApiInstanceProfileArn` | EC2 instance profile (only with `apiTrust=ec2-instance`) | EC2 only |

**Example API environment (no AWS keys):**

```bash
STORAGE_PROVIDER=s3
STORAGE_PRIVATE_CONTAINER=app-development-private
STORAGE_PUBLIC_CONTAINER=app-development-public-origin
STORAGE_CLOUDFRONT_PUBLIC_DOMAIN=d123456abcdef.cloudfront.net
STORAGE_CLOUDFRONT_DISTRIBUTION_ID=E2QWRUHAPOMQZL
AWS_REGION=ap-southeast-5
```

For local development use an SSO profile (`aws sso login`, `AWS_PROFILE=…`); static keys of a personal identity are tolerated only off a deployed environment — see [Local development credentials](../../docs/technical/storage/aws-s3.md#local-development-credentials).

> **Upgrading a stack that still has the `app-<env>-api-upload` IAM user:** delete that user's access keys first, move the API to `ApiRoleArn`, then deploy (the user is removed).

---

## Using your own buckets instead of CDK

Create a private bucket, a public-origin bucket behind CloudFront (OAC) and an IAM role with the least-privilege policy and the trust policy of your runtime (ECS / EC2 / EKS examples): [Set up AWS S3 → Option B](../../docs/technical/storage/aws-s3.md#option-b--use-existing-buckets).

Apply CORS to the private bucket:

```bash
aws s3api put-bucket-cors \
  --bucket <private-bucket> \
  --region $AWS_REGION \
  --cors-configuration file://config/private-bucket-cors.json
```

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
- AWS CLI v2 (`brew install awscli`, or see the [install guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html))
- A deploy identity that is **not** root — an SSO role: `aws configure sso` then `aws sso login` (details: [Install and sign in to the AWS CLI](../../docs/technical/storage/aws-s3.md#install-and-sign-in-to-the-aws-cli-v2))
- First-time? Follow the full [AWS S3 setup guide](../../docs/technical/storage/aws-s3.md)

---

## Update, promote, destroy

```bash
pnpm run diff   -- -c environment=staging      # review before every staging/production deploy
pnpm run deploy -- -c environment=staging -c browserOrigins=…   # same context as last time
pnpm run cdk -- destroy StoragePlatform-development
```

Promote development → staging → production, verifying uploads on each. Buckets are retained on `destroy` (empty and delete them by hand); never destroy production by accident.

---

## Preview / test without deploying

```bash
pnpm run synth -- -c environment=development
pnpm run diff -- -c environment=development
pnpm test
```

---

## CloudFront fails on new accounts?

Some new AWS accounts must be verified before CloudFront works. Open an AWS Support case, or use [local storage](../../docs/technical/storage/overview.md#pick-a-provider) until approved (S3 storage requires CloudFront for public assets).

---

## Project layout

| Path | Purpose |
|------|---------|
| `bin/app.ts` | CDK app entry — reads `environment` context |
| `lib/storage-platform-stack.ts` | Buckets, CloudFront, API IAM role and its least-privilege policy |
| `lib/api-role-trust.ts` | Validated `apiTrust*` context → the role's trust principal (ECS / EC2 / EKS IRSA / role) |
| `config/private-bucket-cors.json` | CORS template for manual bucket setup |
| `test/storage-platform-stack.test.ts` | Template assertions (no IAM user/keys, least-privilege policy, trust variants) |
