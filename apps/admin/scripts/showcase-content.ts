// `pnpm showcase:generate` compiles each component's written content into
// plain data modules, checked as it goes:
//
// - examples/<component>/overview.md — the component page's prose. Its `##`
//   sections "When to use", "When not to use" and "Notes" are bullet lists;
//   "Frequently asked questions" holds one `###` per question; every other
//   section is the overview, kept as Markdown.
// - examples/<component>/docs.md — the docs page, in Markdown, with exactly one
//   ```showcase-api``` block (where the generated API reference goes) and any
//   number of ```showcase-example``` blocks naming an example by its id.
//
// Output: generated/content/<component>.ts and generated/content/index.ts (each
// behind a dynamic import). The showcase test checks the committed files match.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { ShowcaseContent, ShowcaseDocs, ShowcaseDocsExample, ShowcaseFaqEntry, ShowcaseOverview } from "../components/component-showcase/showcase-content.ts";
import { API_FENCE, EXAMPLE_FENCE } from "../components/component-showcase/showcase-content.ts";
import { EXAMPLES_DIR, GENERATED_DIR, readComponentFeatures, type ComponentFeatures, type GeneratedFeature } from "./showcase-features.ts";

export const CONTENT_DIR = `${GENERATED_DIR}/content`;
export const CONTENT_INDEX_FILE = `${CONTENT_DIR}/index.ts`;
export const OVERVIEW_FILE = "overview.md";
export const DOCS_FILE = "docs.md";

