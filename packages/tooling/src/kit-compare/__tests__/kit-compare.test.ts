import { describe, expect, it } from "vitest";

import { settings } from "../../shared/settings.ts";
import {
	compareKitFile,
	kitCopyOf,
	kitDrift,
	kitImportSet,
	mapKitLinks,
	mapKitPath,
	mapKitSpecifiers,
	stripKitImports,
	type KitFileReport,
	type KitPair,
} from "../kit-compare.ts";

/** The repository's own web-kit pair, so these tests check the mappings it really uses. */
const WEB_KIT_PAIR: KitPair = settings.kitPairs.web;

describe("mapKitPath", () => {
	it("maps each kit folder to where the dashboard keeps it, the most specific first", () => {
		expect(mapKitPath("packages/ui/src/components/data-table.tsx", WEB_KIT_PAIR)).toBe("components/ui/data-table.tsx");
		expect(mapKitPath("packages/ui/src/internal/table-engine/table-engine.tsx", WEB_KIT_PAIR)).toBe("components/ui/internal/table-engine/table-engine.tsx");
		expect(mapKitPath("packages/ui/src/hooks/use-element-width.ts", WEB_KIT_PAIR)).toBe("hooks/use-element-width.ts");
		expect(mapKitPath("packages/ui/src/lib/table/export.ts", WEB_KIT_PAIR)).toBe("lib/ui/table/export.ts");
		expect(mapKitPath("packages/ui-kit-logic/src/table/query.ts", WEB_KIT_PAIR)).toBe("lib/ui/kit-logic/table/query.ts");
		expect(mapKitPath("apps/admin/components/component-showcase/examples/data-table/features.json", WEB_KIT_PAIR)).toBe("features/showcase/examples/data-table/features.json");
		expect(mapKitPath("apps/admin/components/component-showcase/examples/file-upload/file-upload-shared.tsx", WEB_KIT_PAIR)).toBe("features/shared/file-upload-parts.tsx");
	});

	it("leaves a file outside every kit folder unmapped", () => {
		expect(mapKitPath("apps/api/src/main.ts", WEB_KIT_PAIR)).toBeNull();
	});
});

describe("mapKitSpecifiers", () => {
	it("writes each specifier the way the dashboard does", () => {
		const source = 'import { Button } from "@workspace/ui/components/button";\nimport { cn } from "@workspace/ui/lib/core/utils";\nimport { z } from "zod";\n';
		expect(mapKitSpecifiers(source, WEB_KIT_PAIR)).toBe(
			'import { Button } from "@/components/ui/button";\nimport { cn } from "@/lib/ui/core/utils";\nimport { z } from "zod";\n',
		);
		expect(mapKitSpecifiers('export { x } from "@workspace/ui-kit-logic";', WEB_KIT_PAIR)).toBe('export { x } from "@/lib/ui/kit-logic";');
		expect(mapKitSpecifiers('import { y } from "@workspace/shared";', WEB_KIT_PAIR)).toBe('import { y } from "@/lib/shared";');
		expect(mapKitSpecifiers('import { BRAND_MARK_FACETS } from "@workspace/tokens";', WEB_KIT_PAIR)).toBe('import { BRAND_MARK_FACETS } from "@/lib/tokens";');
	});

	it("reaches internal/ one level shallower, since the dashboard keeps it inside components/ui", () => {
		expect(mapKitSpecifiers('import { Pager } from "../internal/data-table/pager";', WEB_KIT_PAIR)).toBe('import { Pager } from "./internal/data-table/pager";');
		expect(mapKitSpecifiers('import { Harness } from "../../internal/table-engine/table-engine";', WEB_KIT_PAIR)).toBe(
			'import { Harness } from "../internal/table-engine/table-engine";',
		);
		expect(mapKitSpecifiers('import { axe } from "../../testing/axe";', WEB_KIT_PAIR)).toBe('import { axe } from "@/testing/axe";');
		// A sibling inside internal/ is left alone.
		expect(mapKitSpecifiers('import { Row } from "../table-engine/table-engine";', WEB_KIT_PAIR)).toBe('import { Row } from "../table-engine/table-engine";');
	});

	it("rewrites a specifier a comment names in backticks, and leaves other backtick text alone", () => {
		expect(mapKitSpecifiers(" * imported as `@workspace/ui/components/scroll-to-top`.", WEB_KIT_PAIR)).toBe(" * imported as `@/components/ui/scroll-to-top`.");
		expect(mapKitSpecifiers("const label = `${count} rows`;", WEB_KIT_PAIR)).toBe("const label = `${count} rows`;");
	});

	it("maps the showcase's own modules, the relocated upload parts and its route", () => {
		expect(mapKitSpecifiers('import type { X } from "@/components/component-showcase/showcase-feature";', WEB_KIT_PAIR)).toBe(
			'import type { X } from "@/features/showcase/showcase-feature";',
		);
		expect(mapKitSpecifiers('import { P } from "@/components/component-showcase/examples/file-upload/file-upload-shared";', WEB_KIT_PAIR)).toBe(
			'import { P } from "@/features/shared/file-upload-parts";',
		);
		expect(mapKitSpecifiers('<Link href="/components">', WEB_KIT_PAIR)).toBe('<Link href="/showcase">');
	});

	it("rewrites a file path the docs quote, by the folder it lives in", () => {
		expect(mapKitSpecifiers("ships in `packages/ui/src/components/accordion.tsx`.", WEB_KIT_PAIR)).toBe("ships in `components/ui/accordion.tsx`.");
		expect(mapKitSpecifiers('"file": "packages/ui-kit-logic/src/table/query.ts"', WEB_KIT_PAIR)).toBe('"file": "lib/ui/kit-logic/table/query.ts"');
	});
});

