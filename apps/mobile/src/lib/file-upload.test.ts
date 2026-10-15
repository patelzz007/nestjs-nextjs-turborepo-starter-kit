import type { DataValue } from "@workspace/shared";

import { ok, stubApi } from "../../test/api-stub";
import { createTestRuntime } from "../../test/app-harness";
import * as fileSystem from "../../test/expo-file-system-fake";
import { testAccessToken } from "../../test/jwt";
import { FileUploadRejectedError, uploadLocalFile, type FileUploadApi } from "./file-upload";

const FILE_ID = "4d9a3f5e-2f6b-4c55-8f0c-9a4b1c2d3e4f";
const USER_ID = "7c1e2b3a-4d5f-4a6b-8c7d-9e0f1a2b3c4d";
const PHOTO = { uri: "file:///photos/shot.png", name: "shot.png", mimeType: "image/png" } satisfies Parameters<typeof uploadLocalFile>[2];

function fileJson(status: string): DataValue {
	return {
		file: {
			id: FILE_ID,
			category: "GITHUB_COMMENT_IMAGE",
			visibility: "PUBLIC",
			originalName: "shot.png",
			mimeType: "image/png",
			sizeBytes: 3,
			status,
			scanStatus: status === "READY" ? "NOT_SCANNED" : null,
			publicUrl: status === "READY" ? "https://cdn.example.com/a.png" : null,
			uploadedAt: 0,
		},
	};
}

function signedPutRoutes(): Parameters<typeof stubApi>[0] {
	return {
		"POST /files/upload-url": ok({
			fileId: FILE_ID,
			objectPath: "staging/users/u/github-comment-images/shot.png",
			expiresIn: 300,
			method: "PUT",
			uploadUrl: "https://storage.example.com/signed-put",
			headers: { "Content-Type": "image/png" },
		}),
		[`POST /files/${FILE_ID}/complete`]: ok(fileJson("SCANNING")),
		[`GET /files/${FILE_ID}`]: ok(fileJson("READY")),
	};
}

async function signedInApi(): Promise<FileUploadApi> {
	const runtime = createTestRuntime({}, { status: "signedIn", session: { scope: "full" } });
	await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
	return runtime.apiClient.api;
}

describe("uploadLocalFile", () => {
	beforeEach(() => {
		fileSystem.putFile(PHOTO.uri, new Uint8Array([1, 2, 3]));
	});

	it("PUTs the bytes with a signed PUT ticket's headers, then resolves the READY file", async () => {
		const api = stubApi(signedPutRoutes());

		const file = await uploadLocalFile(await signedInApi(), { category: "GITHUB_COMMENT_IMAGE", userId: USER_ID }, PHOTO);

		expect(file).toMatchObject({ id: FILE_ID, status: "READY", publicUrl: "https://cdn.example.com/a.png" });
		expect(fileSystem.uploads()).toMatchObject([
			{ uri: PHOTO.uri, url: "https://storage.example.com/signed-put", options: { httpMethod: "PUT", headers: { "Content-Type": "image/png" } } },
		]);
		expect(JSON.parse(api.callsTo(`POST /files/${FILE_ID}/complete`).at(0)?.body ?? "{}")).toEqual({
			// SHA-256 of the bytes 01 02 03.
			checksumSha256: "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81",
		});
	});

	it("never confirms an upload storage refused", async () => {
		const api = stubApi(signedPutRoutes());
		fileSystem.answerUploadsWith(403);

		await expect(uploadLocalFile(await signedInApi(), { category: "GITHUB_COMMENT_IMAGE", userId: USER_ID }, PHOTO)).rejects.toMatchObject({ status: 403 });
		expect(api.callsTo(`POST /files/${FILE_ID}/complete`)).toHaveLength(0);
	});

	it("reports storage it could not reach without a status", async () => {
		stubApi(signedPutRoutes());
		jest.spyOn(fileSystem.File.prototype, "upload").mockRejectedValue(new Error("offline"));

		const upload = uploadLocalFile(await signedInApi(), { category: "GITHUB_COMMENT_IMAGE", userId: USER_ID }, PHOTO);

		await expect(upload).rejects.toBeInstanceOf(FileUploadRejectedError);
		await expect(upload).rejects.toMatchObject({ status: null, message: "Storage could not be reached. Check your connection and try again." });
	});
});
