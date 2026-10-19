import { describe, expect, it } from "vitest";

import { FixedClock } from "../../../../platform/application/__tests__/fixed-clock";
import { InMemoryUnitOfWork } from "../../../../platform/application/__tests__/fakes/in-memory-unit-of-work";
import { AuthorizationError } from "../../../../platform/application/errors/app-error";
import type { StoredFileObject } from "../../domain/aggregates/stored-file.aggregate";
import { FileInUseAsRewardImageError, KybEvidenceRetainedError } from "../../domain/errors/files.errors";
import { FileDeleted } from "../../domain/events/file-deleted.event";
import { DeleteFileCommand } from "../commands/delete-file/delete-file.command";
import { DeleteFileHandler } from "../commands/delete-file/delete-file.handler";
import { FileDeletion } from "../commands/delete-file/file-deletion";
import type { FilesScope } from "../files-scope";
import { FileCategoryAccessRegistry } from "../ports/file-category-access.port";
import { bindFileReferenceGuard, FileReferenceGuardRegistry, type FileReferenceBlock } from "../ports/file-reference.port";
import {
	FILE_ID,
	InMemoryStoredFileReads,
	InMemoryStoredFiles,
	NOW,
	RecordingAccessRule,
	UPLOADER_ID,
	filesScope,
	locator,
	storedFileState,
	userActor,
} from "./fakes/files.fakes";

interface Fixture {
	readonly handler: DeleteFileHandler;
	readonly files: InMemoryStoredFiles;
	readonly reads: InMemoryStoredFileReads;
	readonly uow: InMemoryUnitOfWork<FilesScope>;
	readonly scope: FilesScope;
	readonly rule: RecordingAccessRule;
}

function setup(state = storedFileState({ status: "READY" }), blocks: ReadonlyMap<string, FileReferenceBlock> = new Map(), guards = new FileReferenceGuardRegistry()): Fixture {
	const files = new InMemoryStoredFiles(state);
	const reads = new InMemoryStoredFileReads(files);
	const scope = filesScope(files, blocks);
	const uow = new InMemoryUnitOfWork(scope);
	const rule = new RecordingAccessRule(["MERCHANT_KYB", "REWARD_IMAGE", "PRODUCT_IMAGE"]);
	const access = new FileCategoryAccessRegistry();
	access.register(rule);
	return { handler: new DeleteFileHandler(reads, access, new FileDeletion(uow, guards, new FixedClock(NOW))), files, reads, uow, scope, rule };
}

describe("DeleteFileHandler", () => {
	it("authorizes, locks the row with its renditions, soft-deletes as the acting user and collects FileDeleted", async () => {
		const rendition: StoredFileObject = { slot: "THUMBNAIL", locator: locator("stores/o/thumb.webp"), publicPath: "https://cdn.test/t" };
		const fixture = setup(storedFileState({ status: "READY", renditions: [rendition] }));

		await fixture.handler.execute(new DeleteFileCommand(userActor(), FILE_ID));

		expect(fixture.rule.acts.map((act) => act.action)).toEqual(["delete"]);
		expect(fixture.files.locked).toEqual([FILE_ID]);
		expect(fixture.files.deletedBy).toEqual([UPLOADER_ID]);
		expect(fixture.files.status(FILE_ID)).toBe("DELETED");
		const events = fixture.scope.events.take();
		expect(events).toHaveLength(1);
		expect(events.at(0)).toBeInstanceOf(FileDeleted);
		expect(events.at(0)).toMatchObject({ deletedBy: UPLOADER_ID, occurredAt: NOW, objects: [{ slot: "ORIGINAL" }, { slot: "THUMBNAIL" }] });
		expect(fixture.uow.committed).toEqual([{ actor: userActor(), operation: null }]);
	});

	it("is not found for a deleted or invisible file and for a delete that lost a race", async () => {
		const hidden = setup();
		hidden.reads.hidden.add(FILE_ID);
		await expect(hidden.handler.execute(new DeleteFileCommand(userActor(), FILE_ID))).rejects.toMatchObject({ code: "FILE_NOT_FOUND" });

		const raced = setup();
		raced.files.raceOnNextSave = true;
		await expect(raced.handler.execute(new DeleteFileCommand(userActor(), FILE_ID))).rejects.toMatchObject({ code: "FILE_NOT_FOUND" });
		expect(raced.scope.events.take()).toEqual([]);
		expect(raced.uow.rolledBack).toHaveLength(1);
	});

	it("saves nothing when the owner denies the delete", async () => {
		const fixture = setup();
		fixture.rule.denial = new AuthorizationError({ code: "FILE_DELETE_FORBIDDEN", message: "no" });

		await expect(fixture.handler.execute(new DeleteFileCommand(userActor(), FILE_ID))).rejects.toBe(fixture.rule.denial);
		expect(fixture.files.locked).toEqual([]);
		expect(fixture.files.status(FILE_ID)).toBe("READY");
	});

	it.each<[FileReferenceBlock, new () => Error]>([
		["KYB_EVIDENCE", KybEvidenceRetainedError],
		["REWARD_IMAGE", FileInUseAsRewardImageError],
	])("refuses when an owner's guard reports %s, and rolls back", async (block, error) => {
		const fixture = setup(storedFileState({ status: "READY" }), new Map([[FILE_ID, block]]));

		await expect(fixture.handler.execute(new DeleteFileCommand(userActor(), FILE_ID))).rejects.toBeInstanceOf(error);
		expect(fixture.files.status(FILE_ID)).toBe("READY");
		expect(fixture.scope.events.take()).toEqual([]);
		expect(fixture.uow.rolledBack).toHaveLength(1);
	});

	it("runs as files.delete when an owner's binding rows are bypass-only (catalog's product images)", async () => {
		const guards = new FileReferenceGuardRegistry();
		guards.register(
			bindFileReferenceGuard(
				{ categories: ["PRODUCT_IMAGE"], deletionScope: "system-operation", blockDelete: (): Promise<null> => Promise.resolve(null) },
				{ create: (): object => ({}) },
			),
		);
		const fixture = setup(storedFileState({ status: "READY", category: "PRODUCT_IMAGE", organizationId: null, productId: "p-1" }), new Map(), guards);

		await fixture.handler.execute(new DeleteFileCommand(userActor(), FILE_ID));

		expect(fixture.uow.committed).toEqual([{ actor: userActor(), operation: "files.delete" }]);
	});
});
