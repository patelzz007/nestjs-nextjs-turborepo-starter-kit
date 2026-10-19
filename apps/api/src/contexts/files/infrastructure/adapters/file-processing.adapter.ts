import { HttpStatus, Logger } from "@nestjs/common";
import type { StoredFile } from "@prisma/client";
import { assertNever, DocumentMimeTypeSchema, FileProcessingResultSchema, type FileProcessingResult, type StorageObjectLocator } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import { AppError, NotFoundError } from "../../../../platform/application/errors/app-error";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import { UnreadableImageError } from "../../../../platform/infrastructure/storage/domain/image-processor.port";
import { MalwareScannerUnavailableError, type MalwareScanner, type MalwareScanResult } from "../../../../platform/infrastructure/storage/domain/malware-scanner.port";
import type { ObjectStorage } from "../../../../platform/infrastructure/storage/domain/object-storage.port";
import type { PublicDelivery } from "../../../../platform/infrastructure/storage/domain/public-delivery.port";
import { buildFinalStoragePath, isStagingPath, type BuildFileObjectPathInput } from "../../../../platform/infrastructure/storage/utils/file-path.util";
import { toStorageObjectLocator } from "../../../../platform/infrastructure/storage/utils/storage-locator.util";
import { AWAITING_VERDICT_STATUSES, type FileRenditionRecord, type VerdictRecord } from "../../domain/aggregates/stored-file.aggregate";
import { FileBindingTargetMissingError, FileOwnerUnresolvedError, FileStateConflictError } from "../../domain/errors/files.errors";
import type { FileVerdictOutcome } from "../../domain/events/file-verdict-reached.event";
import { resolveFileOwnerId } from "../../domain/policies/file-upload.policy";
import type { FilesScope } from "../../application/files-scope";
import type { FileProcessingPort, VerdictOutcome } from "../../application/ports/file-processing.port";
import { FILES_SCAN_VERDICT_OPERATION } from "../../application/ports/files.tokens";
import { storedLocatorOf } from "../persistence/stored-file.mapper";
import { ImageObjectMissingError, type ImageRenditionService } from "./image-rendition.service";

/** How a READY file was cleared: by a scanner (CLEAN) or with no scanner configured (NOT_SCANNED). */
interface ReadyScanRecord {
	readonly scanStatus: "CLEAN" | "NOT_SCANNED";
	readonly scanResult: string;
}

/** Where a promotion put the file's bytes, and whether this attempt made that copy (so may delete it on failure). */
interface PromotedCopy {
	readonly locator: StorageObjectLocator;
	readonly revision: string | null;
	readonly copiedByThisAttempt: boolean;
}

/** Reads a live stored-file row; FilesModule backs it with a `files.scan_verdict.apply` read (callbacks and jobs both run as it). */
export interface StoredFileRowReader {
	findLive(fileId: string): Promise<StoredFile | null>;
}

/** The collaborators of the pipeline, all ports or platform adapters. */
export interface FileProcessingDependencies {
	readonly uow: UnitOfWork<FilesScope>;
	/** The whole row of a live file (storage columns included), read as the verdict operation. */
	readonly rows: StoredFileRowReader;
	readonly storage: ObjectStorage;
	readonly publicDelivery: PublicDelivery;
	readonly scanner: MalwareScanner;
	readonly renditions: ImageRenditionService;
	readonly clock: Clock;
}

function badRequest(code: string, message: string): AppError {
	return new AppError({ code, httpStatus: HttpStatus.BAD_REQUEST, message });
}

/**
 * The scan-and-verdict pipeline: the only code that moves a file out of
 * SCANNING. Storage work (promotion to the final key, public publishing,
 * renditions) happens first; the verdict itself is one `files.scan_verdict.apply`
 * unit of work — the compare-and-set transition, the renditions, and every
 * owner's in-transaction reaction to `FileVerdictReached` (drained by the
 * transactional dispatcher), committed or rolled back together. A verdict for a
 * file that already left SCANNING (redelivered job, replayed callback, a delete
 * racing the scan) is SKIPPED and its storage copies are undone.
 */
