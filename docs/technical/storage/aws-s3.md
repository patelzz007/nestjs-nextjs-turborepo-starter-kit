---
title: "Set up AWS S3 storage"
description: "Step by step: deploy the CDK storage stack (or use your own buckets), the API IAM role and its trust policy (ECS, EC2, EKS), CORS, CloudFront public delivery, the exact apps/api/.env variables, local-development credentials, verification and troubleshooting."
order: 41
author: "Platform Team"
lastUpdated: 1791072000000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=630&fit=crop"
tags: ["storage", "s3", "aws", "cdk", "setup"]
---

# Set up AWS S3 storage

Read the [storage overview](./overview.md) first. Offline or without an AWS account, keep
`STORAGE_PROVIDER=local`.

> [!IMPORTANT]
> **The API authenticates to AWS with an IAM role, never with an IAM user's access keys.** The S3
> client is built without credentials; the AWS SDK default credential chain resolves temporary role
> credentials (ECS task role, EC2 instance profile, EKS IRSA / Pod Identity) and refreshes them.
> `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` are **rejected** by config validation on a deployed
> production environment (`NODE_ENV=production` and `APP_URL` not localhost); they are tolerated only
> for local development (see [Local development credentials](#local-development-credentials)).

## What you need

- An AWS account and the AWS CLI configured with a **deploy identity that is not root** (preferably
  an SSO role: `aws sso login`; `aws sts get-caller-identity` works).
- A region (examples use `ap-southeast-1`, the API's default `AWS_REGION`).
- The browser origins of your apps (for CORS), e.g. `https://app.example.com,https://admin.example.com,https://merchant.example.com`.
- Where the API runs: ECS/Fargate, EC2 or EKS — this decides who may assume the API role.
- Node.js 22+ and `pnpm install` done at the repository root.

### Install and sign in to the AWS CLI (v2)

```bash
brew install awscli                                   # macOS
# Linux:
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip && unzip awscliv2.zip && sudo ./aws/install
# Windows: the MSI from https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
aws --version                                         # aws-cli/2.x
```

Sign in with IAM Identity Center (SSO) rather than creating access keys for yourself:

```bash
aws configure sso --profile platform-dev    # SSO start URL, region, account, permission set
aws sso login --profile platform-dev
export AWS_PROFILE=platform-dev
aws sts get-caller-identity                 # shows an assumed-role ARN, not a user
```

The permission set must be allowed to deploy CloudFormation stacks (after `cdk bootstrap`, deploying
mainly means assuming the `cdk-hnb659fds-*` roles bootstrap creates). Pick one region close to your
users and use it everywhere: the stack, `CDK_DEFAULT_REGION` and the API's `AWS_REGION`.

## Option A — deploy the CDK stack (recommended)

`apps/aws-infrastructure` defines one stack per environment, `StoragePlatform-<environment>`. It
creates, for a name prefix `app-<environment>`:

| Resource | Details |
| --- | --- |
| Private bucket `app-<env>-private` | All uploads. Block-all public access, SSL only, versioned, SSE-S3, CORS for your origins (POST/PUT/GET/HEAD, exposes `ETag`, `x-amz-checksum-sha256`, `x-amz-version-id`), lifecycle: `staging/` objects expire after 1 day, non-current versions after 30 days, incomplete multipart uploads after 7 days. Retained on stack deletion. |
| Public origin bucket `app-<env>-public-origin` | Receives a copy of every READY public asset. Block-all public access; only CloudFront reads it (Origin Access Control). Retained on deletion. |
| CloudFront distribution | HTTPS-only, TLS 1.2+, optimized caching, GET/HEAD/OPTIONS |
| IAM role `app-<env>-api` | The API's only AWS identity (1-hour sessions). Trust: see below. No IAM user and no access key exist anywhere in the stack. |
| Instance profile `app-<env>-api` | Only with `-c apiTrust=ec2-instance` |

The role's permissions are exactly what the S3 adapter calls:

| Statement | Actions | Resources |
| --- | --- | --- |
| `PrivateBucketObjects` | `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` | private bucket `staging/*`, `kyb/*`, `products/*`, `stores/*`, `users/*` |
| `PrivateBucketMissingKeyAs404` | `s3:ListBucket` | private bucket (so a missing key answers 404, not 403) |
| `PublicOriginPublish` | `s3:PutObject`, `s3:DeleteObject` | public-origin bucket `products/*`, `stores/*`, `users/*` (public categories only) |
| `PublicCdnInvalidation` | `cloudfront:CreateInvalidation` | this stack's distribution only |

PutObject covers uploads, presigned POST tickets and copy destinations; GetObject covers downloads,
HeadObject, presigned GET and copy sources. Presigned URLs are signed with the role's temporary
credentials (they carry `X-Amz-Security-Token`), so a URL stops working when its signing session
expires, and it can never grant more than these statements.

### Choose who assumes the role (`apiTrust` context)

| `-c apiTrust=` | Trust principal | Extra context |
| --- | --- | --- |
| `ecs-task` (default) | `ecs-tasks.amazonaws.com`, condition `aws:SourceAccount` = this account | — set the role as the task definition's **task role** (`taskRoleArn`) |
| `ec2-instance` | `ec2.amazonaws.com`, condition `aws:SourceAccount` | — the stack also creates an instance profile (`ApiInstanceProfileArn` output) to attach to the instances |
| `eks-irsa` | the cluster's OIDC provider (`sts:AssumeRoleWithWebIdentity`), pinned to one service account and the `sts.amazonaws.com` audience | `-c apiTrustOidcProviderArn=arn:aws:iam::<account>:oidc-provider/oidc.eks.<region>.amazonaws.com/id/<id>` `-c apiTrustServiceAccount=<namespace>:<service-account>` |
| `aws-role` | an existing IAM role ARN (`sts:AssumeRole`) | `-c apiTrustRoleArn=arn:aws:iam::<account>:role/<name>` |

The context is validated at synth time: an unknown kind, a missing or malformed ARN or service
account stops `cdk synth` with `Invalid API role trust …`.

```bash
export AWS_REGION=ap-southeast-1
export CDK_DEFAULT_REGION=$AWS_REGION
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)

cd apps/aws-infrastructure
npx cdk bootstrap aws://$CDK_DEFAULT_ACCOUNT/$AWS_REGION        # once per account + region
pnpm run synth -- -c environment=development                     # preview (optional)
pnpm run diff  -- -c environment=development
pnpm run deploy -- -c environment=development \
  -c browserOrigins=http://localhost:3000,http://localhost:3001,http://localhost:3003
# EKS instead of ECS:
#   -c apiTrust=eks-irsa -c apiTrustOidcProviderArn=arn:aws:iam::123456789012:oidc-provider/oidc.eks.ap-southeast-1.amazonaws.com/id/EXAMPLE \
#   -c apiTrustServiceAccount=platform:storage-api
```

`cdk bootstrap` prepares the account and region for CDK (an assets bucket and deployment roles);
it creates none of the storage resources and is needed once per account + region. `synth` turns the
TypeScript stack into a CloudFormation template; `diff` shows what a deploy would change.

Use `pnpm run deploy -- …` (with `--`); `pnpm deploy -c …` is a different pnpm command. Without
`browserOrigins` the CORS rule allows the three localhost origins only. For staging/production pass
`-c environment=staging|production` and the real origins.

> [!NOTE]
> Stacks deployed before this change contain an IAM user `app-<env>-api-upload`. Deploying the new
> template deletes that user; delete its access keys first (`aws iam list-access-keys --user-name …`),
> switch the API to the role, then deploy.

Read the outputs:

```bash
aws cloudformation describe-stacks --stack-name StoragePlatform-development \
  --region $AWS_REGION --query "Stacks[0].Outputs" --output table
```

| Output | Goes to |
| --- | --- |
| `PrivateBucketName` | `STORAGE_PRIVATE_CONTAINER` (or `STORAGE_S3_PRIVATE_BUCKET`) |
| `PublicOriginBucketName` | `STORAGE_PUBLIC_CONTAINER` (or `STORAGE_S3_PUBLIC_BUCKET`) |
| `CloudFrontDomain` | `STORAGE_CLOUDFRONT_PUBLIC_DOMAIN` |
| `CloudFrontDistributionId` | `STORAGE_CLOUDFRONT_DISTRIBUTION_ID` |
| `ApiRoleArn` | ECS task definition `taskRoleArn` · EKS service account annotation `eks.amazonaws.com/role-arn` · the `role_arn` of an `aws-role` caller's profile |
| `ApiInstanceProfileArn` (EC2 only) | the API instances' instance profile |

### Update or destroy a stack

```bash
pnpm run diff   -- -c environment=development    # review first (always for staging/production)
pnpm run deploy -- -c environment=development    # applies only what changed
pnpm run cdk -- destroy StoragePlatform-development
```

Pass the same context (`browserOrigins`, `apiTrust*`) on every deploy, or the stack reverts to the
defaults. Promote changes development → staging → production, running [Verify](#verify) on each.
Both buckets use `RemovalPolicy.RETAIN`: `destroy` deletes the distribution, the role and the policies
but keeps the buckets and their objects (empty and delete them by hand for a clean slate). Do not
destroy production.

## Option B — use existing buckets

1. Two buckets: a private one for uploads and a public-origin one for CloudFront. Block all public
   access on both, enable default encryption (SSE-S3) and, ideally, versioning.
2. Apply CORS to the private bucket (edit the origins first):

   ```bash
   aws s3api put-bucket-cors --bucket <private-bucket> --region $AWS_REGION \
     --cors-configuration file://apps/aws-infrastructure/config/private-bucket-cors.json
   ```

3. Put a CloudFront distribution with Origin Access Control in front of the public-origin bucket.
4. Create an IAM **role** for the API with this permissions policy:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PrivateBucketObjects",
         "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
         "Resource": [
           "arn:aws:s3:::<private-bucket>/staging/*",
           "arn:aws:s3:::<private-bucket>/kyb/*",
           "arn:aws:s3:::<private-bucket>/products/*",
           "arn:aws:s3:::<private-bucket>/stores/*",
           "arn:aws:s3:::<private-bucket>/users/*"
         ]
       },
       { "Sid": "PrivateBucketMissingKeyAs404", "Effect": "Allow", "Action": "s3:ListBucket", "Resource": "arn:aws:s3:::<private-bucket>" },
       {
         "Sid": "PublicOriginPublish",
         "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:DeleteObject"],
         "Resource": [
           "arn:aws:s3:::<public-origin-bucket>/products/*",
           "arn:aws:s3:::<public-origin-bucket>/stores/*",
           "arn:aws:s3:::<public-origin-bucket>/users/*"
         ]
       },
       {
         "Sid": "PublicCdnInvalidation",
         "Effect": "Allow",
         "Action": "cloudfront:CreateInvalidation",
         "Resource": "arn:aws:cloudfront::<account>:distribution/<distribution-id>"
       }
     ]
   }
   ```

5. Give the role the trust policy of your runtime (replace `<account>`, `<region>`, `<oidc-id>`):

   **ECS / Fargate task role**

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": { "Service": "ecs-tasks.amazonaws.com" },
         "Action": "sts:AssumeRole",
         "Condition": { "StringEquals": { "aws:SourceAccount": "<account>" } }
       }
     ]
   }
   ```

   **EC2 instance profile** (then `aws iam create-instance-profile` + `add-role-to-instance-profile`)

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": { "Service": "ec2.amazonaws.com" },
         "Action": "sts:AssumeRole",
         "Condition": { "StringEquals": { "aws:SourceAccount": "<account>" } }
       }
     ]
   }
   ```

   **EKS IAM Roles for Service Accounts (IRSA)** — annotate the API's service account with
   `eks.amazonaws.com/role-arn: <role ARN>`:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": { "Federated": "arn:aws:iam::<account>:oidc-provider/oidc.eks.<region>.amazonaws.com/id/<oidc-id>" },
         "Action": "sts:AssumeRoleWithWebIdentity",
         "Condition": {
           "StringEquals": {
             "oidc.eks.<region>.amazonaws.com/id/<oidc-id>:sub": "system:serviceaccount:<namespace>:<service-account>",
             "oidc.eks.<region>.amazonaws.com/id/<oidc-id>:aud": "sts.amazonaws.com"
           }
         }
       }
     ]
   }
   ```

   (EKS Pod Identity works too: trust `pods.eks.amazonaws.com` with `sts:AssumeRole` + `sts:TagSession`
   and create a pod identity association; the SDK picks the credentials up the same way.)

