---
title: "Set up Firebase Storage"
description: "Step by step: Firebase project and bucket, service account and Application Default Credentials, bucket CORS, apps/api/.env variables, verification and troubleshooting."
order: 42
author: "Platform Team"
lastUpdated: 1791072000000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=630&fit=crop"
tags: ["storage", "firebase", "gcs", "setup"]
---

# Set up Firebase Storage

Firebase Storage is Google Cloud Storage (GCS) with a friendlier console. The API talks to it with
`firebase-admin` (`apps/api/src/modules/storage/adapters/firebase/`); the browser never gets Firebase
credentials or the client SDK. Read the [storage overview](./overview.md) first.

## How it differs from S3

| | S3 | Firebase |
| --- | --- | --- |
| Upload ticket | presigned **POST** (multipart form) | V4 signed **PUT** URL with `Content-Type` and `x-goog-meta-*` headers |
| Checksum on upload | enforced by S3 (`x-amz-checksum-sha256`) | verified by the API on `complete` (it downloads and hashes) |
| Private download | presigned GET | V4 signed read URL (`STORAGE_DOWNLOAD_TTL_SECONDS`) |
| Public asset URL | `https://<CloudFront host>/<key>` (copy in the public-origin bucket) | `https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<key>?alt=media&token=<per-object token>` |
| Deleting a public asset | public copy deleted + CloudFront invalidation job | download token revoked (URL stops working at once) |

## Steps

1. **Create the project and bucket.** Firebase console → add project → **Storage** → get started.
   Note the bucket name (`<project-id>.appspot.com` or `<project-id>.firebasestorage.app`).
2. **Create a service account** (GCP console → IAM → Service accounts) and grant it, on that bucket,
   **Storage Object Admin** (`roles/storage.objectAdmin`) — create, read, update metadata, delete
   objects. To sign URLs without a JSON key (on Cloud Run/GKE), also grant it
   **Service Account Token Creator** on itself (`iam.serviceAccounts.signBlob`).
3. **Credentials (Application Default Credentials).**
   - Local: download a JSON key and set `GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/key.json`
     (read by the Google SDK, not by the env schema). Never commit the file.
   - On Google Cloud: attach the service account to the service; no key file.
4. **CORS on the bucket**, so browsers can PUT directly (edit the origins):

   ```json
   [
     {
       "origin": ["http://localhost:3000", "http://localhost:3001", "http://localhost:3003"],
       "method": ["PUT", "GET", "HEAD"],
       "responseHeader": ["Content-Type", "x-goog-meta-file-id", "x-goog-meta-category", "x-goog-meta-uploaded-by-id"],
       "maxAgeSeconds": 3600
     }
   ]
   ```

   ```bash
   gcloud storage buckets update gs://<bucket> --cors-file=cors.json
   ```

5. **Configure the API** and restart it:

   ```bash
   # apps/api/.env
   STORAGE_PROVIDER=firebase
   FIREBASE_PROJECT_ID=<project-id>
   FIREBASE_STORAGE_BUCKET=<project-id>.appspot.com     # also the private container
   GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/key.json
   MALWARE_SCANNER=none
   ```

   `FIREBASE_PROJECT_ID` is required with `STORAGE_PROVIDER=firebase` (the adapter refuses to start
   without it). `STORAGE_PRIVATE_CONTAINER` may name the bucket instead of `FIREBASE_STORAGE_BUCKET`.

## Verify

1. Upload a KYB document or an avatar from the apps. DevTools shows a `PUT` to
   `storage.googleapis.com`.
2. The file reaches `READY` / `NOT_SCANNED`; the object appears under `kyb/` or `users/` in the
   Firebase console, and `staging/` no longer holds it.
3. **Download** in the admin panel opens a signed URL that expires.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `FIREBASE_PROJECT_ID is required when STORAGE_PROVIDER=firebase` | Set it. |
| `Could not load the default credentials` | Set `GOOGLE_APPLICATION_CREDENTIALS` locally or attach a service account in the cloud. |
| Browser `failed to fetch` / CORS error on PUT | Bucket CORS missing the origin or the `x-goog-meta-*` headers. |
| `403` on PUT | Service account lacks object create; or the client changed a signed header (send the ticket's `headers` exactly). |
| `SigningError` / `signBlob` permission denied | Grant Service Account Token Creator, or use a JSON key locally. |
| Checksum mismatch on complete | The uploaded bytes differ from the declared SHA-256 (re-select the file). |

Lifecycle: add a GCS lifecycle rule deleting `staging/` objects after 1 day, matching the S3 stack.
