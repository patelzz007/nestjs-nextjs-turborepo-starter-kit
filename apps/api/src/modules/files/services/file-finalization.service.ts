import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { StoredFile } from "@prisma/client";
import { assertNever, DocumentMimeTypeSchema, FileProcessingResultSchema, type FileProcessingResult, type StorageObjectLocator } from "@workspace/shared";

import { TypedConfigService } from "../../../config/typed-config.service";
import { UnreadableImageError } from "../../storage/domain/image-processor.port";
import type { MalwareScanResult } from "../../storage/domain/malware-scanner.port";
import type { ObjectStorage } from "../../storage/domain/object-storage.port";
import type { PublicDelivery } from "../../storage/domain/public-delivery.port";
import { OBJECT_STORAGE, PUBLIC_DELIVERY } from "../../storage/domain/storage.tokens";
import { buildFinalStoragePath, isStagingPath } from "../../storage/utils/file-path.util";
import { locatorFromStoredFile, toStorageObjectLocator } from "../../storage/utils/storage-locator.util";
import {
	AWAITING_VERDICT_STATUSES,
	StoredFileBindingTargetMissingError,
	StoredFileRepository,
	type StoredFileBinding,
	type StoredFileStatusFields,
	type StoredFileVariantInput,
} from "../repositories/stored-file.repository";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import type { FileVerdictOutcome } from "../lifecycle/file-lifecycle-listener";
import { FileLifecycleListenerRegistry } from "../lifecycle/file-lifecycle-listener.registry";
import { resolveStorageOwnerId } from "./file-ownership.util";
import { ImageObjectMissingError, ImageRenditionService } from "./image-rendition.service";
import { isPublicFile } from "./file-visibility.util";

/** Verdicts that attach nothing (quarantine, failure, KYB evidence). */
const NO_BINDING: StoredFileBinding = { kind: "NONE" };

/** How a READY file was cleared: by a scanner (CLEAN) or with no scanner configured (NOT_SCANNED). */
interface ReadyScanRecord {
	readonly scanStatus: "CLEAN" | "NOT_SCANNED";
	readonly scanResult: string;
}

/** Where a promotion put the file's bytes, and whether this attempt made that copy (so may delete it on failure). */
interface PromotedObject {
	readonly locator: StorageObjectLocator;
	readonly revision: string | null;
	readonly copiedByThisAttempt: boolean;
}

/** What happened to a verdict: applied, or ignored because the file had already left SCANNING. */
export type VerdictOutcome = "READY" | "QUARANTINED" | "FAILED" | "SKIPPED" | "AWAITING_EXTERNAL";

/**
 * The only code that moves a file out of SCANNING. Every transition is
 * conditional on the file still awaiting a verdict, so a redelivered job, a
 * replayed callback or a delete racing the scan can never resurrect a
 * DELETED/QUARANTINED file or apply a verdict twice.
 */
@Injectable()
export class FileFinalizationService {
	private readonly logger: Logger = new Logger(FileFinalizationService.name);

	public constructor(
		private readonly config: TypedConfigService,
		private readonly repository: StoredFileRepository,
		@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
		@Inject(PUBLIC_DELIVERY) private readonly publicDelivery: PublicDelivery,
		private readonly transactions: TenantTransactionService,
		private readonly listeners: FileLifecycleListenerRegistry,
		private readonly renditions: ImageRenditionService,
	) {}

	/** Applies what the configured scanner reported for a file awaiting its verdict. */
	public async applyScanResult(file: StoredFile, result: MalwareScanResult): Promise<VerdictOutcome> {
		switch (result.outcome) {
			case "CLEAN":
				return this.promoteToReady(file, { scanStatus: "CLEAN", scanResult: `${result.engine}: ${result.detail}` });
			case "NOT_SCANNED":
				return this.promoteToReady(file, { scanStatus: "NOT_SCANNED", scanResult: `${result.engine}: ${result.reason}` });
			case "INFECTED":
				return this.quarantine(file, `${result.engine}: ${result.signature}`);
			case "PENDING_EXTERNAL":
				// An asynchronous scanner owns the file now; its verdict arrives through applyProcessingResult.
				return "AWAITING_EXTERNAL";
			default:
				return assertNever(result, "malware scan result");
		}
	}