export class FileProcessingAdapter implements FileProcessingPort {
	private readonly logger: Logger = new Logger(FileProcessingAdapter.name);

	public constructor(private readonly deps: FileProcessingDependencies) {}

	public async scan(actor: ActorContext, fileId: string, finalAttempt: boolean): Promise<VerdictOutcome> {
		const file = await this.load(fileId);
		if (file === null || !AWAITING_VERDICT_STATUSES.includes(file.status)) {
			return "SKIPPED";
		}
		try {
			return await this.scanAwaiting(actor, file);
		} catch (error) {
			if (error instanceof MalwareScannerUnavailableError && finalAttempt) {
				this.logger.error(`Scan of file ${fileId} could not obtain a verdict on its final attempt: ${error.message}`);
				const latest = await this.load(fileId);
				return latest === null ? "SKIPPED" : this.failScan(actor, latest, `scan failed: ${error.message}`);
			}
			throw error;
		}
	}

	public async applyProcessingResult(actor: ActorContext, input: FileProcessingResult): Promise<void> {
		const parsed = FileProcessingResultSchema.parse(input);
		const file = await this.load(parsed.fileId);
		if (file === null) {
			throw new NotFoundError({ code: "FILE_NOT_FOUND", message: "File not found" });
		}
		if (!AWAITING_VERDICT_STATUSES.includes(file.status)) {
			throw new FileStateConflictError(`File is ${file.status}, not awaiting a processing result`);
		}
		if ((await this.applyExternalResult(actor, file, parsed)) === "SKIPPED") {
			throw new FileStateConflictError("File left the scanning state while the result was applied");
		}
	}

	private async scanAwaiting(actor: ActorContext, file: StoredFile): Promise<VerdictOutcome> {
		const locator = storedLocatorOf(file);
		if ((await this.deps.storage.headObject(locator)) === null) {
			return this.failScan(actor, file, "uploaded object is missing");
		}
		const result = await this.deps.scanner.scan({ fileId: file.id, locator, openStream: async () => this.deps.storage.getObjectStream(locator) });
		const outcome = await this.applyScanResult(actor, file, result);
		this.logger.log(`Scanned file ${file.id} with ${result.engine}: ${result.outcome} → ${outcome}`);
		return outcome;
	}

	private async applyScanResult(actor: ActorContext, file: StoredFile, result: MalwareScanResult): Promise<VerdictOutcome> {
		switch (result.outcome) {
			case "CLEAN":
				return this.promoteToReady(actor, file, { scanStatus: "CLEAN", scanResult: `${result.engine}: ${result.detail}` });
			case "NOT_SCANNED":
				return this.promoteToReady(actor, file, { scanStatus: "NOT_SCANNED", scanResult: `${result.engine}: ${result.reason}` });
			case "INFECTED":
				return this.quarantine(actor, file, `${result.engine}: ${result.signature}`);
			case "PENDING_EXTERNAL":
				// An asynchronous scanner owns the file now; its verdict arrives through the processing callback.
				return "AWAITING_EXTERNAL";
			default:
				return assertNever(result, "malware scan result");
		}
	}

	private async applyExternalResult(actor: ActorContext, file: StoredFile, parsed: FileProcessingResult): Promise<VerdictOutcome> {
		switch (parsed.status) {
			case "QUARANTINED":
				return this.quarantine(actor, file, parsed.scanResult ?? "quarantined by processing worker");
			case "FAILED":
				return this.failScan(actor, file, parsed.scanResult ?? "processing worker failed");
			case "READY": {
				if (parsed.scanStatus !== "CLEAN") {
					throw badRequest("FILE_SCAN_STATUS_REQUIRED", "A READY result must report scanStatus CLEAN");
				}
				const expectedFinalPath = buildFinalStoragePath(this.pathInput(file));
				if (parsed.finalStoragePath !== undefined && parsed.finalStoragePath !== expectedFinalPath) {
					throw badRequest("FILE_FINAL_PATH_MISMATCH", "finalStoragePath does not match the file's final key");
				}
				return this.promoteToReady(actor, file, { scanStatus: "CLEAN", scanResult: parsed.scanResult ?? "clean (processing worker)" }, parsed.finalStoragePath !== undefined);
			}
			default:
				return assertNever(parsed.status, "processing result status");
		}
	}

