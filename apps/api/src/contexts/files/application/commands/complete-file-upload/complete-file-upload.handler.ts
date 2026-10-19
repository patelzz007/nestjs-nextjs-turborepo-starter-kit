import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { CompleteFileUploadResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { VerifiedUpload } from "../../../domain/aggregates/stored-file.aggregate";
import { FileUploadAlreadyCompletedError } from "../../../domain/errors/files.errors";
import type { StoredFileSaveOutcome } from "../../../domain/repositories/stored-file.repository";
import type { FilesScope } from "../../files-scope";
import { fileNotFound } from "../../file-not-found";
import { FileCategoryAccessRegistry, fileActorOf } from "../../ports/file-category-access.port";
import type { FileObjectStoragePort } from "../../ports/file-object-storage.port";
import { FILE_OBJECT_STORAGE, FILES_UNIT_OF_WORK, STORED_FILE_READS } from "../../ports/files.tokens";
import type { StoredFileReadPort } from "../../ports/stored-file-read.port";
import { StorageTaskDispatcher } from "../../ports/storage-task-dispatcher.port";
import { CompleteFileUploadCommand } from "./complete-file-upload.command";
import { completeFileUpload } from "./complete-file-upload";

/**
 * Only the uploader completes an upload, and the request names no organization, so the file is found
 * as the caller's OWN upload (a file uploaded by someone else is not found — existence never leaks).
 * After the category's access rule allowed it (membership, for an organization's file), the claim runs
 * in the uploader's RLS session within the file's organization (D28); the compare-and-set on PENDING
 * decides a race.
 * The response reflects the state after dispatch: SCANNING while a queued
 * scan runs, or the verdict when it ran inline.
 */
/** The actor acting within the file's organization (a personal file keeps the actor's own scope). */
function actingInOrganization(actor: ActorContext, organizationId: string | null): ActorContext {
	return actor.kind === "user" && organizationId !== null ? { ...actor, organizationId } : actor;
}

@CommandHandler(CompleteFileUploadCommand)
export class CompleteFileUploadHandler implements ICommandHandler<CompleteFileUploadCommand, CompleteFileUploadResponse> {
	public constructor(
		@Inject(FILES_UNIT_OF_WORK) private readonly uow: UnitOfWork<FilesScope>,
		@Inject(STORED_FILE_READS) private readonly reads: StoredFileReadPort,
		private readonly access: FileCategoryAccessRegistry,
		@Inject(FILE_OBJECT_STORAGE) private readonly storage: FileObjectStoragePort,
		private readonly dispatcher: StorageTaskDispatcher,
	) {}

	public async execute(command: CompleteFileUploadCommand): Promise<CompleteFileUploadResponse> {
		const { actor, fileId, input } = command;
		const file = await this.reads.findOwnUpload(actor, fileId);
		if (file === null) {
			throw fileNotFound();
		}
		await this.access.assertCanAct(actor, file, "complete");
		const uploader = fileActorOf(actor, "complete");
		const inFileOrganization = actingInOrganization(actor, file.organizationId);
		await completeFileUpload(this.storage, this.dispatcher, uploader.userId, file, input.checksumSha256, (verified: VerifiedUpload) =>
			this.uow.run(inFileOrganization, async (scope): Promise<StoredFileSaveOutcome> => {
				const live = await scope.storedFiles.findLive(fileId);
				if (live === null) {
					throw new FileUploadAlreadyCompletedError();
				}
				live.claimForScan(uploader.userId, input.checksumSha256, verified);
				return scope.storedFiles.save(live);
			}),
		);
		const after = await this.reads.findLive(inFileOrganization, fileId);
		if (after === null) {
			throw fileNotFound();
		}
		return { file: after.record };
	}
}