	/** No verdict could be obtained (object missing, scanner down past every retry): the upload fails, it is never made CLEAN. */
	public async failScan(file: StoredFile, reason: string): Promise<VerdictOutcome> {
		const failed = await this.decide(file, "FAILED", { scanResult: reason });
		if (!failed) {
			return "SKIPPED";
		}
		await this.deleteStagingObject(file);
		return "FAILED";
	}

	/**
	 * Applies a result posted by an external processing worker (an out-of-process
	 * scanner pipeline). READY must carry an explicit CLEAN scan status, and a
	 * file only accepts a result while it is awaiting one.
	 */
	public async applyProcessingResult(input: FileProcessingResult): Promise<void> {
		const parsed = FileProcessingResultSchema.parse(input);
		const file = await this.repository.findById(parsed.fileId);
		if (file === null) {
			throw new NotFoundException({ message: "File not found", error: "FILE_NOT_FOUND" });
		}
		if (!AWAITING_VERDICT_STATUSES.includes(file.status)) {
			throw new ConflictException({ message: `File is ${file.status}, not awaiting a processing result`, error: "FILE_STATE_CONFLICT" });
		}

		const outcome = await this.applyExternalResult(file, parsed);
		if (outcome === "SKIPPED") {
			throw new ConflictException({ message: "File left the scanning state while the result was applied", error: "FILE_STATE_CONFLICT" });
		}
	}

	private async applyExternalResult(file: StoredFile, parsed: FileProcessingResult): Promise<VerdictOutcome> {
		switch (parsed.status) {
			case "QUARANTINED":
				return this.quarantine(file, parsed.scanResult ?? "quarantined by processing worker");
			case "FAILED":
				return this.failScan(file, parsed.scanResult ?? "processing worker failed");
			case "READY": {
				if (parsed.scanStatus !== "CLEAN") {
					throw new BadRequestException({ message: "A READY result must report scanStatus CLEAN", error: "FILE_SCAN_STATUS_REQUIRED" });
				}
				const expectedFinalPath = buildFinalStoragePath(this.pathInput(file));
				if (parsed.finalStoragePath !== undefined && parsed.finalStoragePath !== expectedFinalPath) {
					throw new BadRequestException({ message: "finalStoragePath does not match the file's final key", error: "FILE_FINAL_PATH_MISMATCH" });
				}
				return this.promoteToReady(file, { scanStatus: "CLEAN", scanResult: parsed.scanResult ?? "clean (processing worker)" }, parsed.finalStoragePath !== undefined);
			}
			default:
				return assertNever(parsed.status, "processing result status");
		}
	}

	private async quarantine(file: StoredFile, scanResult: string): Promise<VerdictOutcome> {
		const quarantined = await this.decide(file, "QUARANTINED", {
			scanStatus: "INFECTED",
			scannedAt: BigInt(Date.now()),
			scanResult,
		});
		if (!quarantined) {
			return "SKIPPED";
		}
		// Infected bytes are removed outright; the row keeps the verdict for the audit trail.
		await this.storage.deleteObject(locatorFromStoredFile(file, this.config.storage.provider));
		this.logger.warn(`Quarantined file ${file.id}: ${scanResult}`);
		return "QUARANTINED";
	}