	/** No verdict could be obtained (object missing, scanner down past every retry): the upload fails, it is never made CLEAN. */
	private async failScan(actor: ActorContext, file: StoredFile, reason: string): Promise<VerdictOutcome> {
		const failed = await this.decide(actor, file, "FAILED", { scanStatus: null, scannedAt: null, scanResult: reason, promoted: null, renditions: [] });
		if (!failed) {
			return "SKIPPED";
		}
		await this.deleteStagingObject(file);
		return "FAILED";
	}

	private async quarantine(actor: ActorContext, file: StoredFile, scanResult: string): Promise<VerdictOutcome> {
		const quarantined = await this.decide(actor, file, "QUARANTINED", {
			scanStatus: "INFECTED",
			scannedAt: this.deps.clock.now(),
			scanResult,
			promoted: null,
			renditions: [],
		});
		if (!quarantined) {
			return "SKIPPED";
		}
		// Infected bytes are removed outright; the row keeps the verdict for the audit trail.
		await this.deps.storage.deleteObject(storedLocatorOf(file));
		this.logger.warn(`Quarantined file ${file.id}: ${scanResult}`);
		return "QUARANTINED";
	}

	private async promoteToReady(actor: ActorContext, file: StoredFile, scan: ReadyScanRecord, alreadyAtFinalPath = false): Promise<VerdictOutcome> {
		const unbindable = this.unbindableReason(file);
		if (unbindable !== null) {
			return this.failScan(actor, file, unbindable);
		}
		// The staging object stays until the verdict commits: if this attempt fails part-way, the row
		// still names bytes that exist, so a retry runs the whole promotion again.
		const promoted = await this.promoteObject(file, alreadyAtFinalPath);
		let publicPath: string | null;
		let renditions: readonly FileRenditionRecord[];
		try {
			publicPath = file.visibility === "PUBLIC" ? await this.publish(file, promoted.locator) : null;
			renditions = await this.deps.renditions.renderAndPublish(file, promoted.locator);
		} catch (error) {
			if (error instanceof UnreadableImageError || error instanceof ImageObjectMissingError) {
				await this.discardPromoted(file, promoted.locator);
				return this.failScan(actor, file, error.message);
			}
			await this.undoFailedAttempt(file, promoted, []);
			throw error;
		}
		const record: VerdictRecord = {
			scanStatus: scan.scanStatus,
			scannedAt: this.deps.clock.now(),
			scanResult: scan.scanResult,
			promoted: { storagePath: promoted.locator.path, objectRevision: promoted.revision, publicPath },
			renditions,
		};

		let ready: boolean;
		try {
			ready = await this.decide(actor, file, "READY", record);
		} catch (error) {
			if (error instanceof FileBindingTargetMissingError) {
				// An owner could not attach the file (e.g. the product was removed mid-scan): nothing committed.
				await this.deps.renditions.discard(renditions, file.id);
				await this.discardPromoted(file, promoted.locator);
				return this.failScan(actor, file, error.message);
			}
			await this.undoFailedAttempt(file, promoted, renditions);
			throw error;
		}
		if (!ready) {
			// Deleted or decided while we were promoting: drop the copies we just made.
			await this.deps.renditions.discard(renditions, file.id);
			await this.discardPromoted(file, promoted.locator);
			await this.deleteStagingObject(file);
			return "SKIPPED";
		}
		// Committed: the row now names the final key, so the staging copy is no longer needed.
		await this.deleteStagingObject(file);
		return "READY";
	}

	/**
	 * The single place a file leaves SCANNING. `false` when it had already left
	 * (the compare-and-set lost): nothing is written and no event is recorded.
	 */
	private async decide(actor: ActorContext, file: StoredFile, outcome: FileVerdictOutcome, record: VerdictRecord): Promise<boolean> {
		return this.deps.uow.runSystemOperation(FILES_SCAN_VERDICT_OPERATION, actor, async (scope: FilesScope): Promise<boolean> => {
			const live = await scope.storedFiles.findLive(file.id);
			if (!live?.isAwaitingVerdict) {
				return false;
			}
			live.reachVerdict(outcome, record, this.deps.clock.now());
			if ((await scope.storedFiles.save(live)) === "lost-race") {
				return false;
			}
			scope.events.collectFrom(live);
			return true;
		});
	}