describe("mapKitLinks", () => {
	it("points a docs link to the showcase at the dashboard's route, and leaves other links alone", () => {
		expect(mapKitLinks("use [Tabs](/components/tabs) or [Card](/components/card#parts)", WEB_KIT_PAIR)).toBe("use [Tabs](/showcase/tabs) or [Card](/showcase/card#parts)");
		expect(mapKitLinks("see [Base UI](https://base-ui.com/react) and [home](/)", WEB_KIT_PAIR)).toBe("see [Base UI](https://base-ui.com/react) and [home](/)");
	});
});

describe("imports", () => {
	const text = 'import { b } from "b";\nimport {\n\ta,\n} from "a";\nimport "side-effect";\nexport { c } from "c";\n\nconst x = 1;\n';

	it("strips single- and multi-line imports, side-effect imports and re-exports", () => {
		expect(stripKitImports(text)).toBe("\nconst x = 1;\n");
	});

	it("collects the imports as a sorted set, whitespace and a wrapped import's trailing comma folded", () => {
		expect(kitImportSet(text)).toEqual(['export { c } from "c";', 'import "side-effect";', 'import { a } from "a";', 'import { b } from "b";']);
	});

	it("reads an import the formatter wrapped the same as one it kept on a line", () => {
		expect(kitImportSet('import {\n\tfirst,\n\tsecond,\n} from "x";\n')).toEqual(kitImportSet('import { first, second } from "x";\n'));
	});
});

describe("compareKitFile", () => {
	const source = 'import { a } from "@workspace/shared";\nimport { b } from "zod";\n\nexport const value = a(b);\n';

	it("is the same when only the specifiers differ the mapped way", () => {
		expect(compareKitFile(source, 'import { a } from "@/lib/shared";\nimport { b } from "zod";\n\nexport const value = a(b);\n', WEB_KIT_PAIR)).toBe("same");
	});

	it("is the same when the formatter ordered the imports differently", () => {
		expect(compareKitFile(source, 'import { b } from "zod";\nimport { a } from "@/lib/shared";\n\nexport const value = a(b);\n', WEB_KIT_PAIR)).toBe("same");
	});

	it("differs when the code differs or an import is missing, and is missing without a copy", () => {
		expect(compareKitFile(source, 'import { a } from "@/lib/shared";\nimport { b } from "zod";\n\nexport const value = b(a);\n', WEB_KIT_PAIR)).toBe("different");
		expect(compareKitFile(source, 'import { b } from "zod";\n\nexport const value = a(b);\n', WEB_KIT_PAIR)).toBe("different");
		expect(compareKitFile(source, null, WEB_KIT_PAIR)).toBe("missing");
	});
});

describe("kitCopyOf", () => {
	it("writes a file the way the dashboard holds it: specifiers, quoted paths and showcase links mapped", () => {
		const source = 'import { a } from "@workspace/shared";\n// See `packages/ui/src/components/kanban.tsx` and [the board](/components/kanban).\nexport const value = a;\n';
		const copy = kitCopyOf(source, WEB_KIT_PAIR);
		expect(copy).toBe('import { a } from "@/lib/shared";\n// See `components/ui/kanban.tsx` and [the board](/showcase/kanban).\nexport const value = a;\n');
		expect(compareKitFile(source, copy, WEB_KIT_PAIR)).toBe("same");
	});
});

describe("kitDrift", () => {
	it("lists what is not the same, missing files first, then by path", () => {
		const reports: readonly KitFileReport[] = [
			{ path: "b", copyPath: "b", status: "different" },
			{ path: "a", copyPath: "a", status: "same" },
			{ path: "d", copyPath: "d", status: "missing" },
			{ path: "c", copyPath: "c", status: "different" },
		];
		expect(kitDrift(reports).map((report) => report.path)).toEqual(["d", "b", "c"]);
	});
});
