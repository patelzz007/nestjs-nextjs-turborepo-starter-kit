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
 * Fenced code blocks and inline code spans are skipped (example links and
 * patterns inside them, such as a regex `[a-z](?:…)`, are not real links).
 * External URLs (http/https/mailto) are ignored.
 *
 * Usage: `node scripts/check-links.ts` — exits 1 when any link is broken.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const DOCS_DIR = resolve(import.meta.dirname, "../../../docs");
const GLOB = /^[a-z0-9]+:/; // scheme: (http:, mailto:, etc.)

/** Converts a heading to its GitHub-style anchor slug (github-slugger rules). */
function slugifyHeading(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s_-]/gu, "") // drop punctuation (em-dashes etc.), keep underscores (GitHub does)
		.replace(/ /g, "-") // each space becomes a hyphen (double spaces → `--`)
		.replace(/^-+|-+$/g, ""); // trim edge hyphens
}

/** Heading slugs present in a markdown file (code fences excluded). */
function headingSlugs(filePath: string): Set<string> {
	const source = readFileSync(filePath, "utf8").replace(/```[\s\S]*?```/g, "");
	const slugs = new Set<string>();
	for (const match of source.matchAll(/^#{1,6}\s+(.*)$/gm)) {
		slugs.add(slugifyHeading(match.at(1) ?? ""));
	}
	return slugs;
}

/** Plain markdown links in a file, excluding fenced code blocks and inline code spans. */
function extractLinks(filePath: string): string[] {
	const source = readFileSync(filePath, "utf8")
		.replace(/```[\s\S]*?```/g, "")
		.replace(/`[^`\n]*`/g, "");
	const links: string[] = [];
	for (const match of source.matchAll(/\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
		links.push(match.at(1) ?? "");
	}
	return links;
}

function pageFileForDocsUrl(url: string): { filePath: string; anchor: string | undefined } | undefined {
	const match = /^\/docs\/(.+)$/.exec(url);
	if (match === null) return undefined;
	const page = match.at(1) ?? "";
	const [withoutAnchor = ""] = page.split("#");
	const [slug = ""] = withoutAnchor.split("?");
	// Ids keep their file-name case (`/docs/README`); a lower-cased fallback covers older links.
	const candidates = [slug, slug.toLowerCase()];
	for (const candidate of candidates) {
		const filePath = join(DOCS_DIR, `${candidate}.md`);
		if (existsSync(filePath)) return { filePath, anchor: page.split("#").at(1) };
	}
	return undefined;
}

const problems: string[] = [];
// Recursive: guides live in sub-folders too (`docs/technical/authorization/*.md`).
const files = readdirSync(DOCS_DIR, { recursive: true, encoding: "utf8" })
	.filter((name) => name.endsWith(".md"))
	.sort()
	.map((name) => join(DOCS_DIR, name));

for (const filePath of files) {
	const relPath = filePath.replace(`${DOCS_DIR}/`, "");
	const slugs = headingSlugs(filePath);
	for (const link of extractLinks(filePath)) {
		const [target = "", rawAnchor] = link.split("#");
		const anchor = rawAnchor?.split("?").at(0);

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
	process.stderr.write(`\n❌ ${String(problems.length)} broken link(s) in docs/:\n\n`);
	for (const problem of problems) process.stderr.write(`  - ${problem}\n`);
	process.exit(1);
}

process.stdout.write(`✅ All internal links in docs/ are valid (${String(files.length)} files checked).\n`);
