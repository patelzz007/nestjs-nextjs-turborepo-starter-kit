/**
 * The guides that get a cover: every Markdown file under the repo-root `docs/` outside the folders that hold
 * no guides. Read by `scripts/covers.ts` (to draw them) and by the covers test (to check each has its own).
 */
import { readdirSync, readFileSync } from "node:fs";

import { GuideFrontmatterSchema, parseMarkdownFile } from "../frontmatter";
import type { CoverSource } from "./cover-detail";

/** Folders that hold no guides: notes, generated data, sync state, and the blog's posts. */
export const NOT_GUIDES: readonly string[] = ["history/", "generated/", "sync/", "blog/"];
const MARKDOWN_EXTENSION = ".md";

export interface CoverGuide extends CoverSource {
	/** The cover its front matter names, if any. */
	readonly cover: string | undefined;
}

/** Every guide under `docsRoot` (a path ending in `/`), sorted by slug. */
export function readCoverGuides(docsRoot: string): readonly CoverGuide[] {
	const files = readdirSync(docsRoot, { recursive: true, encoding: "utf8" }).filter(
		(file) => file.endsWith(MARKDOWN_EXTENSION) && !NOT_GUIDES.some((folder) => file.startsWith(folder)),
	);
	return files
		.sort((left, right) => left.localeCompare(right))
		.map((file) => {
			const { data, body } = parseMarkdownFile(file, readFileSync(`${docsRoot}${file}`, "utf8"), GuideFrontmatterSchema);
			return { slug: file.slice(0, -MARKDOWN_EXTENSION.length), title: data.title, description: data.description, tags: data.tags, body, cover: data.coverImage };
		});
}
