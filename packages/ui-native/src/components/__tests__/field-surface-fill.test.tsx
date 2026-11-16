import { cn } from "../../lib/cn";
import { FIELD_SURFACE_FILL, type FieldSurface } from "../../lib/field-surface";
import { calendarFieldTriggerVariants } from "../calendar-field";
import { inputOTPCellVariants } from "../input-otp";
import { selectTriggerVariants } from "../select-field";

const SURFACES: readonly FieldSurface[] = ["page", "card", "popover"];

/** The class list as each component applies it, through `cn` (the last fill wins). */
function classesOf(classes: string): readonly string[] {
	return cn(classes).split(" ");
}

describe("field-like controls take the fill of the surface they sit on", () => {
	it("fills an outlined select, date and code field with the page, card or popover colour", () => {
		for (const surface of SURFACES) {
			const fill = FIELD_SURFACE_FILL[surface];
			expect(classesOf(selectTriggerVariants({ surface }))).toContain(fill);
			expect(classesOf(calendarFieldTriggerVariants({ surface }))).toContain(fill);
			expect(classesOf(inputOTPCellVariants({ surface }))).toContain(fill);
		}
	});

	it("keeps the muted well of a filled field on every surface", () => {
		expect(classesOf(selectTriggerVariants({ variant: "muted", surface: "card" }))).toEqual(expect.arrayContaining(["bg-muted"]));
		expect(classesOf(selectTriggerVariants({ variant: "muted", surface: "card" }))).not.toContain("bg-card");
		expect(classesOf(calendarFieldTriggerVariants({ variant: "filled", surface: "card" }))).not.toContain("bg-card");
	});

	it("gives the fields the input's corners", () => {
		expect(classesOf(selectTriggerVariants({}))).toContain("rounded-button");
		expect(classesOf(calendarFieldTriggerVariants({}))).toContain("rounded-button");
	});
});
