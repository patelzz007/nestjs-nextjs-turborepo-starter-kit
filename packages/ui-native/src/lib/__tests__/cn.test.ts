import { cn } from "../cn";

describe("cn", () => {
	it("joins classes and drops falsy ones", () => {
		expect(cn("flex-row", false, undefined, "gap-2")).toBe("flex-row gap-2");
	});

	it("lets a later utility win over an earlier one of the same kind (a caller's className overrides)", () => {
		expect(cn("bg-primary px-4", "px-2")).toBe("bg-primary px-2");
		expect(cn("font-sans", "font-sans-semibold")).toBe("font-sans-semibold");
	});

	it("knows the phone's type roles are sizes, not colours: a role keeps its colour beside it and a later role wins", () => {
		expect(cn("text-h4 text-foreground")).toBe("text-h4 text-foreground");
		expect(cn("text-h4 font-heading text-foreground", "text-body-lg")).toBe("font-heading text-foreground text-body-lg");
		expect(cn("text-caption", "text-overline")).toBe("text-overline");
	});

	it("knows the phone's named radii: a later one replaces a Tailwind step", () => {
		expect(cn("rounded-xl", "rounded-card")).toBe("rounded-card");
		expect(cn("rounded-card", "rounded-button")).toBe("rounded-button");
	});
});