	private async promoteToReady(file: StoredFile, scan: ReadyScanRecord, alreadyAtFinalPath = false): Promise<VerdictOutcome> {
		let binding: StoredFileBinding;
		try {
			binding = this.bindingFor(file);
		} catch (error) {
			if (error instanceof StoredFileBindingTargetMissingError) {
				return this.failScan(file, error.message);
			}
			throw error;
		}

		// The staging object stays until the verdict commits: if this attempt fails part-way, the row
		// still names bytes that exist, so a retry runs the whole promotion again instead of failing
		// the upload as "missing".
		const promoted = await this.promoteObject(file, alreadyAtFinalPath);
		let publicPath: string | null;
		let variants: readonly StoredFileVariantInput[];
		try {
			publicPath = isPublicFile(file) ? await this.publish(file, promoted.locator) : null;
			variants = await this.renditions.renderAndPublish(file, promoted.locator);
		} catch (error) {
			if (error instanceof UnreadableImageError || error instanceof ImageObjectMissingError) {
				await this.discardPromoted(file, promoted.locator);
				return this.failScan(file, error.message);
			}
			await this.undoFailedAttempt(file, promoted, []);
			throw error;
		}
		const fields: StoredFileStatusFields = {
			storagePath: promoted.locator.path,
			objectGeneration: promoted.revision,
			objectRevision: promoted.revision,
			publicPath,
			scanStatus: scan.scanStatus,
			scannedAt: BigInt(Date.now()),
			scanResult: scan.scanResult,
		};

		let ready: boolean;
		try {
			ready = await this.decide(file, "READY", fields, binding, variants);
		} catch (error) {
			if (error instanceof StoredFileBindingTargetMissingError) {
				await this.renditions.discard(variants, file.id);
				await this.discardPromoted(file, promoted.locator);
				return this.failScan(file, error.message);
			}
			await this.undoFailedAttempt(file, promoted, variants);
			throw error;
		}
		if (!ready) {
			// Deleted or decided while we were promoting: drop the copies we just made.
			await this.renditions.discard(variants, file.id);
			await this.discardPromoted(file, promoted.locator);
			await this.deleteStagingObject(file);
			return "SKIPPED";
		}
		// Committed: the row now names the final key, so the staging copy is no longer needed.
		await this.deleteStagingObject(file);
		return "READY";
	}

	/**
	 * Before a failed attempt's error is rethrown for a retry: withdraws what the
	 * attempt published and deletes the copy it made, leaving the file exactly as
	 * the attempt found it. An object the attempt did not create (the row's own,
	 * or a processing worker's copy) is kept — the retry needs it. A cleanup that
	 * fails is logged and the original error is still the one rethrown.
	 */
	private async undoFailedAttempt(file: StoredFile, promoted: PromotedObject, variants: readonly StoredFileVariantInput[]): Promise<void> {
		try {
			await this.renditions.discard(variants, file.id);
			if (isPublicFile(file)) {
				await this.publicDelivery.unpublishAsset({ locator: promoted.locator, fileId: file.id });
			}
			if (promoted.copiedByThisAttempt) {
				await this.storage.deleteObject(promoted.locator);
			}
		} catch (cleanupError) {
			this.logger.error({
				event: "files.promotion_undo_failed",
				fileId: file.id,
				error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
			});
		}
	}

	/**
	 * The single place a file leaves SCANNING: one `files.scan_verdict.apply`
	 * transaction holds the conditional transition, the resource binding and
	 * every category listener's reaction (FileLifecycleListener), so they commit
	 * or roll back together. `false` when the file had already left SCANNING.
	 */
	private async decide(
		file: StoredFile,
		outcome: FileVerdictOutcome,
		fields: StoredFileStatusFields,
		binding: StoredFileBinding = NO_BINDING,
		variants: readonly StoredFileVariantInput[] = [],
	): Promise<boolean> {
		return this.transactions.withSystemOperation(
			{ operation: "files.scan_verdict.apply", reason: `Apply the ${outcome} scan verdict to an uploaded file`, actorUserId: null },
			async (tx): Promise<boolean> => {
				const transitioned = await this.repository.transitionStatus(file.id, AWAITING_VERDICT_STATUSES, outcome, fields, tx);
				if (!transitioned) {
					return false;
				}
				await this.repository.bindInTx(tx, file.id, binding);
				await this.repository.upsertVariantsInTx(tx, file.id, variants);
				await this.listeners.notifyInTx(tx, {
					fileId: file.id,
					category: file.category,
					organizationId: file.organizationId,
					uploadedById: file.uploadedById,
					outcome,
				});
				return true;
			},
		);
	}

