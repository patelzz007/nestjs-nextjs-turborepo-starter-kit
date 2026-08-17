#!/usr/bin/env node
/**
 * Link checker for the repo-root `docs/` folder.
 *
 * Validates every internal link and anchor across the guides:
 *   - `./file.md` / `file.md` → the target file must exist
 *   - `./file.md#anchor`      → the target file must exist AND contain the heading
 *   - `#anchor`               → the same file must contain the heading
 *   - `/docs/<slug>`          → maps to `docs/<slug>.md` (README keeps its case)
 *   - `/images/...`           → the file must exist under `docs/images/`
 *
 * Fenced code blocks are skipped (example links inside them are not real
 * links). External URLs (http/https/mailto) are ignored.
 *
 * Usage: `node scripts/check-links.mjs` — exits 1 when any link is broken.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const DOCS_DIR = resolve(import.meta.dirname, "../../../docs");
const GLOB = /^[a-z0-9]+:/; // scheme: (http:, mailto:, etc.)

/** Converts a heading to its GitHub-style anchor slug (github-slugger rules). */
function slugifyHeading(text) {
	return text
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s_-]/gu, "") // drop punctuation (em-dashes etc.), keep underscores (GitHub does)
		.replace(/ /g, "-") // each space becomes a hyphen (double spaces → `--`)
		.replace(/^-+|-+$/g, ""); // trim edge hyphens
}

/** Heading slugs present in a markdown file (code fences excluded). */
function headingSlugs(filePath) {
	const source = readFileSync(filePath, "utf8").replace(/```[\s\S]*?```/g, "");
	const slugs = new Set();
	for (const match of source.matchAll(/^#{1,6}\s+(.*)$/gm)) {
		slugs.add(slugifyHeading(match[1]));
	}
	return slugs;
}

/** Plain markdown links in a file, excluding fenced code blocks. */
function extractLinks(filePath) {
	const source = readFileSync(filePath, "utf8").replace(/```[\s\S]*?```/g, "");
	const links = [];
	for (const match of source.matchAll(/\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
		links.push(match[1]);
	}
	return links;
}

function pageFileForDocsUrl(url) {
	const match = /^\/docs\/(.+)$/.exec(url);
	if (match === null) return undefined;
	const slug = match[1].split("#")[0].split("?")[0];
	// README keeps its original case (`/docs/README`); everything else lowercases.
	const candidates = [slug, slug.toLowerCase()];
	for (const candidate of candidates) {
		const filePath = join(DOCS_DIR, `${candidate}.md`);
		if (existsSync(filePath)) return { filePath, anchor: match[1].includes("#") ? match[1].split("#")[1] : undefined };
	}
	return undefined;
}

const problems = [];
const files = readdirSync(DOCS_DIR)
	.filter((name) => name.endsWith(".md"))
	.map((name) => join(DOCS_DIR, name));

for (const filePath of files) {
	const relPath = filePath.replace(`${DOCS_DIR}/`, "");
	const slugs = headingSlugs(filePath);
	for (const link of extractLinks(filePath)) {
		const [target, rawAnchor] = link.split("#");
		const anchor = rawAnchor?.split("?")[0];

		if (GLOB.test(target) || target.startsWith("//")) continue; // external
		// Same-page anchor: verify the heading exists in this file.
		if (target.length === 0 || target === ".") {
			if (anchor !== undefined && !slugs.has(anchor)) problems.push(`${relPath}: missing anchor #${anchor} on ${link}`);
			continue;
		}
		if (target.startsWith("/images/")) {
			const imagePath = join(DOCS_DIR, target.replace(/^\//, ""));
			if (!existsSync(imagePath)) problems.push(`${relPath}: missing image ${link}`);
			continue;
		}
		if (target.startsWith("/docs/")) {
			const resolved = pageFileForDocsUrl(target);
			if (resolved === undefined) {
				problems.push(`${relPath}: unknown /docs target ${link}`);
				continue;
			}
			if (anchor !== undefined) {
				const targetSlugs = headingSlugs(resolved.filePath);
				if (!targetSlugs.has(anchor)) problems.push(`${relPath}: missing anchor #${anchor} on ${link}`);
			}
			continue;
		}
		if (target.startsWith("/")) {
			problems.push(`${relPath}: root-relative link not under /docs/ or /images/ ${link}`);
			continue;
		}

		// Relative link — resolve against the current file's directory.
		const cleanTarget = target.replace(/^\.\//, "");
		const resolvedTarget = resolve(dirname(filePath), cleanTarget);
		if (!existsSync(resolvedTarget)) {
			problems.push(`${relPath}: missing target ${link}`);
			continue;
		}
		// Directory links (e.g. `./`) are valid navigation targets; only file
		// links can carry anchor checks.
		if (statSync(resolvedTarget).isDirectory()) continue;
		if (anchor !== undefined) {
			const targetSlugs = headingSlugs(resolvedTarget);
			if (!targetSlugs.has(anchor)) problems.push(`${relPath}: missing anchor #${anchor} on ${link}`);
		}
	}
}

if (problems.length > 0) {
	console.error(`\n❌ ${problems.length} broken link(s) in docs/:\n`);
	for (const problem of problems) console.error(`  - ${problem}`);
	process.exit(1);
}

console.log(`✅ All internal links in docs/ are valid (${files.length} files checked).`);
