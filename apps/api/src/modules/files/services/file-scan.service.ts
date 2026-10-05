import { Inject, Injectable, Logger } from "@nestjs/common";

import { TypedConfigService } from "../../../config/typed-config.service";
import type { MalwareScanner } from "../../storage/domain/malware-scanner.port";
import type { ObjectStorage } from "../../storage/domain/object-storage.port";
import { MALWARE_SCANNER, OBJECT_STORAGE } from "../../storage/domain/storage.tokens";
import { locatorFromStoredFile } from "../../storage/utils/storage-locator.util";
import { AWAITING_VERDICT_STATUSES, StoredFileRepository } from "../repositories/stored-file.repository";
import { FileFinalizationService, type VerdictOutcome } from "./file-finalization.service";

/**
 * Scans one uploaded file with the configured {@link MalwareScanner} and hands
 * the verdict to {@link FileFinalizationService}. Idempotent: a file that is no
 * longer awaiting a verdict (redelivered job, already decided, deleted) is skipped.
 *
 * Throws `MalwareScannerUnavailableError` when the scanner produced no verdict;
 * the caller decides whether to retry (queue) or fail the upload (final attempt / inline).
 */
@Injectable()
export class FileScanService {
	private readonly logger: Logger = new Logger(FileScanService.name);

	public constructor(
		private readonly config: TypedConfigService,
		private readonly repository: StoredFileRepository,
		private readonly finalization: FileFinalizationService,
		@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
		@Inject(MALWARE_SCANNER) private readonly scanner: MalwareScanner,
	) {}

	public async scan(fileId: string): Promise<VerdictOutcome> {
		const file = await this.repository.findById(fileId);
		if (file === null || !AWAITING_VERDICT_STATUSES.includes(file.status)) {
			return "SKIPPED";
		}

		const locator = locatorFromStoredFile(file, this.config.storage.provider);
		if ((await this.storage.headObject(locator)) === null) {
			return this.finalization.failScan(file, "uploaded object is missing");
		}

		const result = await this.scanner.scan({
			fileId,
			locator,
			openStream: async () => this.storage.getObjectStream(locator),
		});
		const outcome = await this.finalization.applyScanResult(file, result);
		this.logger.log(`Scanned file ${fileId} with ${result.engine}: ${result.outcome} → ${outcome}`);
		return outcome;
	}

	/** Called when no further attempt will be made: the upload fails rather than ever being treated as clean. */
	public async failAfterExhaustedAttempts(fileId: string, reason: string): Promise<VerdictOutcome> {
		const file = await this.repository.findById(fileId);
		if (file === null) {
			return "SKIPPED";
		}
		return this.finalization.failScan(file, `scan failed: ${reason}`);
	}
}
