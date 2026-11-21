import { describe, expect, it } from "vitest";

import { TableEngineTableLayoutSchema } from "../table-engine";
import {
	cellLookOf,
	spacingClassesOf,
	TABLE_ENGINE_BODY_ROW_TINT_CLASSES,
	tableEngineBodyCellTruncateVariants,
	tableEngineBodyCellVariants,
	tableEngineFooterCellVariants,
	tableEngineHeaderCellVariants,
} from "../table-engine-table-layout";

function classesOf(className: string): string[] {
	return className.split(" ");
}

describe("table engine looks", () => {
	it("defaults to the grid look", () => {
		expect(TableEngineTableLayoutSchema.parse({}).look).toBe("grid");
	});

	it("keeps the grid look's cells as they were", () => {
		const layout = TableEngineTableLayoutSchema.parse({});
		expect(classesOf(tableEngineBodyCellVariants(cellLookOf(layout)))).toEqual(expect.arrayContaining(["px-3", "py-2"]));
		expect(classesOf(tableEngineHeaderCellVariants({ look: "grid", size: "default" }))).toEqual(expect.arrayContaining(["h-10", "px-3", "font-medium"]));
		expect(spacingClassesOf(layout).bodyRow).toBe("");
		expect(TABLE_ENGINE_BODY_ROW_TINT_CLASSES.grid).toContain("hover:bg-muted/40");
	});

	it("draws the records look: tinted uppercase header, roomy cells, tall rows", () => {
		const layout = TableEngineTableLayoutSchema.parse({ look: "records" });
		expect(classesOf(tableEngineHeaderCellVariants({ look: "records", size: "default" }))).toEqual(
			expect.arrayContaining(["h-11", "px-4", "bg-muted/30", "uppercase", "text-xs", "font-semibold", "tracking-wider"]),
		);
		expect(classesOf(tableEngineBodyCellVariants(cellLookOf(layout)))).toContain("p-4");
		expect(spacingClassesOf(layout).bodyRow).toBe("h-18");
		expect(spacingClassesOf(layout).headBand).toBe("h-11");
		expect(TABLE_ENGINE_BODY_ROW_TINT_CLASSES.records).toContain("data-[state=selected]:bg-muted");
	});

	it("scales the records look with density", () => {
		const dense = TableEngineTableLayoutSchema.parse({ look: "records", dense: true });
		const spacious = TableEngineTableLayoutSchema.parse({ look: "records", spacious: true });
		expect(classesOf(tableEngineBodyCellVariants(cellLookOf(dense)))).toEqual(expect.arrayContaining(["px-3", "py-2"]));
		expect(classesOf(tableEngineBodyCellVariants(cellLookOf(spacious)))).toContain("p-5");
		expect(spacingClassesOf(dense).bodyRow).toBe("h-12");
		expect(spacingClassesOf(spacious).bodyRow).toBe("h-20");
	});

	it("gives the footer the body's padding and the truncation wrapper the exact inverse margins", () => {
		expect(classesOf(tableEngineFooterCellVariants({ look: "records", size: "default" }))).toContain("p-4");
		expect(classesOf(tableEngineBodyCellTruncateVariants({ look: "records", size: "default" }))).toEqual(expect.arrayContaining(["-m-4", "p-4", "truncate"]));
		expect(classesOf(tableEngineBodyCellTruncateVariants({ look: "grid", size: "dense" }))).toEqual(expect.arrayContaining(["-mx-2", "-my-1.5", "px-2", "py-1.5"]));
	});
});
