import { describe, expect, it } from "vitest";

import { isPublicFile } from "./file-visibility.util";

describe("isPublicFile", () => {
	it("is true only for PUBLIC files", () => {
		expect(isPublicFile({ visibility: "PUBLIC" })).toBe(true);
		expect(isPublicFile({ visibility: "PRIVATE" })).toBe(false);
	});
});
