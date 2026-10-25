import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type { Root } from "mdast";
import { describe, expect, it } from "vitest";

import { remarkDiagrams } from "../remark-plugins";

// ── Diagram guard ───────────────────────────────────────────────────────────
// Every ```mermaid fence in docs/ and blog/ must parse: remarkDiagrams fails
// the build on one that does not, and this test reports it in `pnpm test`
// first, with its file and line. (The usual culprit: a `;` inside sequence
// message text ends the statement — write `#59;` for a literal semicolon.)

const REPOSITORY_ROOT: string = path.resolve(import.meta.dirname, "../../../../../..");
const CONTENT_FOLDERS: readonly string[] = ["docs", "blog"];
const MERMAID_FENCE = /^```mermaid\n(?<source>[\s\S]*?)^```/gmu;

interface DiagramFence {
	readonly file: string;
	readonly line: number;
	readonly source: string;
}

function diagramFences(): readonly DiagramFence[] {
	return CONTENT_FOLDERS.flatMap((folder) =>
		readdirSync(path.join(REPOSITORY_ROOT, folder), { recursive: true, encoding: "utf8" })
			.filter((file) => file.endsWith(".md"))
			.sort()
			.flatMap((file) => {
				const text = readFileSync(path.join(REPOSITORY_ROOT, folder, file), "utf8");
				return [...text.matchAll(MERMAID_FENCE)].map((match) => ({
					file: `${folder}/${file}`,
					line: text.slice(0, match.index).split("\n").length,
					source: match.groups?.source ?? "",
				}));
			}),
	);
}

/** Runs the real build step on one fence; returns the error message, or `null` when it parses. */
function buildError(fence: DiagramFence): string | null {
	const tree: Root = {
		type: "root",
		children: [{ type: "code", lang: "mermaid", value: fence.source, position: { start: { line: fence.line, column: 1 }, end: { line: fence.line, column: 1 } } }],
	};
	try {
		remarkDiagrams()(tree);
		return null;
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
}

describe("diagrams in docs/ and blog/", () => {
	const fences = diagramFences();

	it("finds the repository's diagrams (guards the scan itself)", () => {
		expect(fences.length).toBeGreaterThan(0);
	});

	it.each(fences.map((fence): [string, DiagramFence] => [`${fence.file}:${String(fence.line)}`, fence]))("%s parses", (_where, fence) => {
		expect(buildError(fence)).toBeNull();
	});
});
