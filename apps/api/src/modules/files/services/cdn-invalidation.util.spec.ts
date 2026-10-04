import { describe, expect, it } from "vitest";

import { toCdnInvalidationRequest } from "./cdn-invalidation.util";

const FILE_ID = "11111111-1111-4111-8111-111111111111";

describe("toCdnInvalidationRequest", () => {
	it("derives a per-file reference so retries are the same invalidation", () => {
		const job = { fileId: FILE_ID, objectKeys: ["products/p/original/f.png"] };

		expect(toCdnInvalidationRequest(job)).toEqual({ reference: `file-${FILE_ID}-withdrawal`, objectKeys: ["products/p/original/f.png"] });
		expect(toCdnInvalidationRequest(job)).toEqual(toCdnInvalidationRequest(job));
	});

	it("rejects a job without keys", () => {
		expect(() => toCdnInvalidationRequest({ fileId: FILE_ID, objectKeys: [] })).toThrow();
	});
});
