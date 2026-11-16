import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SHOWCASE_CATALOG_ORDER } from "@/components/component-showcase/showcase-catalog";

import {
	CONTENT_DIR,
	CONTENT_INDEX_FILE,
	contentIndexSource,
	contentModuleSource,
	DOCS_FILE,
	faqOf,
	fencedBlocksOf,
	listItemsOf,
	OVERVIEW_FILE,
	parseDocs,
	parseOverview,
	readComponentContent,
	sectionsOf,
	SHOWCASE_ALIAS,
} from "../../../scripts/showcase-content";
import { EXAMPLES_DIR, readComponentFeatures, type ComponentFeatures, type GeneratedFeature } from "../../../scripts/showcase-features";

import { formattedAll, ROOT } from "./formatted-sources";

/** Generating and formatting every module takes a few seconds. */
const FRESHNESS_TIMEOUT_MS = 60_000;

const OVERVIEW = `## When to use

- Showing a **key**
- A shortcut in a menu,
  spread over two lines

## When not to use

- A button: use \`Button\`

## Notes

- Pair it with a tooltip

## Keyboard keys

The kit's key cap.

\`\`\`tsx
## not a heading, it is code
\`\`\`

## Frequently asked questions

### Can it show a chord?

Yes, group several keys.
`;

const FEATURE: GeneratedFeature = {
	id: "c-kbd-1",
	label: "Basic",
	description: "One key.",
	file: "kbd-1",
	export: "Kbd1Example",
	anchor: "basic",
	source: "export function Kbd1Example() {}\n",
};

const COMPONENTS: readonly ComponentFeatures[] = readComponentFeatures(ROOT);

