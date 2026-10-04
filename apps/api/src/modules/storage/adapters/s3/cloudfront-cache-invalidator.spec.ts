import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createInvalidationResponse, RecordingS3Transport } from "../../../../../test/support/s3-recording-transport";
import { CloudFrontCacheInvalidator, createCloudFrontClient } from "./cloudfront-cache-invalidator";

const DISTRIBUTION_ID = "E2QWRUHAPOMQZL";
const ROLE_SESSION_TOKEN = "test-only-role-session-token";

function invalidatorWith(transport: RecordingS3Transport): CloudFrontCacheInvalidator {
	return new CloudFrontCacheInvalidator(createCloudFrontClient({ requestHandler: transport }), DISTRIBUTION_ID);
}

describe("CloudFrontCacheInvalidator", () => {
	beforeEach((): void => {
		vi.stubEnv("AWS_PROFILE", undefined);
		vi.stubEnv("AWS_ACCESS_KEY_ID", "ASIATESTONLYROLEKEY1");
		vi.stubEnv("AWS_SECRET_ACCESS_KEY", "test-only-role-secret");
		vi.stubEnv("AWS_SESSION_TOKEN", ROLE_SESSION_TOKEN);
	});

	afterEach((): void => {
		vi.unstubAllEnvs();
	});

	it("creates one invalidation for the withdrawn keys on the configured distribution, signed with the role credentials", async () => {
		const transport = new RecordingS3Transport(createInvalidationResponse("I2J0I21PCUYOIK"));

		await invalidatorWith(transport).invalidate({ reference: "file-1-withdrawal", objectKeys: ["products/p/original/a b.png"] });

		const request = transport.single();
		expect(request.method).toBe("POST");
		expect(request.hostname).toBe("cloudfront.amazonaws.com");
		expect(request.path).toBe(`/2020-05-31/distribution/${DISTRIBUTION_ID}/invalidation`);
		expect(request.headers["x-amz-security-token"]).toBe(ROLE_SESSION_TOKEN);
		const body = z.string().parse(request.body);
		expect(body).toContain("<CallerReference>file-1-withdrawal</CallerReference>");
		expect(body).toContain("<Path>/products/p/original/a%20b.png</Path>");
		expect(body).toContain("<Quantity>1</Quantity>");
	});

	it("calls nothing for an empty key list", async () => {
		const transport = new RecordingS3Transport(createInvalidationResponse("unused"));

		await invalidatorWith(transport).invalidate({ reference: "file-1-withdrawal", objectKeys: [] });

		expect(transport.requests).toEqual([]);
	});

	it("rejects when CloudFront refuses, so the job is retried", async () => {
		const transport = new RecordingS3Transport({
			statusCode: 503,
			body: "<ErrorResponse><Error><Code>ServiceUnavailable</Code><Message>try later</Message></Error></ErrorResponse>",
		});

		await expect(invalidatorWith(transport).invalidate({ reference: "file-1-withdrawal", objectKeys: ["products/a.png"] })).rejects.toThrow();
	});
});