## Configure the API

```bash
# apps/api/.env (or the task/pod environment)
STORAGE_PROVIDER=s3
STORAGE_PRIVATE_CONTAINER=app-development-private              # or STORAGE_S3_PRIVATE_BUCKET / legacy STORAGE_S3_BUCKET
STORAGE_PUBLIC_CONTAINER=app-development-public-origin         # or STORAGE_S3_PUBLIC_BUCKET — required for s3
STORAGE_CLOUDFRONT_PUBLIC_DOMAIN=d123456abcdef.cloudfront.net  # bare host, required for s3
STORAGE_CLOUDFRONT_DISTRIBUTION_ID=E2QWRUHAPOMQZL               # required for s3 (cache purge on delete)
AWS_REGION=ap-southeast-1
MALWARE_SCANNER=none
# optional
STORAGE_DOWNLOAD_TTL_SECONDS=300
STORAGE_PHYSICAL_DELETE_DELAY_MS=2592000000
# NO AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY: the role provides credentials.
```

Config validation stops the API at boot when, with `STORAGE_PROVIDER=s3`:

- the public container is missing or equals the private container (`STORAGE_PUBLIC_CONTAINER`);
- `STORAGE_CLOUDFRONT_PUBLIC_DOMAIN` is missing, or is not a bare host (`https://…` or a path is rejected);
- `STORAGE_CLOUDFRONT_DISTRIBUTION_ID` is missing or is not a distribution id (upper-case alphanumerics, not an ARN);
- on a deployed production environment, `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` is set
  (whatever the provider).

