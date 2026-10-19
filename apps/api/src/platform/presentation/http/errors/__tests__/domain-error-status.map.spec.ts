import { describe, expect, it } from "vitest";

import { DOMAIN_ERROR_CODE_CATALOG, DomainErrorCodeSchema } from "../../../../domain/errors/error-codes";
import { DOMAIN_ERROR_HTTP_STATUS } from "../domain-error-status.map";

describe("DOMAIN_ERROR_HTTP_STATUS", () => {
	it("lists an HTTP status for every domain error code in the catalog", () => {
		for (const code of DomainErrorCodeSchema.options) {
			expect(DOMAIN_ERROR_CODE_CATALOG).toContain(code);
			expect(DOMAIN_ERROR_HTTP_STATUS[code]).toBeGreaterThanOrEqual(400);
		}
	});
});
