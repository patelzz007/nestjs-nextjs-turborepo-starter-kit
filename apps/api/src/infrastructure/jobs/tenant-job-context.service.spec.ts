import type { TenantJobContext } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { createTestTypedConfig } from "../../../test/support/test-api-env";
import { TenantJobContextService, TenantJobSigningNotConfiguredError } from "./tenant-job-context.service";

/** TEST-ONLY job signing secret (≥ 32 characters, never a real value). */
const TEST_JOB_SECRET = "test-only-tenant-job-hmac-secret-not-for-real-0005";
const ONE_MINUTE_MS = 60_000;

function serviceWithSecret(secret: string = TEST_JOB_SECRET): TenantJobContextService {
	return new TenantJobContextService(createTestTypedConfig({ TENANT_JOB_HMAC_SECRET: secret }));
}

function unsignedContext(expiresAt: number): Omit<TenantJobContext, "signature"> {
	return {
		organizationId: "00000000-0000-4000-8000-000000000001",
		initiatingActorId: null,
		purpose: "rewards.auto_publish",
		policyVersion: 1,
		correlationId: "test",
		issuedAt: expiresAt - ONE_MINUTE_MS,
		expiresAt,
	};
}

describe("TenantJobContextService", () => {
	it("signs and verifies tenant job context", () => {
		const service = serviceWithSecret();
		const signed = service.sign(unsignedContext(Date.now() + ONE_MINUTE_MS));

		expect(service.verify(signed)).toBe(true);
	});

	it("rejects expired context", () => {
		const service = serviceWithSecret();
		const signed = service.sign(unsignedContext(Date.now() - ONE_MINUTE_MS));

		expect(service.verify(signed)).toBe(false);
	});

	it("rejects a context signed with a different secret", () => {
		const signed = serviceWithSecret("test-only-other-tenant-job-secret-not-for-real-06").sign(unsignedContext(Date.now() + ONE_MINUTE_MS));

		expect(serviceWithSecret().verify(signed)).toBe(false);
	});

	it("rejects a tampered context", () => {
		const service = serviceWithSecret();
		const signed = service.sign(unsignedContext(Date.now() + ONE_MINUTE_MS));

		expect(service.verify({ ...signed, organizationId: "00000000-0000-4000-8000-000000000002" })).toBe(false);
	});

	it("fails closed without TENANT_JOB_HMAC_SECRET: no default secret, signing throws, verification rejects", () => {
		const unconfigured = new TenantJobContextService(createTestTypedConfig());
		const signedElsewhere = serviceWithSecret().sign(unsignedContext(Date.now() + ONE_MINUTE_MS));

		expect(() => unconfigured.sign(unsignedContext(Date.now() + ONE_MINUTE_MS))).toThrow(TenantJobSigningNotConfiguredError);
		expect(unconfigured.verify(signedElsewhere)).toBe(false);
	});
});
