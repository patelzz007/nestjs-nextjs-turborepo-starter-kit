import type { Command, Query } from "@nestjs/cqrs";
import { describe, expect, it } from "vitest";

import { systemActor, type ActorContext } from "../../../../../platform/application/actor-context";
import { ApplyFileProcessingResultCommand } from "../../../application/commands/apply-file-processing-result/apply-file-processing-result.command";
import { CompleteFileUploadCommand } from "../../../application/commands/complete-file-upload/complete-file-upload.command";
import { DeleteFileCommand } from "../../../application/commands/delete-file/delete-file.command";
import { RequestFileUploadCommand } from "../../../application/commands/request-file-upload/request-file-upload.command";
import { GetFileDownloadUrlQuery } from "../../../application/queries/get-file-download-url/get-file-download-url.query";
import { GetFileQuery } from "../../../application/queries/get-file/get-file.query";
import { FilesController, type FilesCommandDispatch, type FilesQueryDispatch } from "../files.controller";

const FILE_ID = "0b7c2a5e-6f1d-4c2e-9d3a-1f2e3d4c5b6a";
const ACTOR: ActorContext = systemActor("files.delete", "job", null, "controller test", null);

/** Raised by the recording bus after it recorded the message, so the route's own result is not needed. */
class Dispatched extends Error {}

/** Records every command and query the controller dispatches. */
class RecordingBus implements FilesCommandDispatch, FilesQueryDispatch {
	public readonly dispatched: object[] = [];

	public execute<TResult>(message: Command<TResult> | Query<TResult>): Promise<TResult> {
		this.dispatched.push(message);
		return Promise.reject(new Dispatched());
	}
}

function setup(): { files: FilesController; bus: RecordingBus } {
	const bus = new RecordingBus();
	return { files: new FilesController(bus, bus), bus };
}

describe("FilesController", () => {
	it("makes exactly one command or query call per route, with the request's actor", async () => {
		const { files, bus } = setup();

		await expect(
			files.createUploadUrl(ACTOR, { category: "USER_AVATAR", fileName: "a.png", mimeType: "image/png", sizeBytes: 1, checksumSha256: "a".repeat(64), userId: FILE_ID }),
		).rejects.toBeInstanceOf(Dispatched);
		await expect(files.completeUpload(ACTOR, { fileId: FILE_ID }, { checksumSha256: "a".repeat(64) })).rejects.toBeInstanceOf(Dispatched);
		await expect(files.getFile(ACTOR, { fileId: FILE_ID })).rejects.toBeInstanceOf(Dispatched);
		await expect(files.getDownloadUrl(ACTOR, { fileId: FILE_ID })).rejects.toBeInstanceOf(Dispatched);
		await expect(files.deleteFile(ACTOR, { fileId: FILE_ID })).rejects.toBeInstanceOf(Dispatched);
		await expect(files.processingCallback(ACTOR, "secret", { fileId: FILE_ID, status: "FAILED" })).rejects.toBeInstanceOf(Dispatched);

		expect(bus.dispatched.map((message) => message.constructor)).toEqual([
			RequestFileUploadCommand,
			CompleteFileUploadCommand,
			GetFileQuery,
			GetFileDownloadUrlQuery,
			DeleteFileCommand,
			ApplyFileProcessingResultCommand,
		]);
		expect(bus.dispatched.every((message) => "actor" in message && message.actor === ACTOR)).toBe(true);
		expect(bus.dispatched.at(-1)).toMatchObject({ callbackSecret: "secret" });
	});

	it("passes an absent callback secret on as null, for the command to refuse", async () => {
		const { files, bus } = setup();

		await expect(files.processingCallback(ACTOR, undefined, { fileId: FILE_ID, status: "FAILED" })).rejects.toBeInstanceOf(Dispatched);
		expect(bus.dispatched.at(0)).toMatchObject({ callbackSecret: null });
	});
});
