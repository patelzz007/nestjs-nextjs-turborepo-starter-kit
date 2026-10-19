import { Inject, Injectable } from "@nestjs/common";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { FileInUseAsRewardImageError, KybEvidenceRetainedError } from "../../../domain/errors/files.errors";
import type { FilesScope } from "../../files-scope";
import { fileNotFound } from "../../file-not-found";
import { FileReferenceGuardRegistry, type FileDeletionScopePolicy, type FileReferenceBlock, type FileReferenceSubject } from "../../ports/file-reference.port";
import { FILES_DELETE_OPERATION, FILES_UNIT_OF_WORK } from "../../ports/files.tokens";

/**
 * The one deletion path (the DeleteFile command, the stale-upload sweep, the
 * published StoredFileAccess). In one transaction: lock the live row and read its
 * renditions, ask every owner's reference guard, soft-delete, and collect
 * `FileDeleted` — owners release their rows in that same transaction
 * (mechanism 1) and the stored copies are withdrawn and purged after commit
 * (mechanism 2). Authorization is the caller's job, before this runs.
 *
 * The transaction runs in the actor's own RLS session unless an owner of the
 * category declared its binding rows bypass-only (catalog's `ProductImage`,
 * whose policy allows only `app_rls_bypass()`); then it runs as `files.delete`.
 */
@Injectable()
export class FileDeletion {
	public constructor(
		@Inject(FILES_UNIT_OF_WORK) private readonly uow: UnitOfWork<FilesScope>,
		@Inject(FileReferenceGuardRegistry) private readonly guards: FileDeletionScopePolicy,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async delete(actor: ActorContext, subject: FileReferenceSubject, deletedBy: string): Promise<void> {
		const work = async (scope: FilesScope): Promise<void> => {
			const file = await scope.storedFiles.lockForDeletion(subject.fileId);
			if (file === null) {
				throw fileNotFound();
			}
			throwIfBlocked(await scope.references.blockDelete(subject));
			file.delete(deletedBy, this.clock.now());
			if ((await scope.storedFiles.save(file)) === "lost-race") {
				throw fileNotFound();
			}
			scope.events.collectFrom(file);
		};
		if (this.guards.deletionScopeFor(subject.category) === "system-operation") {
			await this.uow.runSystemOperation(FILES_DELETE_OPERATION, actor, work);
			return;
		}
		await this.uow.run(actor, work);
	}
}

function throwIfBlocked(block: FileReferenceBlock | null): void {
	switch (block) {
		case null:
			return;
		case "KYB_EVIDENCE":
			throw new KybEvidenceRetainedError();
		case "REWARD_IMAGE":
			throw new FileInUseAsRewardImageError();
	}
}
