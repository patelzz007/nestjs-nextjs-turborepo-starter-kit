import { describe, expect, it } from "vitest";

import { createTestTypedConfig } from "../../../../../test/support/test-api-env";
import { LocalObjectStorageAdapter } from "./local-object-storage.adapter";

const LOCATOR = { provider: "local", container: "local-private-bucket", path: "kyb/doc 1.pdf" } satisfies { provider: "local"; container: string; path: string };

describe("LocalObjectStorageAdapter URLs", () => {
	it("points download links at the API's own address (HOST:PORT by default), not a frontend URL", async () => {
		const adapter = new LocalObjectStorageAdapter(createTestTypedConfig({ HOST: "127.0.0.1", PORT: "8080" }));

		await expect(adapter.getSignedDownloadUrl({ locator: LOCATOR, expiresInSeconds: 60 })).resolves.toBe(
			"http://127.0.0.1:8080/api/v1/files/local-download?container=local-private-bucket&path=kyb%2Fdoc%201.pdf",
		);
	});

	it("uses API_PUBLIC_URL when the API sits behind a proxy", async () => {
		const adapter = new LocalObjectStorageAdapter(createTestTypedConfig({ API_PUBLIC_URL: "https://api.example.com/" }));

		await expect(adapter.getSignedDownloadUrl({ locator: LOCATOR, expiresInSeconds: 60 })).resolves.toMatch(/^https:\/\/api\.example\.com\/api\/v1\/files\/local-download\?/);
	});
});
