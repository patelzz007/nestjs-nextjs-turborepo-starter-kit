import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import type { FileProcessingPort, VerdictOutcome } from "../../ports/file-processing.port";
import { FILE_PROCESSING } from "../../ports/files.tokens";
import { ScanFileCommand } from "./scan-file.command";

/**
 * Idempotent: a file no longer awaiting a verdict (redelivered job, already
 * decided, deleted) is SKIPPED. A scanner outage before the final attempt is
 * rethrown so BullMQ retries with backoff; on the final attempt the upload
 * FAILS — it is never treated as clean.
 */
@CommandHandler(ScanFileCommand)
export class ScanFileHandler implements ICommandHandler<ScanFileCommand, VerdictOutcome> {
	public constructor(@Inject(FILE_PROCESSING) private readonly processing: FileProcessingPort) {}

	public async execute(command: ScanFileCommand): Promise<VerdictOutcome> {
		return this.processing.scan(command.actor, command.fileId, command.finalAttempt);
	}
}