	/** The resource a READY file's keys are namespaced under must be on the row; otherwise the upload fails, never READY. */
	private unbindableReason(file: StoredFile): string | null {
		try {
			resolveFileOwnerId({ category: file.category, productId: file.productId, organizationId: file.organizationId, userId: file.uploadedById });
			return null;
		} catch (error) {
			if (error instanceof FileOwnerUnresolvedError) {
				return error.message;
			}
			throw error;
		}
	}

	/**
	 * Before a failed attempt's error is rethrown for a retry: withdraws what the
	 * attempt published and deletes the copy it made, leaving the file exactly as
	 * the attempt found it. An object the attempt did not create (the row's own,
	 * or a processing worker's copy) is kept — the retry needs it. A cleanup that
	 * fails is logged and the original error is still the one rethrown.
	 */
	private async undoFailedAttempt(file: StoredFile, promoted: PromotedCopy, renditions: readonly FileRenditionRecord[]): Promise<void> {
		try {
			await this.deps.renditions.discard(renditions, file.id);
			if (file.visibility === "PUBLIC") {
				await this.deps.publicDelivery.unpublishAsset({ locator: promoted.locator, fileId: file.id });
			}
			if (promoted.copiedByThisAttempt) {
				await this.deps.storage.deleteObject(promoted.locator);
			}
		} catch (cleanupError) {
			this.logger.error({ event: "files.promotion_undo_failed", fileId: file.id, error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) });
		}
	}

	/** Copies the staging object to its durable final key (or adopts the worker's copy). The staging object is kept until the verdict commits. */
	private async promoteObject(file: StoredFile, alreadyAtFinalPath: boolean): Promise<PromotedCopy> {
		const source = storedLocatorOf(file);
		const destination = toStorageObjectLocator(source.provider, source.container, buildFinalStoragePath(this.pathInput(file)));
		if (file.storagePath === destination.path || alreadyAtFinalPath) {
			const locator = file.storagePath === destination.path ? source : destination;
			return { locator, revision: file.objectRevision ?? file.objectGeneration, copiedByThisAttempt: false };
		}
		const copied = await this.deps.storage.copyObject(source, destination);
		return { locator: copied.locator, revision: copied.revision, copiedByThisAttempt: true };
	}

	private async publish(file: StoredFile, locator: StorageObjectLocator): Promise<string> {
		const published = await this.deps.publicDelivery.publishAsset({
			locator,
			fileId: file.id,
			mimeType: DocumentMimeTypeSchema.parse(file.mimeType),
			fileName: file.originalName,
		});
		return published.publicUrl;
	}

	/**
	 * Undoes a promotion whose READY transition did not commit: withdraws the
	 * public copy first, then deletes the promoted object. No CDN purge is
	 * needed: the public URL was never persisted or returned to anyone.
	 */
	private async discardPromoted(file: StoredFile, promotedLocator: StorageObjectLocator): Promise<void> {
		if (file.visibility === "PUBLIC") {
			await this.deps.publicDelivery.unpublishAsset({ locator: promotedLocator, fileId: file.id });
		}
		await this.deps.storage.deleteObject(promotedLocator);
	}

	private async deleteStagingObject(file: StoredFile): Promise<void> {
		if (!isStagingPath(file.storagePath)) {
			return;
		}
		await this.deps.storage.deleteObject(storedLocatorOf(file));
	}

	private pathInput(file: StoredFile): BuildFileObjectPathInput {
		return {
			category: file.category,
			ownerId: resolveFileOwnerId({ category: file.category, productId: file.productId, organizationId: file.organizationId, userId: file.uploadedById }),
			fileId: file.id,
			fileName: file.originalName,
			mimeType: file.mimeType,
		};
	}

	private async load(fileId: string): Promise<StoredFile | null> {
		return this.deps.rows.findLive(fileId);
	}
}
