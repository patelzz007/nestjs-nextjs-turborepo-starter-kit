import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
	it("joins class names with a space", (): void => {
		expect(cn("a", "b", "c")).toBe("a b c");
	});

	it("drops falsy values", (): void => {
		expect(cn("a", false, undefined, null, "", "b")).toBe("a b");
	});

	it("lets the later conflicting tailwind class win (twMerge)", (): void => {
		expect(cn("px-2", "px-4")).toBe("px-4");
		expect(cn("bg-red-500", "bg-blue-500")).toBe("bg-blue-500");
	});

	it("supports conditional object arguments", (): void => {
		expect(cn("base", { on: true, off: false })).toBe("base on");
	});
});
