import { HttpStatus } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { InMemoryUnitOfWork } from "../../../../platform/application/__tests__/fakes/in-memory-unit-of-work";
import { AppError, AuthorizationError } from "../../../../platform/application/errors/app-error";
import { FileChecksumMismatchError, FileUploadAlreadyCompletedError } from "../../domain/errors/files.errors";
import { CompleteFileUploadCommand } from "../commands/complete-file-upload/complete-file-upload.command";
import { CompleteFileUploadHandler } from "../commands/complete-file-upload/complete-file-upload.handler";
import type { FilesScope } from "../files-scope";
import { FileCategoryAccessRegistry } from "../ports/file-category-access.port";
import {
	CHECKSUM,
	FILE_ID,
	FakeFileObjectStorage,
	InMemoryStoredFileReads,
	InMemoryStoredFiles,
	OTHER_USER_ID,
	RecordingAccessRule,
	RecordingStorageTaskDispatcher,
	filesScope,
	ORG_ID,
	storedFileState,
	userActor,
} from "./fakes/files.fakes";

interface Fixture {
	readonly handler: CompleteFileUploadHandler;
	readonly files: InMemoryStoredFiles;
	readonly reads: InMemoryStoredFileReads;
	readonly uow: InMemoryUnitOfWork<FilesScope>;
	readonly storage: FakeFileObjectStorage;
	readonly dispatcher: RecordingStorageTaskDispatcher;
	readonly rule: RecordingAccessRule;
}

function setup(state = storedFileState()): Fixture {
	const files = new InMemoryStoredFiles(state);
	const reads = new InMemoryStoredFileReads(files);
	const uow = new InMemoryUnitOfWork(filesScope(files));
	const storage = new FakeFileObjectStorage();
	const dispatcher = new RecordingStorageTaskDispatcher();
	const rule = new RecordingAccessRule(["MERCHANT_KYB"]);
	const access = new FileCategoryAccessRegistry();
	access.register(rule);
	return { handler: new CompleteFileUploadHandler(uow, reads, access, storage, dispatcher), files, reads, uow, storage, dispatcher, rule };
}

const complete = (userId?: string): CompleteFileUploadCommand => new CompleteFileUploadCommand(userActor(userId), FILE_ID, { checksumSha256: CHECKSUM });

describe("CompleteFileUploadHandler", () => {
	it("verifies the bytes, claims SCANNING in the uploader's unit of work and dispatches the scan — it never marks the file clean itself", async () => {
		const { handler, files, uow, storage, dispatcher, rule } = setup();

		const result = await handler.execute(complete());

		expect(result.file.status).toBe("SCANNING");
		expect(files.status(FILE_ID)).toBe("SCANNING");
		expect(files.verified).toEqual([storage.verification]);
		expect(dispatcher.scans).toEqual([FILE_ID]);
		expect(rule.acts.map((act) => act.action)).toEqual(["complete"]);
		expect(uow.committed.map((entry) => entry.actor.kind)).toEqual(["user"]);
	});

	it("completes a tenant's file acting within that tenant, though the request named none", async () => {
		const { handler, uow } = setup();

		await handler.execute(complete());

		expect(complete().actor.tenantId).toBeNull();
		expect(uow.committed.map((entry) => entry.actor.tenantId)).toEqual([ORG_ID]);
	});

	it("is not found for a file someone else uploaded — existence never leaks — and nothing is read or dispatched", async () => {
		const { handler, storage, dispatcher } = setup();

		await expect(handler.execute(complete(OTHER_USER_ID))).rejects.toMatchObject({ code: "FILE_NOT_FOUND" });
		expect(storage.verifiedChecksums).toEqual([]);
		expect(dispatcher.scans).toEqual([]);
	});

	it("stops at the owner's denial before the bytes are read", async () => {
		const { handler, storage, rule } = setup();
		rule.denial = new AuthorizationError({ code: "FILE_UPLOAD_FORBIDDEN", message: "no" });

		await expect(handler.execute(complete())).rejects.toBe(rule.denial);
		expect(storage.verifiedChecksums).toEqual([]);
	});

	it("refuses a completed upload and a wrong checksum before reading the bytes", async () => {
		await expect(setup(storedFileState({ status: "READY" })).handler.execute(complete())).rejects.toBeInstanceOf(FileUploadAlreadyCompletedError);
		const fixture = setup();
		await expect(fixture.handler.execute(new CompleteFileUploadCommand(userActor(), FILE_ID, { checksumSha256: "b".repeat(64) }))).rejects.toBeInstanceOf(
			FileChecksumMismatchError,
		);
		expect(fixture.storage.verifiedChecksums).toEqual([]);
	});

	it("leaves the file PENDING and dispatches nothing when verification rejects the bytes", async () => {
		const { handler, files, storage, dispatcher } = setup();
		storage.verificationError = new AppError({ code: "FILE_CONTENT_TYPE_MISMATCH", httpStatus: HttpStatus.BAD_REQUEST, message: "mismatch" });

		await expect(handler.execute(complete())).rejects.toBe(storage.verificationError);
		expect(files.status(FILE_ID)).toBe("PENDING");
		expect(dispatcher.scans).toEqual([]);
	});

	it("answers 409 to the loser of a concurrent completion and dispatches only once", async () => {
		const { handler, files, dispatcher } = setup();
		files.raceOnNextSave = true;

		await expect(handler.execute(complete())).rejects.toBeInstanceOf(FileUploadAlreadyCompletedError);
		await expect(handler.execute(complete())).resolves.toMatchObject({ file: { status: "SCANNING" } });
		expect(dispatcher.scans).toEqual([FILE_ID]);
	});
});
