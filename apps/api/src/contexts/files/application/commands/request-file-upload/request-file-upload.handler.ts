import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { CreateFileUploadUrlResponse } from "@workspace/shared";

import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { FilesScope } from "../../files-scope";
import { FileCategoryAccessRegistry, fileActorOf } from "../../ports/file-category-access.port";
import type { FileObjectStoragePort } from "../../ports/file-object-storage.port";
import { FILE_OBJECT_STORAGE, FILES_UNIT_OF_WORK } from "../../ports/files.tokens";
import { RequestFileUploadCommand } from "./request-file-upload.command";
import { requestFileUpload } from "./request-file-upload";

@CommandHandler(RequestFileUploadCommand)
export class RequestFileUploadHandler implements ICommandHandler<RequestFileUploadCommand, CreateFileUploadUrlResponse> {
	public constructor(
		@Inject(FILES_UNIT_OF_WORK) private readonly uow: UnitOfWork<FilesScope>,
		private readonly access: FileCategoryAccessRegistry,
		@Inject(FILE_OBJECT_STORAGE) private readonly storage: FileObjectStoragePort,
	) {}

	public async execute(command: RequestFileUploadCommand): Promise<CreateFileUploadUrlResponse> {
		const { actor, input } = command;
		await this.access.assertCanUpload(actor, input);
		const uploader = fileActorOf(actor, "upload");
		return requestFileUpload(this.storage, uploader.userId, input, (file) => this.uow.run(actor, (scope) => scope.storedFiles.add(file)));
	}
}
