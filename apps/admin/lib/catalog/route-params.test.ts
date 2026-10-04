import { describe, expect, it, vi } from "vitest";

import { readCategoryIdParam, readProductIdParam } from "@/lib/catalog/route-params";

vi.mock("next/navigation", () => ({
	notFound: (): void => {
		throw new Error("NEXT_NOT_FOUND");
	},
}));

const ID = "3f2a8c3e-7a53-4f5c-9d0a-0d6a6b8f2c11";

describe("catalog [id] params", () => {
	it("return a well-formed id", async () => {
		await expect(readProductIdParam({ params: Promise.resolve({ id: ID }) })).resolves.toBe(ID);
		await expect(readCategoryIdParam({ params: Promise.resolve({ id: ID }) })).resolves.toBe(ID);
	});

	it("render the 404 page for a malformed id instead of calling the API", async () => {
		await expect(readProductIdParam({ params: Promise.resolve({ id: "not-a-uuid" }) })).rejects.toThrow("NEXT_NOT_FOUND");
		await expect(readCategoryIdParam({ params: Promise.resolve({ id: "42" }) })).rejects.toThrow("NEXT_NOT_FOUND");
	});
});