describe("showcase content generator", () => {
	it("splits Markdown at its ## headings, never inside a code fence, and refuses text before the first one", () => {
		expect(sectionsOf(OVERVIEW, "x.md").map(({ title }) => title)).toEqual(["When to use", "When not to use", "Notes", "Keyboard keys", "Frequently asked questions"]);
		expect(() => sectionsOf("stray\n## A\n", "x.md")).toThrow('x.md: text before the first "## " heading');
	});

	it("reads list sections, joining continuation lines, and refuses anything else in them", () => {
		expect(listItemsOf({ title: "When to use", lines: ["- one", "  more", "- two"] }, "x.md")).toEqual(["one more", "two"]);
		expect(() => listItemsOf({ title: "Notes", lines: ["prose"] }, "x.md")).toThrow('"## Notes" holds only "- " list items');
		expect(() => listItemsOf({ title: "Notes", lines: [""] }, "x.md")).toThrow('"## Notes" is empty');
	});

	it("reads the FAQ as questions with answers", () => {
		expect(faqOf({ title: "Frequently asked questions", lines: ["### Why?", "", "Because.", "", "### How?", "Like so."] }, "x.md")).toEqual([
			{ question: "Why?", answer: "Because." },
			{ question: "How?", answer: "Like so." },
		]);
		expect(() => faqOf({ title: "Frequently asked questions", lines: ["intro"] }, "x.md")).toThrow('must start with a "### " question');
		expect(() => faqOf({ title: "Frequently asked questions", lines: ["### Why?"] }, "x.md")).toThrow('every FAQ question needs an answer ("Why?")');
	});

	it("parses an overview into its lists, its body and its FAQ", () => {
		const overview = parseOverview(OVERVIEW, "kbd/overview.md");
		expect(overview.whenToUse).toEqual(["Showing a **key**", "A shortcut in a menu, spread over two lines"]);
		expect(overview.whenNotToUse).toEqual(["A button: use `Button`"]);
		expect(overview.notes).toEqual(["Pair it with a tooltip"]);
		expect(overview.body).toContain("## Keyboard keys");
		expect(overview.body).toContain("## not a heading, it is code");
		expect(overview.body).not.toContain("When to use");
		expect(overview.faq).toEqual([{ question: "Can it show a chord?", answer: "Yes, group several keys." }]);
	});

	it("names the missing piece of an incomplete overview", () => {
		expect(() => parseOverview("## When to use\n\n- a\n", "kbd/overview.md")).toThrow('kbd/overview.md: missing "## When not to use"');
		expect(() => parseOverview("## When to use\n\n- a\n\n## When not to use\n\n- b\n\n## Frequently asked questions\n\n### Q\n\nA\n", "kbd/overview.md")).toThrow(
			"needs at least one overview section",
		);
		expect(parseOverview(OVERVIEW.replace("## Notes\n\n- Pair it with a tooltip\n\n", ""), "kbd/overview.md").notes).toEqual([]);
	});

	it("finds the fenced blocks of one language", () => {
		const markdown = "```showcase-example\nc-kbd-1\n```\n\n```tsx\nconst a = 1;\n```\n\n````showcase-example\nc-kbd-2\n````\n";
		expect(fencedBlocksOf(markdown, "showcase-example")).toEqual(["c-kbd-1", "c-kbd-2"]);
		expect(fencedBlocksOf(markdown, "tsx")).toEqual(["const a = 1;"]);
	});

	it("checks a docs page's API block and its examples", () => {
		const docs = parseDocs("## Usage\n\n```showcase-example\nc-kbd-1\n```\n\n## API Reference\n\n```showcase-api\n```\n", "kbd/docs.md", [FEATURE]);
		expect(docs.examples).toEqual([{ id: "c-kbd-1", label: "Basic", anchor: "basic", file: "kbd-1", source: FEATURE.source }]);
		expect(() => parseDocs("## Usage\n\nNo API.\n", "kbd/docs.md", [FEATURE])).toThrow("needs exactly one ```showcase-api``` block (found 0)");
		expect(() => parseDocs("## Usage\n\n```showcase-api\n```\n\n```showcase-example\nc-kbd-9\n```\n", "kbd/docs.md", [FEATURE])).toThrow('names "c-kbd-9"');
	});

	it("writes each content module and the index", () => {
		const content = { overview: parseOverview(OVERVIEW, "kbd/overview.md"), docs: parseDocs("## Usage\n\n```showcase-api\n```\n", "kbd/docs.md", [FEATURE]) };
		expect(contentModuleSource("kbd", content, SHOWCASE_ALIAS)).toContain("export const SHOWCASE_COMPONENT_CONTENT: ShowcaseContent = {");
		expect(contentIndexSource(["kbd"], SHOWCASE_ALIAS)).toContain(
			'["kbd", async (): Promise<ShowcaseContent> => (await import("@/components/component-showcase/generated/content/kbd")).SHOWCASE_COMPONENT_CONTENT]',
		);
	});

	it("gives every catalog component its overview and its docs", () => {
		const missing = SHOWCASE_CATALOG_ORDER.flatMap(({ entry }): string[] =>
			[OVERVIEW_FILE, DOCS_FILE]
				.filter((file: string): boolean => !existsSync(path.join(ROOT, EXAMPLES_DIR, entry.slug, file)))
				.map((file: string): string => `${entry.slug}/${file}`),
		);
		expect(missing).toEqual([]);
	});

	it("keeps every generated content module up to date — run `pnpm showcase:generate`", { timeout: FRESHNESS_TIMEOUT_MS }, () => {
		const written = COMPONENTS.flatMap((component: ComponentFeatures): [string, string][] => {
			const content = readComponentContent(ROOT, component);
			return content === null ? [] : [[`${CONTENT_DIR}/${component.slug}.ts`, contentModuleSource(component.slug, content, SHOWCASE_ALIAS)]];
		});
		const slugs = written.map(([file]): string => path.basename(file, ".ts"));
		const expected = new Map<string, string>([[CONTENT_INDEX_FILE, contentIndexSource(slugs, SHOWCASE_ALIAS)], ...written]);
		for (const [file, source] of formattedAll(expected)) {
			expect(readFileSync(path.join(ROOT, file), "utf8"), file).toBe(source);
		}
		// One module per component with content, plus the index.
		expect(readdirSync(path.join(ROOT, CONTENT_DIR)).length).toBe(written.length + 1);
	});
});