const WHEN_TO_USE = "When to use";
const WHEN_NOT_TO_USE = "When not to use";
const NOTES = "Notes";
const FAQ = "Frequently asked questions";
const LIST_SECTIONS = new Set([WHEN_TO_USE, WHEN_NOT_TO_USE, NOTES]);
const FENCE = /^(?<marks>```+|~~~+)(?<info>.*)$/u;
const HEADING = /^(?<level>#{2,3}) +(?<title>.+?)\s*$/u;
const LIST_ITEM = /^- +(?<item>.+)$/u;
const CONTINUATION = /^ {2,}(?<text>\S.*)$/u;

/** A `##` section of a Markdown file: its title and its lines (code fences kept whole). */
export interface MarkdownSection {
	readonly title: string;
	readonly lines: readonly string[];
}

/** `markdown` split at its `##` headings (a `##` inside a code fence is code). Text before the first heading is an error. */
export function sectionsOf(markdown: string, file: string): MarkdownSection[] {
	const sections: { title: string; lines: string[] }[] = [];
	let fence: string | null = null;
	for (const line of markdown.replace(/\r\n/gu, "\n").split("\n")) {
		const fenceMarks = FENCE.exec(line)?.groups?.marks;
		if (fenceMarks !== undefined) {
			fence = fence === null ? fenceMarks : fenceMarks.startsWith(fence) ? null : fence;
		}
		const heading = fence === null ? HEADING.exec(line)?.groups : undefined;
		if (heading?.level === "##") {
			sections.push({ title: heading.title ?? "", lines: [] });
			continue;
		}
		const current = sections.at(-1);
		if (current === undefined) {
			if (line.trim() !== "") {
				throw new Error(`${file}: text before the first "## " heading`);
			}
			continue;
		}
		current.lines.push(line);
	}
	return sections.map(({ title, lines }): MarkdownSection => ({ title, lines }));
}

/** The bullet items of a list section (a continuation line, indented, joins its item). */
export function listItemsOf(section: MarkdownSection, file: string): string[] {
	const items: string[] = [];
	for (const line of section.lines) {
		const item = LIST_ITEM.exec(line)?.groups?.item;
		const continuation = CONTINUATION.exec(line)?.groups?.text;
		if (item !== undefined) {
			items.push(item.trim());
		} else if (continuation !== undefined && items.length > 0) {
			items.push(`${items.pop() ?? ""} ${continuation.trim()}`);
		} else if (line.trim() !== "") {
			throw new Error(`${file}: "## ${section.title}" holds only "- " list items, found: ${line}`);
		}
	}
	if (items.length === 0) {
		throw new Error(`${file}: "## ${section.title}" is empty`);
	}
	return items;
}

/** The FAQ: one `###` question per entry, its answer the Markdown below it. */
export function faqOf(section: MarkdownSection, file: string): ShowcaseFaqEntry[] {
	const entries: { question: string; lines: string[] }[] = [];
	for (const line of section.lines) {
		const heading = HEADING.exec(line)?.groups;
		if (heading?.level === "###") {
			entries.push({ question: heading.title ?? "", lines: [] });
		} else if (entries.length > 0) {
			entries.at(-1)?.lines.push(line);
		} else if (line.trim() !== "") {
			throw new Error(`${file}: "## ${FAQ}" must start with a "### " question`);
		}
	}
	const faq = entries.map(({ question, lines }): ShowcaseFaqEntry => ({ question, answer: lines.join("\n").trim() }));
	const unanswered = faq.find(({ answer }): boolean => answer === "");
	if (faq.length === 0 || unanswered !== undefined) {
		throw new Error(`${file}: every FAQ question needs an answer${unanswered === undefined ? "" : ` ("${unanswered.question}")`}`);
	}
	return faq;
}

/** A component page's prose, from its overview.md. */
export function parseOverview(markdown: string, file: string): ShowcaseOverview {
	const sections = sectionsOf(markdown, file);
	const byTitle = new Map(sections.map((section: MarkdownSection): [string, MarkdownSection] => [section.title, section]));
	const required = (title: string): MarkdownSection => {
		const section = byTitle.get(title);
		if (section === undefined) {
			throw new Error(`${file}: missing "## ${title}"`);
		}
		return section;
	};
	const notes = byTitle.get(NOTES);
	const whenToUse = listItemsOf(required(WHEN_TO_USE), file);
	const whenNotToUse = listItemsOf(required(WHEN_NOT_TO_USE), file);
	const faq = faqOf(required(FAQ), file);
	const body = sections
		.filter(({ title }: MarkdownSection): boolean => !LIST_SECTIONS.has(title) && title !== FAQ)
		.map(({ title, lines }: MarkdownSection): string => `## ${title}\n${lines.join("\n")}`.trim())
		.join("\n\n");
	if (body === "") {
		throw new Error(`${file}: needs at least one overview section besides the lists and the FAQ`);
	}
	return { whenToUse, whenNotToUse, notes: notes === undefined ? [] : listItemsOf(notes, file), body, faq };
}

/** The bodies of every ```<language>``` block in `markdown`. */
export function fencedBlocksOf(markdown: string, language: string): string[] {
	const blocks: string[] = [];
	let open: { marks: string; lines: string[] } | null = null;
	let current: string | null = null;
	for (const line of markdown.split("\n")) {
		const match = FENCE.exec(line)?.groups;
		if (open === null && match !== undefined) {
			open = { marks: match.marks ?? "", lines: [] };
			current = (match.info ?? "").trim();
		} else if (open !== null && match !== undefined && (match.marks ?? "").startsWith(open.marks) && (match.info ?? "").trim() === "") {
			if (current === language) {
				blocks.push(open.lines.join("\n").trim());
			}
			open = null;
			current = null;
		} else if (open !== null) {
			open.lines.push(line);
		}
	}
	return blocks;
}

/** A docs page, from its docs.md: checked for its one API block and for examples that exist. */
export function parseDocs(markdown: string, file: string, features: readonly GeneratedFeature[]): ShowcaseDocs {
	sectionsOf(markdown, file);
	const apiBlocks = fencedBlocksOf(markdown, API_FENCE);
	if (apiBlocks.length !== 1) {
		throw new Error(`${file}: needs exactly one \`\`\`${API_FENCE}\`\`\` block (found ${String(apiBlocks.length)})`);
	}
	const byId = new Map(features.map((feature: GeneratedFeature): [string, GeneratedFeature] => [feature.id, feature]));
	const examples = [...new Set(fencedBlocksOf(markdown, EXAMPLE_FENCE))].map((id: string): ShowcaseDocsExample => {
		const feature = byId.get(id);
		if (feature === undefined) {
			throw new Error(`${file}: \`\`\`${EXAMPLE_FENCE}\`\`\` names "${id}", which is not one of this component's features`);
		}
		return { id, label: feature.label, anchor: feature.anchor, part: feature.part, file: feature.file, source: feature.source };
	});
	return { body: markdown.trim(), examples };
}

/** A component's content, or `null` while it has neither file (the test requires both). */
export function readComponentContent(root: string, component: ComponentFeatures): ShowcaseContent | null {
	const folder = `${EXAMPLES_DIR}/${component.slug}`;
	const overviewFile = path.join(root, folder, OVERVIEW_FILE);
	const docsFile = path.join(root, folder, DOCS_FILE);
	if (!existsSync(overviewFile) && !existsSync(docsFile)) {
		return null;
	}
	return {
		overview: parseOverview(readFileSync(overviewFile, "utf8"), `${folder}/${OVERVIEW_FILE}`),
		docs: parseDocs(readFileSync(docsFile, "utf8"), `${folder}/${DOCS_FILE}`, component.features),
	};
}

/** One component's content module. */
export function contentModuleSource(slug: string, content: ShowcaseContent, showcaseAlias: string): string {
	return `// GENERATED by \`pnpm showcase:generate\` — do not edit by hand.
// The ${slug} component's overview and docs (${EXAMPLES_DIR}/${slug}/${OVERVIEW_FILE}, ${DOCS_FILE}).

import type { ShowcaseContent } from "${showcaseAlias}/showcase-content";

export const SHOWCASE_COMPONENT_CONTENT: ShowcaseContent = ${JSON.stringify(content, null, "\t")};
`;
}

/** The index: every component's content behind a dynamic import. */
export function contentIndexSource(slugs: readonly string[], showcaseAlias: string): string {
	const rows = slugs.map(
		(slug: string): string =>
			`\t[${JSON.stringify(slug)}, async (): Promise<ShowcaseContent> => (await import("${showcaseAlias}/generated/content/${slug}")).SHOWCASE_COMPONENT_CONTENT],`,
	);
	return `// GENERATED by \`pnpm showcase:generate\` — do not edit by hand.
// Every component's written content, each loaded only by its own pages.

import type { ShowcaseContent } from "${showcaseAlias}/showcase-content";

export type LoadShowcaseContent = () => Promise<ShowcaseContent>;

export const SHOWCASE_CONTENT: ReadonlyMap<string, LoadShowcaseContent> = new Map<string, LoadShowcaseContent>([
${rows.join("\n")}
]);
`;
}

/** The alias the generated modules import the showcase from. */
export const SHOWCASE_ALIAS = "@/components/component-showcase";

if (import.meta.main) {
	const root = path.resolve(import.meta.dirname, "..");
	const written = readComponentFeatures(root).flatMap((component: ComponentFeatures): { slug: string; content: ShowcaseContent }[] => {
		const content = readComponentContent(root, component);
		return content === null ? [] : [{ slug: component.slug, content }];
	});
	rmSync(path.join(root, CONTENT_DIR), { recursive: true, force: true });
	mkdirSync(path.join(root, CONTENT_DIR), { recursive: true });
	for (const { slug, content } of written) {
		writeFileSync(path.join(root, CONTENT_DIR, `${slug}.ts`), contentModuleSource(slug, content, SHOWCASE_ALIAS));
	}
	writeFileSync(
		path.join(root, CONTENT_INDEX_FILE),
		contentIndexSource(
			written.map(({ slug }): string => slug),
			SHOWCASE_ALIAS,
		),
	);
	process.stdout.write(`showcase content: ${String(written.length)} components\n`);
}
