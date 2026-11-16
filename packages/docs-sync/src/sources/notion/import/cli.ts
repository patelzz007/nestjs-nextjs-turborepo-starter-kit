#!/usr/bin/env node
// The one-time Notion setup and import (ADR 084). Both need NOTION_WRITE_TOKEN: revoke it straight after.
//
//   pnpm docs:notion:setup --parent <page id>   creates the four databases (Docs Published with its folder tree),
//                                               lays the page out, and prints their data source ids
//   pnpm docs:notion:layout [--replace]         lays out the page the databases are on: guidance, the folder tree,
//                                               recent edits, the blog. --replace first trashes what is there
//   pnpm docs:import [--only <slug>]...         imports the repository's pages; run it again to resume
//   pnpm docs:import --fresh [--only <slug>]... first moves every page in both Published databases to Notion's
//                                               trash (restorable for 30 days), then imports from scratch
//   pnpm docs:notion:drop                       only that first step: empties both Published databases (to the
//                                               trash) and clears the saved progress; imports nothing
//
// --fresh is a flag, never the default: once writers work in Notion, those databases hold their pages, and an
// import that always emptied them would delete that work.
//
// Reads the repository, never changes it. Progress and the review list go to .artifacts/docs-sync/.

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { parseJson } from "@workspace/docs-content/json";
import { z } from "zod";

import { setVariables } from "../../../cli-environment.ts";
import { LIVE_NOTION_ENVIRONMENT, NotionClient } from "../notion-client.ts";
import { clearImportTargets, EMPTY_IMPORT_STATE, importRepoDocs, ImportStateSchema, type ImportRepository, type ImportState } from "./import-repo-docs.ts";
import { applyHomeLayout, HomePageNotEmptyError } from "./notion-home.ts";
import { NotionWriter } from "./notion-writer.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../../../..");
const ARTIFACTS = path.join(REPO_ROOT, ".artifacts/docs-sync");
const STATE_FILE = path.join(ARTIFACTS, "import-state.json");
const REVIEW_FILE = path.join(ARTIFACTS, "import-review.md");
/** Folders below `docs/` that are not pages to write in a tool: notes, generated files, sync state. */
const SKIPPED_FOLDERS: readonly string[] = ["docs/history/", "docs/generated/", "docs/sync/"];

const WriteEnvironmentSchema = z.object({ NOTION_WRITE_TOKEN: z.string().min(1) });
const ImportEnvironmentSchema = WriteEnvironmentSchema.extend({ NOTION_DOCS_DATA_SOURCE_ID: z.string().min(1), NOTION_BLOG_DATA_SOURCE_ID: z.string().min(1) });

function say(line: string): void {
	process.stdout.write(`${line}\n`);
}

function writerFor(token: string): NotionWriter {
	return new NotionWriter(new NotionClient(token, LIVE_NOTION_ENVIRONMENT));
}

const repository: ImportRepository = {
	listMarkdown: async (): Promise<readonly string[]> => {
		const names = await readdir(path.join(REPO_ROOT, "docs"), { recursive: true });
		return names
			.map((name) => `docs/${name.replaceAll("\\", "/")}`)
			.filter((file) => file.endsWith(".md") && !SKIPPED_FOLDERS.some((folder) => file.startsWith(folder)))
			.sort();
	},
	read: (file: string): Promise<string> => readFile(path.join(REPO_ROOT, file), "utf8"),
	readBytes: async (file: string): Promise<Uint8Array<ArrayBuffer>> => new Uint8Array(await readFile(path.join(REPO_ROOT, file))),
};

async function loadState(): Promise<ImportState> {
	try {
		return ImportStateSchema.parse(parseJson(await readFile(STATE_FILE, "utf8")));
	} catch {
		return EMPTY_IMPORT_STATE;
	}
}

async function saveState(state: ImportState): Promise<void> {
	await mkdir(ARTIFACTS, { recursive: true });
	await writeFile(STATE_FILE, `${JSON.stringify(state, null, "\t")}\n`);
}

/** The write integration and the two Published databases an import writes to. */
function importTargets(): { readonly writer: NotionWriter; readonly targets: { readonly docs: string; readonly blog: string } } {
	const { NOTION_WRITE_TOKEN: token, NOTION_DOCS_DATA_SOURCE_ID: docs, NOTION_BLOG_DATA_SOURCE_ID: blog } = ImportEnvironmentSchema.parse(setVariables(process.env));
	return { writer: writerFor(token), targets: { docs, blog } };
}

async function drop(args: readonly string[]): Promise<void> {
	parseArgs({ args: [...args], options: {}, strict: true });
	const { writer, targets } = importTargets();
	await clearImportTargets(writer, targets, { saveState, say });
	say("Both Published databases are empty. `pnpm docs:import` starts from scratch.");
}

async function setup(args: readonly string[]): Promise<void> {
	const { values } = parseArgs({ args: [...args], options: { parent: { type: "string" } }, strict: true });
	if (values.parent === undefined) {
		throw new Error("Give the page to create the databases under: --parent <page id>");
	}
	const { NOTION_WRITE_TOKEN: token } = WriteEnvironmentSchema.parse(setVariables(process.env));
	const writer = writerFor(token);
	const databases = await writer.createDatabases(values.parent);
	say("Created the four databases. Share the two Published ones with the read-only integration, then set:");
	say(`NOTION_DOCS_DATA_SOURCE_ID=${databases.docsPublished}`);
	say(`NOTION_BLOG_DATA_SOURCE_ID=${databases.blogPublished}`);
	say(`Drafts (never shared with the integration): docs ${databases.docsDrafts}, blog ${databases.blogDrafts}`);
	try {
		await applyHomeLayout(writer, { docs: databases.docsPublished, blog: databases.blogPublished }, { replace: false, say, repository });
	} catch (error) {
		if (!(error instanceof HomePageNotEmptyError)) {
			throw error;
		}
		say(`The page was not laid out: ${error.message} (pnpm docs:notion:layout --replace)`);
	}
}

async function layout(args: readonly string[]): Promise<void> {
	const { values } = parseArgs({ args: [...args], options: { replace: { type: "boolean" } }, strict: true });
	const { writer, targets } = importTargets();
	await applyHomeLayout(writer, targets, { replace: values.replace === true, say, repository });
}

async function runImport(args: readonly string[]): Promise<void> {
	const { values } = parseArgs({ args: [...args], options: { only: { type: "string", multiple: true }, fresh: { type: "boolean" } }, strict: true });
	const { writer, targets } = importTargets();
	await mkdir(ARTIFACTS, { recursive: true });
	const start = values.fresh === true ? await clearImportTargets(writer, targets, { saveState, say }) : await loadState();
	const outcome = await importRepoDocs(writer, repository, targets, start, { only: values.only ?? [], saveState, say });
	await writeFile(REVIEW_FILE, `# Import review\n\n${outcome.reviews.map((review) => `- ${review}`).join("\n")}\n`);
	say(
		`Created ${String(outcome.created)}, filled ${String(outcome.filled)}, skipped ${String(outcome.skipped.length)}. To check by hand: ${String(outcome.reviews.length)} (${REVIEW_FILE}).`,
	);
}

const COMMANDS: Readonly<Record<string, (args: readonly string[]) => Promise<void>>> = { setup, layout, drop, import: runImport };

const [command = "", ...rest] = process.argv.slice(2);
const chosen = COMMANDS[command];
await (chosen === undefined ? runImport([command, ...rest].filter((word) => word.length > 0)) : chosen(rest));
