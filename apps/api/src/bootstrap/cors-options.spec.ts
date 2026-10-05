import { describe, expect, it } from "vitest";

import { createTestApiConfig } from "../../test/support/test-api-env";

import { buildCorsOptions, CORS_ALLOWED_HEADERS } from "./cors-options";

describe("buildCorsOptions", () => {
	const config = createTestApiConfig();
	const options = buildCorsOptions(config);

	it("allows only the configured browser origins, with credentials", () => {
		expect(options.origin).toEqual([...config.http.corsOrigins]);
		expect(options.credentials).toBe(true);
	});

	it("allows exactly the request headers the API reads", () => {
		expect(options.allowedHeaders).toEqual(["Content-Type", "Accept", "X-Client-Type", "X-Mutation-Intent", "Idempotency-Key"]);
	});

	it("no longer allows the retired X-Merchant-Org-Id header", () => {
		expect(CORS_ALLOWED_HEADERS.map((header) => header.toLowerCase())).not.toContain("x-merchant-org-id");
	});
});
