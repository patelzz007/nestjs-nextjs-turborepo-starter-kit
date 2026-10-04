import { afterEach, describe, expect, it, vi } from "vitest";

import { createS3Client } from "./s3-client.factory";

const REGION = "ap-southeast-1";

describe("createS3Client", () => {
	afterEach((): void => {
		vi.unstubAllEnvs();
	});

	it("builds a client without any static credentials (an IAM role is resolved on first use)", async () => {
		vi.stubEnv("AWS_ACCESS_KEY_ID", undefined);
		vi.stubEnv("AWS_SECRET_ACCESS_KEY", undefined);

		const client = createS3Client({ region: REGION });

		await expect(client.config.region()).resolves.toBe(REGION);
	});

	it("resolves credentials through the AWS SDK default chain, keeping the role session token", async () => {
		vi.stubEnv("AWS_PROFILE", undefined);
		vi.stubEnv("AWS_ACCESS_KEY_ID", "ASIATESTONLYROLEKEY1");
		vi.stubEnv("AWS_SECRET_ACCESS_KEY", "test-only-role-secret");
		vi.stubEnv("AWS_SESSION_TOKEN", "test-only-role-session-token");

		const credentials = await createS3Client({ region: REGION }).config.credentials();

		expect(credentials).toMatchObject({ accessKeyId: "ASIATESTONLYROLEKEY1", sessionToken: "test-only-role-session-token" });
	});
});
