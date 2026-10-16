import { cn } from "../cn";

describe("cn", () => {
	it("joins classes and drops falsy ones", () => {
		expect(cn("flex-row", false, undefined, "gap-2")).toBe("flex-row gap-2");
	});

	it("lets a later utility win over an earlier one of the same kind (a caller's className overrides)", () => {
		expect(cn("bg-primary px-4", "px-2")).toBe("bg-primary px-2");
		expect(cn("font-sans", "font-sans-semibold")).toBe("font-sans-semibold");
	});
});
