import { describe, expect, it } from "vitest";

import { readBack } from "../prisma-tenant-access.store";

describe("readBack", () => {
	it("returns a row that was read back, and fails loudly when it was not (a bug, never a user error)", () => {
		expect(readBack({ id: "row-1" })).toEqual({ id: "row-1" });
		expect((): void => {
			readBack(null);
		}).toThrow("could not be read back");
		expect((): void => {
			readBack(undefined);
		}).toThrow("could not be read back");
	});
});
