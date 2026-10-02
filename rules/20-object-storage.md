# 20 — Object Storage (S3 / Firebase Storage)

## Principle

File/media storage goes through a dedicated storage adapter in `packages/database` or a dedicated `packages/storage` package — never direct, ad hoc SDK calls scattered through controllers or components.

```ts
export interface ObjectStorage {
  upload(input: { key: string; body: Buffer | Readable; contentType: string }): Promise<{ key: string }>;
  getSignedDownloadUrl(key: string, expiresInSeconds: number): Promise<string>;
  getSignedUploadUrl(key: string, contentType: string, expiresInSeconds: number): Promise<string>;
  initiateMultipartUpload(key: string, contentType: string): Promise<MultipartUploadSession>;
  delete(key: string): Promise<void>;
}
```

```text
❌ DON'T — a controller calling the AWS SDK directly:
   const s3 = new S3Client({ ... });
   await s3.send(new PutObjectCommand({ Bucket: '...', Key: '...', Body: file }));
   → every feature that touches storage now has its OWN copy of retry
     logic, error handling, and provider-specific config, and switching
     providers later means touching every one of them.

✅ DO — depend on the ObjectStorage interface; swapping S3 for Firebase
   Storage later means writing one new adapter, not touching every
   feature that uploads a file.
```

This is exactly the kind of narrow, stable-contract abstraction `00-non-negotiables.md` and `21-oop-and-solid-principles.md` (Dependency Inversion) call for.

## Multipart upload — mandatory for large files

