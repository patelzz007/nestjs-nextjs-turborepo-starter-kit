import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { StorageCdnInvalidationJobSchema } from "@workspace/shared";

import type { CdnInvalidationPort } from "../../ports/file-processing.port";
import { CDN_INVALIDATION } from "../../ports/files.tokens";
import { InvalidateFileCdnCommand } from "./invalidate-file-cdn.command";

/**
 * One attempt; a rejection is BullMQ's signal to retry with backoff. The
 * per-file reference makes a retry after a lost response the same invalidation.
 */
@CommandHandler(InvalidateFileCdnCommand)
export class InvalidateFileCdnHandler implements ICommandHandler<InvalidateFileCdnCommand, void> {
	private readonly logger: Logger = new Logger(InvalidateFileCdnHandler.name);

	public constructor(@Inject(CDN_INVALIDATION) private readonly cdn: CdnInvalidationPort) {}

	public async execute(command: InvalidateFileCdnCommand): Promise<void> {
		const job = StorageCdnInvalidationJobSchema.parse(command.job);
		await this.cdn.invalidate(job);
		this.logger.log(`Invalidated CDN cache for withdrawn file ${job.fileId}`);
	}
}
