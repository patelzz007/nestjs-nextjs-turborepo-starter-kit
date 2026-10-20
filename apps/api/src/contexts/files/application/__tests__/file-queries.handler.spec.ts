import type { FileStatus } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { AuthorizationError } from "../../../../platform/application/errors/app-error";
import { FileCategoryAccessRegistry } from "../ports/file-category-access.port";
import { GetFileDownloadUrlHandler } from "../queries/get-file-download-url/get-file-download-url.handler";
import { GetFileDownloadUrlQuery } from "../queries/get-file-download-url/get-file-download-url.query";
import { GetFileHandler } from "../queries/get-file/get-file.handler";
import { GetFileQuery } from "../queries/get-file/get-file.query";
import { FILE_ID, FakeFileObjectStorage, InMemoryStoredFileReads, InMemoryStoredFiles, RecordingAccessRule, storedFileState, userActor } from "./fakes/files.fakes";

function setup(status: FileStatus = "READY"): { reads: InMemoryStoredFileReads; access: FileCategoryAccessRegistry; rule: RecordingAccessRule } {
	const reads = new InMemoryStoredFileReads(new InMemoryStoredFiles(storedFileState({ status })));
	const rule = new RecordingAccessRule(["MERCHANT_KYB"]);
	const access = new FileCategoryAccessRegistry();
	access.register(rule);
	return { reads, access, rule };
}

describe("GetFileHandler", () => {
	it("returns the file record after the owner's read check", async () => {
		const { reads, access, rule } = setup();

		await expect(new GetFileHandler(reads, access).execute(new GetFileQuery(userActor(), FILE_ID))).resolves.toMatchObject({ file: { id: FILE_ID, status: "READY" } });
		expect(rule.acts.map((act) => act.action)).toEqual(["read"]);
	});

	it("is not found for an invisible file and forbidden when the owner denies", async () => {
		const hidden = setup();
		hidden.reads.hidden.add(FILE_ID);
		await expect(new GetFileHandler(hidden.reads, hidden.access).execute(new GetFileQuery(userActor(), FILE_ID))).rejects.toMatchObject({ code: "FILE_NOT_FOUND" });

		const denied = setup();
		denied.rule.denial = new AuthorizationError({ code: "FILE_VIEW_FORBIDDEN", message: "no" });
		await expect(new GetFileHandler(denied.reads, denied.access).execute(new GetFileQuery(userActor(), FILE_ID))).rejects.toBe(denied.rule.denial);
	});
});

describe("GetFileDownloadUrlHandler", () => {
	it("signs a URL for a READY file", async () => {
		const { reads, access } = setup();

		await expect(new GetFileDownloadUrlHandler(reads, access, new FakeFileObjectStorage()).execute(new GetFileDownloadUrlQuery(userActor(), FILE_ID))).resolves.toMatchObject({
			downloadUrl: `https://storage.test/${FILE_ID}`,
		});
	});

	it.each<FileStatus>(["PENDING", "SCANNING", "QUARANTINED", "FAILED"])("issues no URL while the file is %s", async (status: FileStatus) => {
		const { reads, access } = setup(status);

		await expect(new GetFileDownloadUrlHandler(reads, access, new FakeFileObjectStorage()).execute(new GetFileDownloadUrlQuery(userActor(), FILE_ID))).resolves.toMatchObject({
			downloadUrl: null,
			expiresAt: null,
		});
	});
});
