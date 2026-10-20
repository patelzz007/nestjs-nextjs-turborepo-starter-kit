import { describe, expect, it } from "vitest";

import { AuthenticationError } from "../../../../../platform/application/errors/app-error";
import { SharedSecretCallbackAuthenticator } from "../processing-callback-authenticator.adapter";

/** TEST-ONLY processing-callback secret (≥ 32 characters). */
const CALLBACK_SECRET = "test-only-processing-callback-secret-not-real-07";

describe("SharedSecretCallbackAuthenticator", () => {
	it("accepts the configured secret", () => {
		expect(() => {
			new SharedSecretCallbackAuthenticator(CALLBACK_SECRET).assertAuthentic(CALLBACK_SECRET);
		}).not.toThrow();
	});

	it("rejects a wrong, same-length wrong, or missing secret", () => {
		const authenticator = new SharedSecretCallbackAuthenticator(CALLBACK_SECRET);

		for (const presented of ["wrong", `${CALLBACK_SECRET.slice(0, -1)}x`, null]) {
			expect(() => {
				authenticator.assertAuthentic(presented);
			}).toThrow(AuthenticationError);
		}
	});

	it("fails closed when no secret is configured (no dev bypass)", () => {
		expect(() => {
			new SharedSecretCallbackAuthenticator(null).assertAuthentic(CALLBACK_SECRET);
		}).toThrow(expect.objectContaining({ code: "CALLBACK_UNAUTHORIZED" }));
	});
});
