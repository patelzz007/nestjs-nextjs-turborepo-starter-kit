import type { CreateFileUploadUrlInput } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { InMemoryUnitOfWork } from "../../../../platform/application/__tests__/fakes/in-memory-unit-of-work";
import { AuthorizationError } from "../../../../platform/application/errors/app-error";
import { FileTooLargeError, FileUploadForbiddenError } from "../../domain/errors/files.errors";
import { RequestFileUploadCommand } from "../commands/request-file-upload/request-file-upload.command";
import { RequestFileUploadHandler } from "../commands/request-file-upload/request-file-upload.handler";
import type { FilesScope } from "../files-scope";
import { FileCategoryAccessRegistry } from "../ports/file-category-access.port";
import {
	CHECKSUM,
	FakeFileObjectStorage,
	InMemoryStoredFiles,
	ORG_ID,
	OTHER_USER_ID,
	RecordingAccessRule,
	UPLOADER_ID,
	cleanupActor,
	filesScope,
	userActor,
} from "./fakes/files.fakes";

function setup(): {
	handler: RequestFileUploadHandler;
	files: InMemoryStoredFiles;
	uow: InMemoryUnitOfWork<FilesScope>;
	storage: FakeFileObjectStorage;
	rule: RecordingAccessRule;
} {
	const files = new InMemoryStoredFiles();
	const uow = new InMemoryUnitOfWork(filesScope(files));
	const storage = new FakeFileObjectStorage();
	const rule = new RecordingAccessRule(["MERCHANT_KYB", "USER_AVATAR"]);
	const access = new FileCategoryAccessRegistry();
	access.register(rule);
	return { handler: new RequestFileUploadHandler(uow, access, storage), files, uow, storage, rule };
}

const KYB_REQUEST: CreateFileUploadUrlInput = {
	category: "MERCHANT_KYB",
	fileName: "licence.pdf",
	mimeType: "application/pdf",
	sizeBytes: 10,
	checksumSha256: CHECKSUM,
	tenantId: ORG_ID,
};

describe("RequestFileUploadHandler", () => {
	it("authorizes through the owner's rule, adds a PENDING file in the uploader's unit of work, then issues the ticket", async () => {
		const { handler, files, uow, storage, rule } = setup();
		const actor = userActor();

		const ticket = await handler.execute(new RequestFileUploadCommand(actor, KYB_REQUEST));

		expect(rule.uploads).toEqual([{ actor: { userId: UPLOADER_ID, isSuperAdmin: false }, request: KYB_REQUEST }]);
		expect(files.added).toHaveLength(1);
		expect(files.added.at(0)).toMatchObject({ category: "MERCHANT_KYB", uploadedById: UPLOADER_ID, tenantId: ORG_ID, status: "PENDING" });
		expect(uow.committed).toEqual([{ actor, operation: null }]);
		expect(storage.tickets.map((request) => request.fileId)).toEqual([ticket.fileId]);
		expect(ticket.objectPath).toContain(ORG_ID);
	});

	it("saves nothing and issues no ticket when the owner denies the upload", async () => {
		const { handler, files, storage, rule } = setup();
		rule.denial = new AuthorizationError({ code: "FILE_UPLOAD_FORBIDDEN", message: "no" });

		await expect(handler.execute(new RequestFileUploadCommand(userActor(), KYB_REQUEST))).rejects.toBe(rule.denial);
		expect(files.added).toEqual([]);
		expect(storage.tickets).toEqual([]);
	});

	it("refuses a request outside the category policy before anything is saved", async () => {
		const { handler, files } = setup();

		await expect(handler.execute(new RequestFileUploadCommand(userActor(), { ...KYB_REQUEST, sizeBytes: Number.MAX_SAFE_INTEGER }))).rejects.toBeInstanceOf(FileTooLargeError);
		expect(files.added).toEqual([]);
	});

	it("refuses an avatar for another user even when the rule would allow it (a SuperAdmin too)", async () => {
		const { handler, files } = setup();
		const avatar: CreateFileUploadUrlInput = {
			category: "USER_AVATAR",
			fileName: "a.png",
			mimeType: "image/png",
			sizeBytes: 10,
			checksumSha256: CHECKSUM,
			userId: OTHER_USER_ID,
		};

		await expect(handler.execute(new RequestFileUploadCommand(userActor(UPLOADER_ID, true), avatar))).rejects.toBeInstanceOf(FileUploadForbiddenError);
		expect(files.added).toEqual([]);
	});

	it("refuses a caller that is not a user session", async () => {
		const { handler, files } = setup();

		await expect(handler.execute(new RequestFileUploadCommand(cleanupActor(), KYB_REQUEST))).rejects.toMatchObject({ code: "FILE_UPLOAD_FORBIDDEN" });
		expect(files.added).toEqual([]);
	});
});
