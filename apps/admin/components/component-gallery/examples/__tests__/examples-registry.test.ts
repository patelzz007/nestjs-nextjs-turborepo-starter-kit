import { readFileSync } from "node:fs";
import path from "node:path";

import { format, resolveConfig } from "prettier";
import { describe, expect, it } from "vitest";

import { GALLERY_EXAMPLE_SECTIONS } from "@/components/component-gallery/examples/examples-registry";
import { EXAMPLE_ONLY_KEYS, GALLERY_ENTRIES } from "@/components/component-gallery/gallery-catalog";

import { GALLERY_EXAMPLE_COUNTS } from "@/components/component-gallery/examples/examples-manifest";

import { EXAMPLES_DIR, exampleCount, exampleFolders, manifestSource, pascalCaseOf, registrySource } from "../../../../scripts/gallery-examples-registry";

const ADMIN_ROOT = path.resolve(import.meta.dirname, "../../../..");
const REGISTRY_FILE = path.join(ADMIN_ROOT, EXAMPLES_DIR, "examples-registry.tsx");
const MANIFEST_FILE = path.join(ADMIN_ROOT, EXAMPLES_DIR, "examples-manifest.ts");

/** examples/kbd/index.tsx lists six examples. */
const KBD_EXAMPLE_COUNT = 6;

describe("gallery examples registry", () => {
	it("names a component folder's examples export in PascalCase", () => {
		expect(pascalCaseOf("data-grid")).toBe("DataGrid");
		expect(pascalCaseOf("button")).toBe("Button");
	});

	it("keys each component's examples chunk by its gallery section id", () => {
		const source = registrySource(["icon-tile"]);
		expect(source).toContain('["component-icon-tile", (): React.JSX.Element => <IconTileExamples />]');
		expect(source).toContain('import("@/components/component-gallery/examples/icon-tile").then((m) => m.IconTileExamples)');
	});

	it("has worked examples for every examples-only gallery component", () => {
		const missing = [...EXAMPLE_ONLY_KEYS].filter((key) => !GALLERY_EXAMPLE_SECTIONS.has(GALLERY_ENTRIES[key].id));
		expect(missing).toStrictEqual([]);
	});

	it("is up to date with the example folders — run `pnpm --filter @workspace/admin gallery:examples`", async () => {
		const expected = await format(registrySource(exampleFolders(ADMIN_ROOT)), { ...(await resolveConfig(REGISTRY_FILE)), filepath: REGISTRY_FILE });
		expect(readFileSync(REGISTRY_FILE, "utf8")).toBe(expected);
	});

	it("writes each component's example count, keyed by its gallery section id", () => {
		expect(manifestSource([{ folder: "icon-tile", count: 3 }])).toContain('["component-icon-tile", 3]');
	});

	it("counts the examples an index lists, and gives every component with a registry entry at least one", () => {
		expect(exampleCount(ADMIN_ROOT, "kbd")).toBe(KBD_EXAMPLE_COUNT);
		for (const sectionId of GALLERY_EXAMPLE_SECTIONS.keys()) {
			expect(GALLERY_EXAMPLE_COUNTS.get(sectionId), sectionId).toBeGreaterThan(0);
		}
		expect([...GALLERY_EXAMPLE_COUNTS.keys()]).toStrictEqual([...GALLERY_EXAMPLE_SECTIONS.keys()]);
	});

	it("keeps the example manifest up to date — run `pnpm --filter @workspace/admin gallery:examples`", async () => {
		const folders = exampleFolders(ADMIN_ROOT);
		const source = manifestSource(folders.map((folder) => ({ folder, count: exampleCount(ADMIN_ROOT, folder) })));
		const expected = await format(source, { ...(await resolveConfig(MANIFEST_FILE)), filepath: MANIFEST_FILE });
		expect(readFileSync(MANIFEST_FILE, "utf8")).toBe(expected);
	});
});