Restart the API after editing `.env` (it is read once at boot). The frontends need no storage
variables: they receive upload tickets from the API.

## Local development credentials

The same default chain runs on a laptop; pick one, in order of preference:

1. **SSO profile** (no long-lived secret on disk): `aws configure sso`, `aws sso login --profile <p>`,
   then `AWS_PROFILE=<p>` in `apps/api/.env` or your shell.
2. **Assume the API role from your profile**: a profile with `role_arn = <ApiRoleArn>` and
   `source_profile = <your SSO profile>` (requires `-c apiTrust=aws-role -c apiTrustRoleArn=<your role>`
   on a development stack).
3. **Static keys of a personal, least-privilege identity** — `AWS_ACCESS_KEY_ID` +
   `AWS_SECRET_ACCESS_KEY` (both or neither) in `apps/api/.env`. Development only: accepted while
   `NODE_ENV` is not `production` or `APP_URL` is localhost; rejected on every deployed production
   environment. Never create keys for the API role or for a shared user.

## Public assets and CloudFront

Every upload is written to the **private container**. When a public file (`PRODUCT_IMAGE`,
`STORE_LOGO`, `STORE_BANNER`, `USER_AVATAR`) becomes READY:

1. the staging object is promoted to its final key in the private bucket (`products/…`, `stores/…`, `users/…`);
2. the adapter copies that object into the **public-origin bucket** under the same key
   (`CopyObject`, `Content-Type` of the file, `Content-Disposition: inline`,
   `Cache-Control: public, max-age=86400`, SSE-S3);
