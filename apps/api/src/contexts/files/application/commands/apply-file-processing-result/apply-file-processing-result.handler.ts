import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { FileProcessingResultSchema } from "@workspace/shared";

import type { FileProcessingPort, ProcessingCallbackAuthenticator } from "../../ports/file-processing.port";
import { FILE_PROCESSING, PROCESSING_CALLBACK_AUTHENTICATOR } from "../../ports/files.tokens";
import { ApplyFileProcessingResultCommand } from "./apply-file-processing-result.command";

/**
 * Authenticates the worker's shared secret first (fail closed, constant time),
 * then applies the verdict: the verdict transaction records `FileVerdictReached`
 * (mechanism 1); a replay after the file left SCANNING is a 409.
 */
@CommandHandler(ApplyFileProcessingResultCommand)
export class ApplyFileProcessingResultHandler implements ICommandHandler<ApplyFileProcessingResultCommand, void> {
	public constructor(
		@Inject(PROCESSING_CALLBACK_AUTHENTICATOR) private readonly authenticator: ProcessingCallbackAuthenticator,
		@Inject(FILE_PROCESSING) private readonly processing: FileProcessingPort,
	) {}

	public async execute(command: ApplyFileProcessingResultCommand): Promise<void> {
		this.authenticator.assertAuthentic(command.callbackSecret);
		await this.processing.applyProcessingResult(command.actor, FileProcessingResultSchema.parse(command.input));
	}
}
