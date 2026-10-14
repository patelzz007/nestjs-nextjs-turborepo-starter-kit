---
title: "Object storage — overview"
description: "How uploads work (ticket → direct upload → verify → scan → promote), file statuses and categories, the provider choice (local, S3, Firebase), the malware scanner and the local driver."
order: 40
author: "Platform Team"
lastUpdated: 1791072000000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=630&fit=crop"
tags: ["storage", "files", "uploads", "s3", "firebase"]
---

# Object storage — overview

Files (KYB documents, product images, store logos/banners, avatars) are stored by **one provider per
deployment**; PostgreSQL keeps only the metadata (`stored_files`). The rules are in
[`rules/20-object-storage.md`](../../../rules/20-object-storage.md). Setup guides:
[AWS S3](./aws-s3.md) · [Firebase Storage](./firebase.md).

## Pick a provider

| `STORAGE_PROVIDER` | Where bytes live | Use for |
| --- | --- | --- |
| `local` | `apps/api/.object-storage/` on the API host, served through the API | Development and offline work. **Rejected** on a deployed production environment (`APP_URL` not localhost). |
| `s3` | AWS S3 (+ CloudFront for public assets) | Deployments on AWS |
| `firebase` | Firebase Storage / Google Cloud Storage | Deployments on Google Cloud |

Unset `STORAGE_PROVIDER` resolves to `s3` when `STORAGE_S3_PRIVATE_BUCKET` / `STORAGE_S3_BUCKET` names a
real bucket (not starting with `local-`), otherwise `local`. `s3` and `firebase` require a private
container (`STORAGE_PRIVATE_CONTAINER`, or an alias: `STORAGE_S3_PRIVATE_BUCKET`, `STORAGE_S3_BUCKET`,
`FIREBASE_STORAGE_BUCKET`). `s3` additionally requires the CloudFront public-origin bucket
(`STORAGE_PUBLIC_CONTAINER`), CDN host (`STORAGE_CLOUDFRONT_PUBLIC_DOMAIN`) and distribution id
(`STORAGE_CLOUDFRONT_DISTRIBUTION_ID`, deleted public assets are invalidated there), and authenticates
with an IAM role only (see [AWS S3](./aws-s3.md)). Each `stored_files` row records its provider and
container, and a deployment refuses to read files recorded under a different provider.

## The upload flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant API
    participant S as Storage (local / S3 / GCS)
    participant Q as storage.scan job (BullMQ)
    B->>API: POST /files/upload-url {category, fileName, mimeType, sizeBytes, checksumSha256}
    API-->>B: fileId + ticket (POST multipart for local/S3, signed PUT for Firebase), expires in 300 s
    B->>S: upload bytes directly (staging/… key)
    B->>API: POST /files/{fileId}/complete {checksumSha256}
    API->>S: HEAD + stream: size, SHA-256, magic bytes vs declared type
    API->>API: PENDING → SCANNING (once; a second complete gets 409)
    API->>Q: scan (inline when Redis is not configured)
    Q->>Q: malware scanner verdict
    Q->>S: copy staging/… → final key (kyb/, products/, users/, stores/)
    Q->>S: public categories: publish (S3 copies to the CloudFront origin bucket)
    Q->>API: READY (bound to product / store / avatar / KYB) — or QUARANTINED / FAILED
    Q->>S: after READY commits: delete the staging/… object
    B->>API: GET /files/{fileId}/download-url → short-lived signed URL (READY only)
