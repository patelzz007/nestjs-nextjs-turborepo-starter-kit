// ============================================
// infrastructure/backup/object-storage-backup.adapter.ts — backups in private object storage
// ============================================
// ADAPTER for `BackupStoragePort` over the platform's `ObjectStorage`: the private container of the
// active provider (server-side encrypted on S3), written as a stream (multipart on S3, resumable on
// Cloud Storage), with the SHA-256 computed on the way through.

import { createHash } from "node:crypto";
import { PassThrough, type Readable } from "node:stream";

import type { StorageProvider } from "@workspace/shared";

import type { ObjectStorage } from "../../../../platform/infrastructure/storage";
import { toStorageObjectLocator } from "../../../../platform/infrastructure/storage/utils/storage-locator.util";
import type { BackupStoragePort, StoredBackup } from "../../application/ports/backup.ports";
import { backupObjectPath } from "../../application/services/backup-runner";

/** `pg_dump --format=custom` output. */
const BACKUP_CONTENT_TYPE = "application/octet-stream";

export class ObjectStorageBackupAdapter implements BackupStoragePort {
	public constructor(
		private readonly storage: ObjectStorage,
		private readonly provider: StorageProvider,
		private readonly container: string,
	) {}

	public async store(backupId: string, takenAt: number, bytes: Readable): Promise<StoredBackup> {
		const locator = toStorageObjectLocator(this.provider, this.container, backupObjectPath(backupId, takenAt));
		const hash = createHash("sha256");
		const tee = new PassThrough();
		bytes.on("data", (chunk: Buffer): void => {
			hash.update(chunk);
		});
		bytes.on("error", (error: Error): void => {
			tee.destroy(error);
		});
		bytes.pipe(tee);
		const result = await this.storage.uploadStream({ locator, stream: tee, contentType: BACKUP_CONTENT_TYPE, metadata: { backupId } });
		return { container: locator.container, path: locator.path, sizeBytes: result.sizeBytes, checksum: hash.digest("hex") };
	}

	public open(container: string, path: string): Promise<Readable | null> {
		return this.storage.getObjectStream(toStorageObjectLocator(this.provider, container, path));
	}

	public remove(container: string, path: string): Promise<void> {
		return this.storage.deleteObject(toStorageObjectLocator(this.provider, container, path));
	}
}