3. the file's `publicUrl` is `https://<STORAGE_CLOUDFRONT_PUBLIC_DOMAIN>/<key>`, served by CloudFront
   through Origin Access Control.

If the READY transition does not commit (the file was deleted meanwhile, or its product disappeared),
the public copy is withdrawn together with the promoted object (its URL was never returned, so
nothing can be cached). Deleting a public file:

1. deletes the public-origin copy inside the request (the private original stays until
   `STORAGE_PHYSICAL_DELETE_DELAY_MS` elapses);
2. enqueues a `storage.cdn-invalidate` job (BullMQ, 8 attempts, exponential backoff from 5 s) that
   creates a CloudFront invalidation for `/<key>` on `STORAGE_CLOUDFRONT_DISTRIBUTION_ID`, signed with
   the role's credentials. The request never waits for CloudFront; the invalidation's
   `CallerReference` is per file, so a retry after a lost response is the same invalidation. Without
   Redis (local development) the invalidation runs inside the request.

CloudFront stops serving the key once the invalidation completes (typically within minutes). A
browser that already downloaded the image keeps its copy until `max-age` (one day) expires.

Private files (`MERCHANT_KYB`) never leave the private bucket; they are served through presigned GET
URLs only.

## Verify

1. `pnpm dev`, sign in to the merchant portal as `brew.owner@kl-rewards.demo`.
2. **Settings → Verification**, upload a PDF. The browser POSTs straight to
   `https://<bucket>.s3.<region>.amazonaws.com/` (DevTools → Network); the form fields include
   `X-Amz-Security-Token` when the API runs with role or SSO credentials.
