import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { fileNotFound } from "../../file-not-found";
import { FileCategoryAccessRegistry, fileActorOf } from "../../ports/file-category-access.port";
import { STORED_FILE_READS } from "../../ports/files.tokens";
import type { StoredFileReadPort } from "../../ports/stored-file-read.port";
import { DeleteFileCommand } from "./delete-file.command";
import { FileDeletion } from "./file-deletion";

/** Tenant files are deleted by whoever holds the capability now — not by a former member who uploaded them. */
@CommandHandler(DeleteFileCommand)
export class DeleteFileHandler implements ICommandHandler<DeleteFileCommand, void> {
	public constructor(
		@Inject(STORED_FILE_READS) private readonly reads: StoredFileReadPort,
		private readonly access: FileCategoryAccessRegistry,
		private readonly deletion: FileDeletion,
	) {}

	public async execute(command: DeleteFileCommand): Promise<void> {
		const { actor, fileId } = command;
		const file = await this.reads.findLive(actor, fileId);
		if (file === null) {
			throw fileNotFound();
		}
		await this.access.assertCanAct(actor, file, "delete");
		await this.deletion.delete(actor, { fileId: file.id, category: file.category, tenantId: file.tenantId }, fileActorOf(actor, "delete").userId);
	}
}