```

The staging object is deleted only after the READY transaction commits. If an attempt fails
part-way (a storage or database error, a crashed render), it withdraws what it published and
deletes the copy it made, and the row still names the staging object, so the queue's retry runs
the promotion again from the start. Deleting the staging object first would leave the row
pointing at nothing and fail the retry as "uploaded object is missing".

## Categories

| Category | Visibility | Max size | Types |
| --- | --- | --- | --- |
| `MERCHANT_KYB` | private (signed links only) | 25 MB | PDF, JPEG, PNG, WebP |
| `PRODUCT_IMAGE`, `STORE_BANNER` | public | 25 MB | JPEG, PNG, WebP, AVIF |
| `STORE_LOGO`, `USER_AVATAR` | public | 10 MB | JPEG, PNG, WebP, AVIF — exactly 1:1 (square), at least 256 × 256 |
| `REWARD_IMAGE` | public | 10 MB | JPEG, PNG, WebP, AVIF — exactly 16:9, at least 1920 × 1080 |

Source of truth: `FILE_CATEGORY_POLICIES` in `packages/shared/src/schemas/domain/platform/storage.ts`.
Uploads are a single request; chunked S3 multipart upload (retrying only failed parts) is **not
implemented yet** and is required before allowing much larger files.

## Reward images

Every reward shows 1–10 photos in order (`reward_images`, position 0 is the cover). Shared rules:
`MAX_REWARD_IMAGES` and `FILE_CATEGORY_POLICIES.REWARD_IMAGE.imageRules` in `packages/shared`.

- **Sharp by construction.** Every image is exactly 16:9 (±0.5%) and at least 1920 × 1080 (Full HD).
  The merchant console crops a picked photo to 16:9 in the browser (`ImageCropper` cannot zoom
  in past Full HD; zoomed all the way out it shows the whole photo, centred, the room around it
  filled with a blurred copy of the photo, so a photo too small to fill a Full HD frame is still
  usable whole) and uploads the crop as WebP at its own size, capped at the widest rendition
  (3840 × 2160) and rounded down to whole 16:9 units (`preparedImageSize`), so a larger photo keeps
  its extra detail and a smaller one is never upscaled; the API never trusts that: at `complete` it decodes
  the stored bytes with sharp and answers `400 FILE_IMAGE_DIMENSIONS_INVALID` (wrong shape or too
  small) or `400 FILE_IMAGE_UNREADABLE` before the file can be scanned or used. The width and height
  are recorded on the file (`stored_files.image_width/height`).
- **Renditions.** When the file is promoted to READY the API renders WebP renditions from the
  original (auto-oriented, metadata stripped, Lanczos, quality 85): `THUMBNAIL` 640, `MEDIUM` 1280,
  `LARGE` 1920, `XLARGE` 2560, `UHD` 3840 — only those no wider than the stored original
  (`renditionsForWidth`, read from the stored bytes), so a Full HD upload stops at `LARGE` and is never
  served as an upscaled copy — recorded in `file_variants` with their size and
  published next to the original. `RewardResponse.images[]` carries each image's `url`, size and
  `sources[]`, which clients render as `srcset`/`sizes`, so a phone downloads ~100 KB, not 4K.
  A failed render fails the promotion and withdraws whatever was published.
- **Upload first, then save.** The merchant uploads `REWARD_IMAGE` files to the organization
  (`merchant:manage_rewards`); each goes ticket → upload → complete (pixel check) → scan → READY and
  is bound to nothing (`StoredFileBinding` `NONE`). The reward names them, in order, in
  `imageFileIds` on create or edit (`1`–`10`, no duplicates).
- **Checked on every save.** `RewardRepository` locks the file rows (`FOR UPDATE`) and requires
  each to be the organization's own READY, public, published, live `REWARD_IMAGE` inside the
  reward write's transaction; otherwise `400 REWARD_IMAGES_INVALID`. An edit soft-deletes the
  previous rows and writes the new order. A referrer reward shares its consumer reward's images.
- **Never deleted while in use.** `DELETE /files/:id` takes the same row lock and answers
  `409 FILE_IN_USE_AS_REWARD_IMAGE` while a live reward shows the file, so a save and a delete
  cannot interleave and every reward always has a cover.
- **Readable with the reward.** RLS policies `stored_files_reward_image_read` and
  `file_variants_reward_image_read` let a session read an image's file and rendition rows exactly
  when it can read a live reward showing it (marketplace shoppers, claim holders, members);
  `reward_images` itself follows its reward (`reward_images_read`, plus the API-key principal's
  policies).
- **Downloadable by reviewers.** `GET /admin/rewards/:rewardId/images/:fileId/download`
  (`MANAGE REWARD`, the moderation permission) signs a short-lived URL for the image's original
  upload with `Content-Disposition: attachment`, named after the uploaded file. Only a live image of
  that live reward resolves (`404 REWARD_IMAGE_NOT_FOUND` otherwise), so a reviewer needs no file
  capability in the merchant's organization.
- **Downloadable all at once.** `GET /admin/rewards/:rewardId/images/archive` (`MANAGE REWARD`)
  streams every live image of the reward as one ZIP (`<reward-title>-photos.zip`) of the original
  uploads, in display order, as entries `1-<original name>`, `2-…` (names through
  `sanitizeFileName`, so no entry carries a path). `FileService.createZipArchive` builds it with
  `zipArchiveStream` (`apps/api/src/modules/storage/utils/zip-archive.util.ts`, fflate): entries are
  stored, not recompressed (WebP, JPEG and PDF are compressed already), and each object is opened
  only when the archive reaches it, so memory stays at a chunk or two whatever the photos weigh. A
  reward that does not exist or has no image is a JSON `404 REWARD_IMAGE_NOT_FOUND` before any
  byte is sent; an object missing from storage mid-way aborts the response instead of ending a
  truncated archive. Any other set of already-authorized files (KYB evidence, say) can reuse
  `createZipArchive`.
- Keys: originals at `stores/{organizationId}/reward-images/{fileId}.{ext}`, renditions at
  `stores/{organizationId}/reward-images/{kind}/{fileId}.webp`. Seed photos (4K WebP — above the
  Full HD minimum, so they get every rendition — one folder per
  set, `01` is the cover) live in `apps/api/prisma/seed/assets/reward-images/` with `manifest.json`
  (Unsplash License, credits in `CREDITS.md`); the seed stores, checks and renders them through
  the same `ImageRenditionService`.


## Avatars and store logos

A profile picture (`USER_AVATAR`) and a store logo (`STORE_LOGO`) are square, at least 256 × 256
(`FILE_CATEGORY_POLICIES.<category>.imageRules`), checked like reward images: in the browser
first, then on the stored bytes at `complete` (`400 FILE_IMAGE_DIMENSIONS_INVALID`, "Images must be
1:1 (square)."). Renditions: `THUMBNAIL` 128, `MEDIUM` 256, `LARGE` 512 for both, plus `XLARGE`
1024 for logos — only those no wider than the original.

- **One crop flow everywhere** (`packages/client/src/lib/storage`): `takeImage(file, rules)` reads
  the picked photo (refused / prepared at once / needs a crop), `useImagePick` holds a photo for
  `ImageCropDialog` and releases its bitmap and preview URL, and `ImageSlotField` is the preview
  with upload / replace / remove. Reward photos, avatars and logos all use them; the dialog zooms
  out to the whole photo over a blurred copy of it, so a wide wordmark logo keeps every letter.
- **Avatar:** `ProfileAvatarEditor` (`lib/auth/profile`) on the admin profile page and the web
  account settings; bound to the uploader on READY.
- **Store logo:** `/orgs/{slug}/settings/branding` in the merchant console (`merchant:view_locations`
  to see it, `merchant:manage_locations` to change it — the API's `STORE_LOGO` rule). Bound as the
  organization's `LOGO` asset on READY, replacing the previous one; `GET /orgs/:orgSlug/context`
  returns it as `organization.logo` (`{ fileId, url, sources }` or `null`) and reward responses as
  `organizationLogoUrl` + `organizationLogoSources`, both through `ORGANIZATION_LOGO_ASSETS_SELECT`.
  The upload ticket's `assetType` must match the category (`LOGO` for `STORE_LOGO`, `BANNER` for
  `STORE_BANNER`); a mismatch is a `400`.
- **Served in their renditions.** Avatars (`GET /auth/profile` → `avatar.sources`) and logos carry
  their renditions, smallest first (`ImageSource[]`, `toImageSources`); every place that draws one
  sets `srcset` + `sizes` for the size it is drawn (`UserAvatar`, `EntityAvatar`, `ImageSlotField`,
  `fixedImageSizes`), so a 28 px sidebar avatar downloads the 128 px rendition, not the original.
- **In the app shell.** The sidebar account, the profile menu and the web landing menu show the
  picture through `useOwnAvatar` (`lib/auth/profile`), which reads `GET /auth/profile` — the query
  every avatar upload or removal reloads, so the shell updates at once and after a refresh. A
  restricted session (email or two-factor setup pending) cannot read the profile and shows initials.

## Statuses

| Status | Meaning |
| --- | --- |
| `PENDING` | Ticket issued, upload not confirmed |
| `SCANNING` | Bytes verified, waiting for the scanner; not downloadable, not bound |
| `READY` | Promoted and bound; downloadable. `scanStatus` is `CLEAN` (scanner verdict) or `NOT_SCANNED` (no scanner) |
| `QUARANTINED` | Scanner flagged it; bytes deleted |
| `FAILED` | No verdict after every retry (never treated as clean) |
| `DELETED` | Soft-deleted with `deleted_by`; bytes removed after `STORAGE_PHYSICAL_DELETE_DELAY_MS` (30 days in production, 1 hour elsewhere) |

Every transition is a compare-and-set on the expected current state, so a redelivered job, replayed
callback or racing delete can never move a deleted or quarantined file back to `READY`. Deleting a
file soft-deletes every row pointing at it; submitted KYB evidence is retained
(`409 KYB_EVIDENCE_RETAINED`).

## Malware scanning

`MALWARE_SCANNER` is required and has no default. Today's only value is **`none`**: files still pass
the size, SHA-256 and file-type checks, then become `READY` with scan status `NOT_SCANNED` (recorded,
shown in the API and admin UI, warned about at boot) — never `CLEAN`.

The CDK stack's earlier scanning Lambdas were removed. The planned scanner is **AWS GuardDuty Malware
Protection for S3**: an asynchronous scanner returns `PENDING_EXTERNAL` and its verdict arrives at
`POST /files/processing-callback` (authenticated by `x-storage-callback-secret` =
`STORAGE_PROCESSING_CALLBACK_SECRET`; unset = every callback rejected). Adding it is one adapter for
the `MalwareScanner` port (`apps/api/src/modules/storage/domain/malware-scanner.port.ts`) plus one
`MALWARE_SCANNER` value.

Feature modules react to verdicts through `FileLifecycleListener` providers (for example the KYB
listener moves a review to `ACTION_REQUIRED` when its evidence is infected).

## Where the scan runs

- **With Redis** (always in production): `complete` returns `SCANNING`; a `storage.scan` BullMQ job
  scans and finalizes with retries; the hourly `storage.cleanup` sweep re-dispatches scans without a
  verdict after 30 minutes and performs delayed physical deletes.
- **Without Redis** (local): the scan runs inside the `complete` request, which returns the verdict.

## How the adapters work

Feature code never imports a cloud SDK. `FileService` / `FileFinalizationService` depend on three
ports (`apps/api/src/modules/storage/domain/`); `StorageModule` binds them once at boot from
`STORAGE_PROVIDER`, and everything else injects the token:

| Port (token) | Responsibility | local | s3 | firebase |
| --- | --- | --- | --- | --- |
| `ObjectStorage` (`OBJECT_STORAGE`) | Private objects: upload ticket, head, read/stream, copy, delete, signed download URL | disk + HMAC tokens | private bucket, presigned POST/GET | GCS, V4 signed PUT/GET |
| `PublicDelivery` (`PUBLIC_DELIVERY`) | Publish a READY public asset to a stable URL; withdraw it (reports CDN-cached keys) | serve by file id | copy to the CloudFront origin bucket / delete it | per-object download token / revoke it |
| `CdnCacheInvalidator` (`CDN_CACHE_INVALIDATOR`) | Purge withdrawn keys from the CDN (run by the `storage.cdn-invalidate` job) | none | CloudFront `CreateInvalidation` | none |
| `MalwareScanner` (`MALWARE_SCANNER`) | Verdict for an uploaded object | `none` | `none` | `none` |

What each `ObjectStorage` / `PublicDelivery` method is used for:

| Method | Used when |
| --- | --- |
| `createBrowserUploadTicket` | `POST /files/upload-url`: the browser gets a one-time direct-upload pass |
| `headObject`, `getObjectStream` | `complete`: size, SHA-256 (streamed) and magic bytes are checked |
| `copyObject` | Promotion `staging/…` → final key |
| `deleteObject` | Staging cleanup, quarantine, failed promotion, delayed physical delete |
| `getSignedDownloadUrl` | `GET /files/{fileId}/download-url` (READY only, `STORAGE_DOWNLOAD_TTL_SECONDS`) |
| `publishAsset` / `unpublishAsset` | Public categories on READY / on delete or an uncommitted READY |

Provider SDK types (`S3Client`, `CloudFrontClient`, `firebase-admin`) stay inside
`adapters/<provider>/`, and SDK errors are translated there (a missing object is `null`, never a
provider exception).

### The locator

Every object is addressed by a `StorageObjectLocator` — `provider` (`local` | `s3` | `firebase`),
`container` (bucket), `path` (key) and optional `revision` (ETag / GCS generation). Each
`stored_files` row stores it (`storage_provider`, `storage_container`, `storage_path`,
`object_revision`; the legacy `storage_bucket` / `object_generation` columns are still written).
`utils/storage-locator.util.ts` maps rows ↔ locators and refuses a row recorded under another
provider than the running one: moving files between providers is an explicit migration, never a
silent fallback. Keys are derived server-side (`utils/file-path.util.ts`); the client never names a
path.

### Upload tickets

The flow is identical for every provider; only the ticket's transport differs, and the browser helper
(`uploadFileWithTicket` in `packages/client/src/lib/storage/direct-upload.ts`) switches on
`ticket.method` — pages never branch on the provider:

| Provider | `method` | What the browser sends |
| --- | --- | --- |
| local | `POST_MULTIPART` | form fields `key`, `token`, then the file, to `/files/{fileId}/local-upload` |
| s3 | `POST_MULTIPART` | the presigned POST fields, then the file, to the bucket URL |
| firebase | `PUT` | the raw bytes to the signed URL with the ticket's `headers` |

### Adding a provider

1. Add `adapters/<name>/<name>-object-storage.adapter.ts` implementing `ObjectStorage` and
   `PublicDelivery` (and a `CdnCacheInvalidator` if it fronts a CDN cache).
2. Add the value to `StorageProviderSchema` (`packages/shared`) and `StorageProviderSettingSchema`
   (`apps/api/src/config/api-env.fields.ts`), plus its env variables and cross-field rules.
3. Add one `case` to `factory/storage-adapter.factory.ts` and `factory/cdn-cache-invalidator.factory.ts`
   (the `assertNever` default makes a missing case a compile error).
4. Add a setup page next to this one. `FileService` changes only if the ticket needs a new `method`.

## Local driver security model

The local driver is a development backend (the config rejects it on a deployed production
environment), but it behaves like a presigned-URL provider:

- **Uploads:** `POST /files/{fileId}/local-upload`, multipart with `key` and `token` before the file
  part. The token (HMAC-SHA256, operation `upload`, 5 minutes) binds file id, container, key, size
  limit, MIME type and SHA-256. A token for another file or key → `403`; the file must be PENDING
  (`409` after completion); over the limit → `413`; size, checksum or magic-byte mismatch → `400`.
- **Downloads:** `GET /files/local-download?token=…` — an HMAC capability (operation `download`)
  bound to the file id, container and key, expiring after `STORAGE_DOWNLOAD_TTL_SECONDS`. Forged or
  expired → `403`; the file must still be READY at that key, otherwise `404`. Served with the file's
  own `Content-Type`, `X-Content-Type-Options: nosniff` and a sanitized `Content-Disposition`
  (ASCII fallback plus RFC 5987 `filename*`).
- **Public links are saved as paths.** The local driver saves a public file's link as a path on
  the API (`/api/v1/files/{fileId}[/variants/{kind}]/local-public`), never with the API's address;
  `PublicUrlResolver` (`src/config/public-url.resolver.ts`) joins it to the API's public address
  (`http.publicUrl`) whenever the link is served — profile avatars, store logos, reward images and
  file records alike. A saved picture therefore survives an address change (another Wi-Fi, a
  tunnel, `API_PUBLIC_URL`). S3 and Firebase save absolute CDN URLs, which pass through unchanged.
  The address is never the listen wildcard: with `HOST=0.0.0.0` and no `API_PUBLIC_URL`, development
  uses this machine's LAN address, so a phone (Expo Go) can open the links too. Rows saved before
  this with an address are repaired once by `pnpm --filter @workspace/api
  storage:repair-local-public-paths` (dry run; add `-- --apply`), which touches local-driver rows only.
- **Public assets:** `GET /files/{fileId}/local-public` serves READY public files by id. It plays
  the CDN's role, so it sends the same `Cache-Control: public, max-age=86400` as the CloudFront copy
  (`PUBLIC_ASSET_CACHE_CONTROL`) and is exempt from the credential-guarding `strict` rate limit (the
  `default` limit still applies): a catalog page shows many public images at once. Signed private
  downloads stay `private, no-store`.
- Paths are resolved inside `apps/api/.object-storage`: `..`, `.`, empty segments, backslashes, NUL
  and absolute keys are refused, and the resolved path is re-checked against the root.
- The signing key is generated per process: restarting the API invalidates outstanding links.

## Code map

| What | Where |
| --- | --- |
| HTTP API | `apps/api/src/modules/files/controllers/` |
| Upload policy, finalize, scan, delete | `apps/api/src/modules/files/services/` (`file.service.ts`, `file-finalization.service.ts`) |
| Background work (scan, delayed delete, CDN purge) | `apps/api/src/modules/files/services/storage-task-dispatcher.ts`, `storage-queue.processors.ts` |
| Ports and DI tokens | `apps/api/src/modules/storage/domain/` |
| Provider wiring | `apps/api/src/modules/storage/storage.module.ts`, `factory/` |
| Provider adapters | `apps/api/src/modules/storage/adapters/{local,s3,firebase,cdn,scanners}/` |
| Locators and keys | `apps/api/src/modules/storage/utils/storage-locator.util.ts`, `file-path.util.ts` |
| Categories, sizes, types | `packages/shared/src/schemas/domain/platform/storage.ts` |
| Browser upload helper | `packages/client/src/lib/storage/direct-upload.ts` |
| CDK stack (S3) | `apps/aws-infrastructure/lib/storage-platform-stack.ts` |
| API reference | [Files API](../api-reference/files.md) |