Any file upload beyond a small threshold (a reasonable default: anything over roughly 10MB, adjust per the provider's own multipart guidance) uses multipart/chunked upload, never a single whole-file `PUT`. This is non-negotiable for large files, for one concrete, high-value reason: **if a single-shot upload fails partway through — a dropped connection on a flaky mobile network, a timeout — the entire file has to be re-uploaded from byte zero.** With multipart upload, the file is split into chunks, each chunk is uploaded (and can be retried) independently, and only the chunks that actually failed need to be retried — not the whole file.

```text
❌ DON'T — single-shot upload of a large file:
   await s3.putObject({ Bucket, Key, Body: entireFileBuffer });
   → a user on a spotty connection uploading a 200MB video has to
     restart the ENTIRE upload from scratch every time the connection
     blips, which on a bad connection may never successfully complete at all.

✅ DO — multipart upload: split into chunks (e.g. 5–10MB each), upload
   each part independently, retry only the parts that failed, then
   complete the multipart upload once all parts have succeeded.
```

```ts
// Conceptual flow — actual SDK calls vary by provider (S3's
// CreateMultipartUpload/UploadPart/CompleteMultipartUpload, or
// Firebase's resumable upload sessions, which provide equivalent
// chunk-level resume semantics)

export class S3ObjectStorage implements ObjectStorage {
  public async initiateMultipartUpload(key: string, contentType: string): Promise<MultipartUploadSession> {
    const { UploadId } = await this.client.send(new CreateMultipartUploadCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }));
    return { uploadId: UploadId, key };
  }

  public async uploadPart(session: MultipartUploadSession, partNumber: number, chunk: Buffer): Promise<{ etag: string }> {
    const { ETag } = await this.client.send(new UploadPartCommand({
      Bucket: this.bucket, Key: session.key, UploadId: session.uploadId, PartNumber: partNumber, Body: chunk,
    }));
    return { etag: ETag };
  }

  public async completeMultipartUpload(session: MultipartUploadSession, parts: readonly { partNumber: number; etag: string }[]): Promise<{ key: string }> {
    await this.client.send(new CompleteMultipartUploadCommand({
      Bucket: this.bucket, Key: session.key, UploadId: session.uploadId,
      MultipartUpload: { Parts: parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })) },
    }));
    return { key: session.key };
  }
}
```

### Client-side responsibility

The client (web or mobile) driving a multipart upload tracks which chunks have succeeded and only retries the failed ones:

```ts
// ✅ DO — client-side retry logic operates PER CHUNK, not on the whole file
async function uploadFileInChunks(file: File, session: MultipartUploadSession): Promise<void> {
  const chunks = splitIntoChunks(file, CHUNK_SIZE_BYTES);
  const results: { partNumber: number; etag: string }[] = [];
  for (const [index, chunk] of chunks.entries()) {
    const partNumber = index + 1;
    const etag = await uploadPartWithRetry(session, partNumber, chunk, { maxRetries: 3 }); // only THIS chunk retries on failure
    results.push({ partNumber, etag });
  }
  await completeMultipartUpload(session, results);
}
```

For a resumable-upload experience across page reloads/app restarts, persist chunk completion state (e.g. which part numbers have already succeeded) so an interrupted upload can resume rather than restart even across a full browser refresh or app kill.

## Upload pattern — prefer client-direct, signed uploads

For anything beyond small files, don't proxy the file's bytes through the NestJS API (that ties up an API server thread/connection for the duration of the upload and duplicates bandwidth cost). Prefer:

```text
1. Client asks API for a signed upload URL (or a multipart upload session, for large files)
   for a specific key + content type
2. API authorizes the request (is this user allowed to upload this? to this key/prefix?),
   then returns short-lived signed URL(s)
3. Client uploads directly to S3/Firebase Storage using those URLs — in chunks,
   per the multipart pattern above, for large files
4. Client (or a storage event trigger) notifies the API the upload completed
5. API validates the object exists and matches expectations before marking it "ready"
```

```ts
@Post('uploads/signed-url')
@UseGuards(AuthGuard)
public async createSignedUploadUrl(
  @ZodBody(SignedUploadRequestSchema) dto: SignedUploadRequestDto,
  @CurrentUser() user: AuthUser,
): Promise<SignedUploadResponseDto> {
  const key = buildStorageKey({ tenantId: user.tenantId, purpose: dto.purpose, filename: dto.filename });
  if (dto.fileSizeBytes > MULTIPART_THRESHOLD_BYTES) {
    const session = await this.storage.initiateMultipartUpload(key, dto.contentType);
    return { key, multipart: session };
  }
  const url = await this.storage.getSignedUploadUrl(key, dto.contentType, 300);
  return { key, url };
}
```

## Key naming

Namespace keys so authorization and cleanup are tractable, e.g. `<tenantId>/<domain>/<entityId>/<filename-or-uuid>`. Never let a client supply a raw, unvalidated key/path — derive it server-side (or validate a client-supplied filename against a strict allowlist pattern) to prevent path traversal or key collisions across tenants.

```text
❌ DON'T — client sends { "path": "../../other-tenant/secrets.pdf" }
   and the server uses it verbatim as the storage key.

✅ DO — the server derives the key entirely from server-known values
   (the authenticated user's tenantId, a generated UUID) and, at most,
   incorporates a sanitized, validated version of the client-supplied filename.
```

## Validation

Validate content type and size **before** issuing a signed upload URL (reject at request time) and, where the provider supports it, constrain the signed URL itself (max size, allowed content type) so a malicious client can't upload something different than what was authorized. Re-validate server-side after upload completes for anything security-sensitive (e.g. verify a claimed image is actually an image, not just trust the client-declared content type).

## Access control

- Private-by-default: objects are not publicly readable unless the feature genuinely requires public access (e.g. a public avatar). Serve private objects via short-lived signed download URLs, generated per-request after an authorization check — never a permanently public bucket/object as a shortcut (see `15-feature-development-process.md` — "as a shortcut" is exactly the standard this project doesn't accept).
- Signed URL expiry should be as short as the use case allows (minutes for most download links, not hours/days) — a long-lived signed URL is effectively a leaked-forever credential if the link escapes its intended context.
- Bucket/storage credentials live in server-side environment/secret configuration only — never in a `NEXT_PUBLIC_*`/`EXPO_PUBLIC_*` variable or any client bundle (`10-security-auth-authorization.md`).

## Provider-specific errors stay at the adapter boundary

Translate S3/Firebase SDK errors into application-level storage errors in the adapter (`00-non-negotiables.md`'s error-handling rule) — a service calling `objectStorage.upload(...)` shouldn't need to know or catch an `S3ServiceException` directly.

## Cleanup

If an entity referencing a stored object is deleted (which, per `08-database-prisma.md`, means soft-deleted — `isDeleted`/`deletedAt`/`deletedBy`), the underlying object in storage is **not** deleted automatically at the same time — soft-deleting the database row while immediately hard-deleting the file would defeat the purpose of the soft delete (the record says "recoverable" while the file is already gone). Physical object deletion, if it happens at all, is a separate, explicit, tracked step run well after the soft-delete retention window (ideally via a scheduled job, not inline in the same request) — orphaned objects silently accumulating cost and exposure surface is a common, avoidable failure mode, but so is deleting something a soft-delete implied was recoverable.

## Testing

Integration tests for storage-touching code run against a local/test-scoped provider (e.g. MinIO for S3-compatible testing, or the Firebase emulator suite) rather than mocking the SDK so heavily that a real contract mismatch goes uncaught — same philosophy as `11-testing-vitest.md`'s integration-testing guidance for Prisma/messaging.

## CDN usage

Serve publicly-readable objects (the ones deliberately not private-by-default, per this document's access-control section) through a CDN rather than directly from the storage bucket — this reduces latency for users far from the bucket's region, reduces direct load/cost on the storage provider, and lets you apply cache headers/invalidation deliberately rather than relying on the storage provider's own default behavior.

```text
❌ DON'T — link directly to an S3/Firebase Storage URL from every page
   that displays a public image, with no CDN and no cache headers,
   meaning every single view re-fetches from origin.

✅ DO — front public objects with a CDN, set explicit, sensible
   cache-control headers on upload (long-lived for immutable, uniquely-
   named assets — see the key-naming section above; short/no-cache for
   anything that can change in place), and have a deliberate
   invalidation plan for the rare case something public needs to change
   without changing its key.
```

## Image transformation pipelines

For user-uploaded images that need to be displayed at multiple sizes (a thumbnail, a full-size view), don't generate every variant eagerly at upload time if only some will ever actually be viewed — prefer an on-demand image transformation service/CDN feature (resize-on-request, cached after first generation) over pre-generating and storing every possible size up front, which wastes storage and upload time on variants that may never be requested.

## Virus/malware scanning on upload

For any upload flow that accepts files from parties outside your own trusted systems (user-uploaded documents, images, attachments), scan uploaded files for malware before they're made available for anyone else to download — an unscanned user-upload pathway is a well-known vector for distributing malicious files through an otherwise-trusted platform. Where this scanning happens (a queued job triggered post-upload, per the async patterns in `09-messaging-and-jobs.md`) determines the file's state machine: uploaded → pending-scan → clean/quarantined, and nothing should serve a file to another user while it's still in the pending-scan state.

## Storage lifecycle policies

For object categories with a known, bounded useful life (temporary export files, old multipart-upload fragments that were never completed, expired signed-upload staging objects), configure the storage provider's native lifecycle rules to automatically expire/delete them, rather than relying on application code to remember to clean them up — an automatic, infrastructure-level lifecycle policy is far more reliable than a cleanup job that can silently fail or be forgotten. This is distinct from the deliberate, application-level cleanup process this document already requires for objects tied to a soft-deleted business entity — lifecycle policies are for genuinely transient, non-business-record objects only.

## Resumable downloads (range requests)

For large file downloads (a video, a large export file), support HTTP range requests so a client can resume an interrupted download from where it left off rather than restarting from byte zero — the same principle as this document's multipart-upload guidance, applied to the download direction. Most object storage providers support range requests natively when serving directly from the bucket/CDN; ensure any proxy layer in front of storage (if the API proxies downloads rather than issuing signed URLs) doesn't silently strip this support.

```text
❌ DON'T — a download endpoint that always reads and streams the
   entire file from the start, with no Range header support, forcing a
   client on a flaky connection to restart a large download from
   scratch on every interruption — exactly the problem this document's
   multipart-upload section solves for uploads, left unsolved for downloads.

✅ DO — either serve large files via a signed URL directly from
   storage/CDN (which supports range requests natively, per this
   document's client-direct-upload/download pattern), or, if proxying
   through the API is genuinely necessary, explicitly support and
   forward Range headers.
```

## Storage cost monitoring

Object storage cost scales with both volume stored and egress bandwidth — track both explicitly (not just "the bill seems fine this month") so a runaway cost (an orphaned-object cleanup job silently failing, per this document's cleanup section, or an unexpectedly popular public asset driving unbudgeted egress) is caught from a monitored trend rather than discovered as a surprise on an invoice weeks later. This is a specific instance of `12-observability-and-operations.md`'s general metrics guidance, applied to a cost dimension that's easy to overlook because it doesn't show up in a typical latency/error-rate dashboard.

## Presigned URL scope — narrower than it looks

```text
❌ DON'T assume a presigned URL is safely scoped just because it's
   short-lived — a presigned URL with an overly broad IAM policy behind
   it (e.g. the credentials used to SIGN it have write access to the
   entire bucket, not just the specific key) means anyone possessing
   that URL during its validity window has effectively that same broad
   access, not just access to the one object it was meant for.

✅ DO — scope the underlying credentials/policy used to generate
   presigned URLs as narrowly as the storage provider allows (ideally to
   the exact key or key prefix being granted), so a leaked presigned URL
   exposes only what it was actually meant to, consistent with this
   entire document's key-naming and access-control discipline above.
```

## Testing multipart upload failure/resume specifically

Beyond the general storage-testing guidance already covered, the multipart-upload retry behavior this document requires deserves its own explicit test: simulate a chunk failing partway through a multi-chunk upload, and assert that only the failed chunk is retried (not the whole file) and that the upload still completes successfully once the retry succeeds. This is exactly the kind of behavior that looks correct by code inspection but is easy to get subtly wrong in practice (e.g. accidentally retrying from chunk 1 instead of the actually-failed chunk) — and it's precisely the behavior this document's multipart-upload section exists to guarantee, so it deserves a real, explicit test rather than an assumption that "the code looks right."

## Reference: client-side multipart upload with per-chunk retry and resume

```ts
const CHUNK_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_CHUNK_ATTEMPTS = 4;
const RETRY_BASE_DELAY_MS = 500;

export async function uploadLargeFile(file: File, api: UploadApi, onProgress: (uploaded: number, total: number) => void): Promise<string> {
  const session = await api.initiate({ filename: file.name, contentType: file.type, sizeBytes: file.size });
  const completed = new Map<number, string>(session.alreadyUploadedParts.map((p) => [p.partNumber, p.etag])); // resume support
  const totalParts = Math.ceil(file.size / CHUNK_SIZE_BYTES);

  for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
    if (completed.has(partNumber)) continue;                 // already uploaded — skip, do NOT re-send
    const chunk = file.slice((partNumber - 1) * CHUNK_SIZE_BYTES, partNumber * CHUNK_SIZE_BYTES);
    const etag = await retryWithBackoff(() => api.uploadPart(session, partNumber, chunk), MAX_CHUNK_ATTEMPTS, RETRY_BASE_DELAY_MS);
    completed.set(partNumber, etag);
    onProgress(completed.size, totalParts);
  }
  const parts = [...completed.entries()].map(([partNumber, etag]) => ({ partNumber, etag })).sort((a, b) => a.partNumber - b.partNumber);
  return api.complete(session, parts);
}
```

Only the failing part is retried; parts already accepted are never re-sent; `alreadyUploadedParts` (from the provider's list-parts call) lets a reload/app restart resume mid-file. The server validates the assembled object (size, magic bytes/content type) before marking it ready, and abandoned multipart uploads are aborted by a lifecycle rule so they don't accrue storage cost.

## Object storage do / don't quick pairs

```text
❌ Trust the client's Content-Type / file extension       ✅ sniff magic bytes server-side after upload
❌ Store the original filename as the object key          ✅ generated key; keep the sanitized original name in the DB
❌ Serve user uploads from your primary domain            ✅ separate cookieless domain/CDN (limits XSS/cookie exposure)
❌ Public-read bucket "for convenience"                   ✅ private by default + signed URLs (public only by explicit decision)
❌ Delete the object when the DB row is soft-deleted      ✅ retain until the retention window passes, then purge via a tracked job
❌ One giant upload request for a 2 GB video              ✅ multipart, per-chunk retry, resumable
❌ Signed URL valid for days                              ✅ minutes; regenerate on demand after an authorization check
❌ Same bucket/credentials for every environment          ✅ separate buckets + least-privilege credentials per environment
```
