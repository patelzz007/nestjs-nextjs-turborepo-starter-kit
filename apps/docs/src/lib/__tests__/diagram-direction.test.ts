import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { directionMismatch, mermaidSources } from "../diagram-direction";

const DOCS_ROOT = fileURLToPath(new URL("../../../../../docs/", import.meta.url));
/** Folders the site never publishes. */
const UNPUBLISHED: readonly string[] = ["history/", "generated/", "sync/"];

/** Eight steps in a row: far wider than the column when drawn left to right. */
const LONG_CHAIN = [
	"A[Engineer installs and configures]",
	"B[Database migrated and seeded]",
	"C[Apps started]",
	"D[SuperAdmin signs in]",
	"E[2FA set up]",
	"F[Email checked]",
	"G[Templates reviewed]",
	"H[Ready to invite merchants]",
]
	.map((node, index, nodes) => (index === nodes.length - 1 ? "" : `    ${node} --> ${nodes[index + 1] ?? ""}`))
	.filter((line) => line.length > 0)
	.join("\n");

describe("directionMismatch", () => {
	it("flags a left-to-right chart too wide for the column, which the site shows top to bottom", () => {
		expect(directionMismatch(`flowchart LR\n${LONG_CHAIN}\n`)).toEqual({ written: "LR", shown: "TD" });
	});

	it("passes the same chart written top to bottom: the site shows it as written", () => {
		expect(directionMismatch(`flowchart TD\n${LONG_CHAIN}\n`)).toBeNull();
		expect(directionMismatch(`graph TB\n${LONG_CHAIN}\n`)).toBeNull();
	});

	it("passes a left-to-right chart that fits", () => {
		expect(directionMismatch("flowchart LR\n    A[Request] --> B[Response]\n")).toBeNull();
	});

	it("ignores what is not a flowchart with a direction", () => {
		expect(directionMismatch("sequenceDiagram\n    A->>B: hi\n")).toBeNull();
		expect(directionMismatch("flowchart\n    A --> B\n")).toBeNull();
	});
});

describe("mermaidSources", () => {
	it("reads every mermaid fence of a page, and nothing else", () => {
		const page = "Intro\n\n```mermaid\nflowchart LR\n    A --> B\n```\n\n```ts\nconst a = 1;\n```\n\n```mermaid\nsequenceDiagram\n```\n";
		expect(mermaidSources(page)).toEqual(["flowchart LR\n    A --> B\n", "sequenceDiagram\n"]);
	});
});

describe("every docs page", () => {
	it("writes each flowchart the way the site shows it, so Notion and every other tool draw it the same", () => {
		const files = readdirSync(DOCS_ROOT, { recursive: true, encoding: "utf8" }).filter(
			(file) => file.endsWith(".md") && !UNPUBLISHED.some((folder) => file.startsWith(folder)),
		);
		const problems = files.flatMap((file) =>
			mermaidSources(readFileSync(`${DOCS_ROOT}${file}`, "utf8")).flatMap((source, index): string[] => {
				const mismatch = directionMismatch(source);
				return mismatch === null
					? []
					: [
							`docs/${file}, chart ${String(index + 1)}: written ${mismatch.written}, shown ${mismatch.shown}. Write it as \`flowchart ${mismatch.shown === "another layout" ? "TD" : mismatch.shown}\`.`,
						];
			}),
		);
		expect(files.length).toBeGreaterThan(0);
		expect(problems).toEqual([]);
	});
});
