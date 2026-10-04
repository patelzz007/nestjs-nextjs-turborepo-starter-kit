import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTestTypedConfig } from "../../../../../test/support/test-api-env";
import { digestStream } from "../../utils/object-stream.util";
import { LocalObjectStorageAdapter } from "./local-object-storage.adapter";
import { InvalidLocalObjectPathError } from "./local-object-path.util";
import { LocalTransferTokenService } from "./local-transfer-token.service";

const FILE_ID = "550e8400-e29b-41d4-a716-446655440000";
const LOCATOR = { provider: "local", container: "local-private-bucket", path: "kyb/doc 1.pdf" } satisfies { provider: "local"; container: string; path: string };
const TTL_SECONDS = 60;

describe("LocalObjectStorageAdapter", () => {
	let root: string;
	let tokens: LocalTransferTokenService;

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "local-storage-"));
		tokens = new LocalTransferTokenService();
	});

	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	it("issues download links at the API's own address carrying a signed token bound to the file, container and key", async () => {
		const adapter = new LocalObjectStorageAdapter(createTestTypedConfig({ HOST: "127.0.0.1", PORT: "8080" }), tokens, root);

		const url = new URL(await adapter.getSignedDownloadUrl({ locator: LOCATOR, fileId: FILE_ID, expiresInSeconds: TTL_SECONDS }));

		expect(`${url.origin}${url.pathname}`).toBe("http://127.0.0.1:8080/api/v1/files/local-download");
		expect([...url.searchParams.keys()]).toEqual(["token"]);
		expect(tokens.verifyDownload(url.searchParams.get("token") ?? "")).toMatchObject({ fileId: FILE_ID, container: LOCATOR.container, path: LOCATOR.path });
	});

	it("uses API_PUBLIC_URL when the API sits behind a proxy", async () => {
		const adapter = new LocalObjectStorageAdapter(createTestTypedConfig({ API_PUBLIC_URL: "https://api.example.com/" }), tokens, root);

		await expect(adapter.getSignedDownloadUrl({ locator: LOCATOR, fileId: FILE_ID, expiresInSeconds: TTL_SECONDS })).resolves.toMatch(
			/^https:\/\/api\.example\.com\/api\/v1\/files\/local-download\?token=/,
		);
	});

	it("issues upload tickets whose only fields are the key and a signed upload token", async () => {
		const adapter = new LocalObjectStorageAdapter(createTestTypedConfig(), tokens, root);

		const ticket = await adapter.createBrowserUploadTicket({
			locator: LOCATOR,
			mimeType: "application/pdf",
			maxBytes: 1_024,
			checksumSha256: "a".repeat(64),
			expiresInSeconds: TTL_SECONDS,
			metadata: { fileId: FILE_ID },
		});

		expect(ticket.uploadUrl).toMatch(new RegExp(`/api/v1/files/${FILE_ID}/local-upload$`));
		expect(Object.keys(ticket.fields ?? {})).toEqual(["key", "token"]);
		expect(tokens.verifyUpload(ticket.fields?.token ?? "")).toMatchObject({ fileId: FILE_ID, path: LOCATOR.path, maxBytes: 1_024, mimeType: "application/pdf" });
	});

	it("refuses to read, stream, write or sign anything outside its root", async () => {
		await writeFile(join(root, "secret.env"), "JWT_ACCESS_SECRET=leak");
		const adapter = new LocalObjectStorageAdapter(createTestTypedConfig(), tokens, join(root, "objects"));
		const escaping = { provider: "local", container: "local-private-bucket", path: "../../secret.env" } satisfies typeof LOCATOR;

		await expect(adapter.getObject(escaping)).rejects.toThrow(InvalidLocalObjectPathError);
		await expect(adapter.getObjectStream(escaping)).rejects.toThrow(InvalidLocalObjectPathError);
		await expect(adapter.upload({ locator: escaping, buffer: Buffer.from("x"), mimeType: "application/pdf" })).rejects.toThrow(InvalidLocalObjectPathError);
		await expect(adapter.getSignedDownloadUrl({ locator: escaping, fileId: FILE_ID, expiresInSeconds: TTL_SECONDS })).rejects.toThrow(InvalidLocalObjectPathError);
	});

	it("returns null for a missing object and streams an existing one", async () => {
		const adapter = new LocalObjectStorageAdapter(createTestTypedConfig(), tokens, root);
		await expect(adapter.getObjectStream(LOCATOR)).resolves.toBeNull();
		await expect(adapter.headObject(LOCATOR)).resolves.toBeNull();

		await mkdir(join(root, "local-private-bucket", "kyb"), { recursive: true });
		await writeFile(join(root, "local-private-bucket", "kyb", "doc 1.pdf"), "%PDF-1.7");
		const stream = await adapter.getObjectStream(LOCATOR);

		expect(stream).not.toBeNull();
		if (stream !== null) {
			await expect(digestStream(stream)).resolves.toMatchObject({ sizeBytes: 8 });
		}
		await expect(adapter.headObject(LOCATOR)).resolves.toMatchObject({ sizeBytes: 8 });
	});

	it("publishes public assets by file id, never by raw object path", async () => {
		const adapter = new LocalObjectStorageAdapter(createTestTypedConfig({ HOST: "127.0.0.1", PORT: "8080" }), tokens, root);

		await expect(adapter.publishAsset({ locator: LOCATOR, fileId: FILE_ID, mimeType: "image/png", fileName: "a.png" })).resolves.toEqual({
			publicUrl: `http://127.0.0.1:8080/api/v1/files/${FILE_ID}/local-public`,
			revision: null,
		});
	});
});
