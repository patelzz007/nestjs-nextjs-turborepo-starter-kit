import type { StorageObjectLocator } from "@workspace/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { copyObjectResponse, EMPTY_SUCCESS_RESPONSE, RecordingS3Transport, type CannedS3Response } from "../../../../../test/support/s3-recording-transport";
import { createS3Client } from "./s3-client.factory";
import { encodeObjectKey, S3ObjectStorageAdapter } from "./s3-object-storage.adapter";

const REGION = "ap-southeast-1";
const PRIVATE_BUCKET = "app-test-private";
const PUBLIC_BUCKET = "app-test-public-origin";
const CDN_HOST = "d111111abcdef8.cloudfront.net";
const FILE_ID = "11111111-1111-4111-8111-111111111111";
const FINAL_KEY = `products/22222222-2222-4222-8222-222222222222/original/${FILE_ID}.png`;
/** Temporary credentials as an assumed IAM role hands them out (ASIA… key + session token). */
const ROLE_ACCESS_KEY_ID = "ASIATESTONLYROLEKEY1";
const ROLE_SESSION_TOKEN = "test-only-role-session-token";

function locator(container: string, path: string): StorageObjectLocator {
	return { provider: "s3", container, path, revision: null };
}

function adapterWith(reply: CannedS3Response): { adapter: S3ObjectStorageAdapter; transport: RecordingS3Transport } {
	const transport = new RecordingS3Transport(reply);
	const adapter = new S3ObjectStorageAdapter(createS3Client({ region: REGION, requestHandler: transport }), { publicContainer: PUBLIC_BUCKET, cdnHost: CDN_HOST });
	return { adapter, transport };
}

describe("S3ObjectStorageAdapter", () => {
	beforeEach((): void => {
		// What the default credential chain finds for an assumed role (ECS/EKS expose the same triple to the SDK).
		vi.stubEnv("AWS_PROFILE", undefined);
		vi.stubEnv("AWS_ACCESS_KEY_ID", ROLE_ACCESS_KEY_ID);
		vi.stubEnv("AWS_SECRET_ACCESS_KEY", "test-only-role-secret");
		vi.stubEnv("AWS_SESSION_TOKEN", ROLE_SESSION_TOKEN);
	});

	afterEach((): void => {
		vi.unstubAllEnvs();
	});

	describe("public delivery", () => {
		it("publishes a READY public asset by copying it into the CloudFront origin bucket and links to the CDN", async () => {
			const { adapter, transport } = adapterWith(copyObjectResponse("etag-public"));

			const result = await adapter.publishAsset({ locator: locator(PRIVATE_BUCKET, FINAL_KEY), fileId: FILE_ID, mimeType: "image/png", fileName: "shoe.png" });

			expect(result).toEqual({ publicUrl: `https://${CDN_HOST}/${FINAL_KEY}`, revision: "etag-public" });
			const request = transport.single();
			expect(request.method).toBe("PUT");
			expect(request.hostname).toBe(`${PUBLIC_BUCKET}.s3.${REGION}.amazonaws.com`);
			expect(request.path).toBe(`/${FINAL_KEY}`);
			expect(request.headers).toMatchObject({
				"x-amz-copy-source": `${PRIVATE_BUCKET}/${FINAL_KEY}`,
				"x-amz-metadata-directive": "REPLACE",
				"content-type": "image/png",
				"cache-control": "public, max-age=86400",
				"x-amz-server-side-encryption": "AES256",
			});
		});

		it("withdraws a public asset by deleting the CloudFront origin copy, never the private original", async () => {
			const { adapter, transport } = adapterWith(EMPTY_SUCCESS_RESPONSE);

			await adapter.unpublishAsset({ locator: locator(PRIVATE_BUCKET, FINAL_KEY), fileId: FILE_ID });

			const request = transport.single();
			expect(request.method).toBe("DELETE");
			expect(request.hostname).toBe(`${PUBLIC_BUCKET}.s3.${REGION}.amazonaws.com`);
			expect(request.path).toBe(`/${FINAL_KEY}`);
		});
	});

	describe("copyObject", () => {
		it("URL-encodes the copy source so staging keys with spaces promote correctly", async () => {
			const { adapter, transport } = adapterWith(copyObjectResponse("etag-final"));
			const stagingKey = `staging/kyb/org/${FILE_ID}-my licence+v2.pdf`;

			await adapter.copyObject(locator(PRIVATE_BUCKET, stagingKey), locator(PRIVATE_BUCKET, `kyb/org/${FILE_ID}.pdf`));

			expect(transport.single().headers["x-amz-copy-source"]).toBe(`${PRIVATE_BUCKET}/staging/kyb/org/${FILE_ID}-my%20licence%2Bv2.pdf`);
		});
	});

	describe("signing with IAM role credentials from the default chain", () => {
		it("signs API requests with the role's temporary credentials, session token included", async () => {
			const { adapter, transport } = adapterWith(EMPTY_SUCCESS_RESPONSE);

			await adapter.deleteObject(locator(PRIVATE_BUCKET, FINAL_KEY));

			const headers = transport.single().headers;
			expect(headers["x-amz-security-token"]).toBe(ROLE_SESSION_TOKEN);
			expect(headers.authorization).toContain(`Credential=${ROLE_ACCESS_KEY_ID}/`);
		});

		it("includes the session token in presigned download URLs", async () => {
			const { adapter } = adapterWith(EMPTY_SUCCESS_RESPONSE);

			const url = new URL(await adapter.getSignedDownloadUrl({ locator: locator(PRIVATE_BUCKET, FINAL_KEY), fileId: FILE_ID, expiresInSeconds: 300 }));

			expect(url.searchParams.get("X-Amz-Security-Token")).toBe(ROLE_SESSION_TOKEN);
			expect(url.searchParams.get("X-Amz-Credential")).toMatch(new RegExp(`^${ROLE_ACCESS_KEY_ID}/`));
		});

		it("includes the session token in presigned POST upload tickets", async () => {
			const { adapter } = adapterWith(EMPTY_SUCCESS_RESPONSE);

			const ticket = await adapter.createBrowserUploadTicket({
				locator: locator(PRIVATE_BUCKET, `staging/kyb/org/${FILE_ID}-licence.pdf`),
				mimeType: "application/pdf",
				maxBytes: 1024,
				checksumSha256: "a".repeat(64),
				expiresInSeconds: 300,
				metadata: { fileId: FILE_ID },
			});

			expect(ticket.fields).toMatchObject({ "X-Amz-Security-Token": ROLE_SESSION_TOKEN });
			expect(ticket.fields?.["X-Amz-Credential"]).toMatch(new RegExp(`^${ROLE_ACCESS_KEY_ID}/`));
		});
	});
});

describe("encodeObjectKey", () => {
	it("encodes each segment and keeps the separators", () => {
		expect(encodeObjectKey("staging/kyb/a b/c+d%.pdf")).toBe("staging/kyb/a%20b/c%2Bd%25.pdf");
	});
});