3. The document reaches READY with scan status `NOT_SCANNED` (with `MALWARE_SCANNER=none`); in the
   admin panel, **Merchants → Verification → Download** opens a presigned URL.
4. `aws s3 ls s3://<private-bucket>/kyb/ --recursive` shows the promoted object; `staging/` is empty
   or expires within a day.
5. Upload a product image: `aws s3 ls s3://<public-origin-bucket>/products/ --recursive` shows the
   copy and its `publicUrl` (`https://<cloudfront-domain>/products/…`) loads in the browser.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `AWS_ACCESS_KEY_ID: must not be set on a deployed production environment …` | Remove the keys; give the task/instance/pod the API role (`ApiRoleArn`). |
| `STORAGE_PUBLIC_CONTAINER: is required when STORAGE_PROVIDER=s3 …` / `STORAGE_CLOUDFRONT_PUBLIC_DOMAIN: is required …` | Set both from the stack outputs `PublicOriginBucketName` and `CloudFrontDomain`. |
| `CredentialsProviderError: Could not load credentials from any providers` | No role reached the process: check the ECS `taskRoleArn`, the instance profile, or the IRSA service-account annotation; locally run `aws sso login` or set `AWS_PROFILE`. |
| `NoSuchBucket` | Bucket name or region wrong (`AWS_REGION` must be the buckets' region). Offline? Set `STORAGE_PROVIDER=local`. |
| Browser CORS error on upload | Bucket CORS does not list the app origin: redeploy with `-c browserOrigins=…` or re-run `put-bucket-cors`. |
| `AccessDenied` on upload/complete/publish | The role's policy misses a prefix or the public-origin statement; compare with the table above. |
| `Invalid API role trust …` during `cdk synth` | Fix the `apiTrust*` context (kind, ARN or `namespace:service-account`). |
| Provider stays `local` | `STORAGE_PROVIDER` unset and the bucket name starts with `local-` (or none set). Set `STORAGE_PROVIDER=s3`. |
| Upload stuck in `SCANNING` | Redis/BullMQ not processing: check the API log and Bull Board (`http://localhost:3030`); `BULLMQ_PREFIX` must match between API instances. |
| Checksum mismatch on complete | The client must send the ticket's fields exactly, including `x-amz-checksum-sha256`. |
| `storage.cdn-invalidate` jobs failing (Bull Board) | The role lacks `cloudfront:CreateInvalidation` on that distribution, or `STORAGE_CLOUDFRONT_DISTRIBUTION_ID` names another distribution. |
| Public image 403 from CloudFront | The object is not in the public-origin bucket (file not READY, or withdrawn), or the distribution's OAC/bucket policy was changed. |
| `Stack StoragePlatform-development does not exist` | You ran `describe-stacks` before `deploy`. |
| `Need to perform AWS calls for account …` / `SSM parameter /cdk-bootstrap/… not found` | Run `cdk bootstrap` for that account + region. |
| `… already exists` for a bucket | S3 bucket names are global: change the `app-<env>` name prefix in `storage-platform-stack.ts` (or use Option B). |
| `ExpiredToken` / `The SSO session … has expired` | `aws sso login --profile <profile>`. |
| CloudFront creation fails on a new account | New AWS accounts may need verification by AWS Support before CloudFront works; keep `STORAGE_PROVIDER=local` until then. |