	private bindingFor(file: StoredFile): StoredFileBinding {
		switch (file.category) {
			case "PRODUCT_IMAGE":
				if (file.productId === null) {
					throw new StoredFileBindingTargetMissingError({ kind: "PRODUCT_IMAGE", productId: "" });
				}
				return { kind: "PRODUCT_IMAGE", productId: file.productId };
			case "STORE_LOGO":
			case "STORE_BANNER":
				if (file.organizationId === null) {
					throw new StoredFileBindingTargetMissingError({ kind: "ORGANIZATION_ASSET", organizationId: "", assetType: file.category === "STORE_LOGO" ? "LOGO" : "BANNER" });
				}
				return { kind: "ORGANIZATION_ASSET", organizationId: file.organizationId, assetType: file.category === "STORE_LOGO" ? "LOGO" : "BANNER" };
			case "USER_AVATAR":
				return { kind: "USER_AVATAR", userId: file.uploadedById };
			case "MERCHANT_KYB":
				// KYB evidence is attached explicitly when the merchant submits it for review.
				return { kind: "NONE" };
			case "REWARD_IMAGE":
				// An image is attached when a reward lists it (`imageFileIds`), which needs the file READY first.
				return { kind: "NONE" };
			default:
				return assertNever(file.category, "file category");
		}
	}

	/**
	 * Copies the staging object to its durable final key (or adopts the worker's copy).
	 * The staging object is kept: it is removed only once the verdict commits.
	 */
	private async promoteObject(file: StoredFile, alreadyAtFinalPath: boolean): Promise<PromotedObject> {
		const sourceLocator = locatorFromStoredFile(file, this.config.storage.provider);
		const destinationLocator = toStorageObjectLocator(sourceLocator.provider, sourceLocator.container, buildFinalStoragePath(this.pathInput(file)));
		if (file.storagePath === destinationLocator.path) {
			return { locator: sourceLocator, revision: file.objectRevision ?? file.objectGeneration, copiedByThisAttempt: false };
		}
		if (alreadyAtFinalPath) {
			return { locator: destinationLocator, revision: file.objectRevision ?? file.objectGeneration, copiedByThisAttempt: false };
		}
		const copied = await this.storage.copyObject(sourceLocator, destinationLocator);
		return { locator: copied.locator, revision: copied.revision, copiedByThisAttempt: true };
	}

	private async publish(file: StoredFile, locator: StorageObjectLocator): Promise<string> {
		const published = await this.publicDelivery.publishAsset({
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
	 * needed: the public URL was never persisted or returned to anyone, so no
	 * client could have pulled the asset into the CDN cache.
	 */
	private async discardPromoted(file: StoredFile, promotedLocator: StorageObjectLocator): Promise<void> {
		if (isPublicFile(file)) {
			await this.publicDelivery.unpublishAsset({ locator: promotedLocator, fileId: file.id });
		}
		await this.storage.deleteObject(promotedLocator);
	}

	private async deleteStagingObject(file: StoredFile): Promise<void> {
		if (!isStagingPath(file.storagePath)) {
			return;
		}
		await this.storage.deleteObject(locatorFromStoredFile(file, this.config.storage.provider));
	}

	private pathInput(file: StoredFile): Parameters<typeof buildFinalStoragePath>[0] {
		return {
			category: file.category,
			ownerId: resolveStorageOwnerId(file),
			fileId: file.id,
			fileName: file.originalName,
			mimeType: file.mimeType,
		};
	}
}
