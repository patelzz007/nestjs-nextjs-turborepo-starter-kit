import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { StorageDeleteJobSchema } from "@workspace/shared";

import type { FileObjectStoragePort } from "../../ports/file-object-storage.port";
import { FILE_OBJECT_STORAGE } from "../../ports/files.tokens";
import { PurgeFileObjectCommand } from "./purge-file-object.command";

/** Deleting an object that is already gone succeeds, so a redelivered job is harmless. */
@CommandHandler(PurgeFileObjectCommand)
export class PurgeFileObjectHandler implements ICommandHandler<PurgeFileObjectCommand, void> {
	private readonly logger: Logger = new Logger(PurgeFileObjectHandler.name);

	public constructor(@Inject(FILE_OBJECT_STORAGE) private readonly storage: FileObjectStoragePort) {}

	public async execute(command: PurgeFileObjectCommand): Promise<void> {
		const job = StorageDeleteJobSchema.parse(command.job);
		await this.storage.deleteObject({ provider: job.provider, container: job.container, path: job.path });
		this.logger.log(`Physically deleted object for file ${job.fileId}`);
	}
}
