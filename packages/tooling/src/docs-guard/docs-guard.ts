import { z } from "zod";

/**
 * The checks around synced docs (ADR 084, plan §2 and §4). Pure, so every path through them is tested:
 *
 * - a generated file is edited at its source, never in a pull request by hand;
 * - the sync's pull request touches only what the sync owns;
 * - a routine edit may merge by itself, and everything else waits for a person;
 * - a pull request that changes behaviour says what happened to the docs.
 */

/** The manifest fields these checks read (`packages/docs-content/src/manifest.ts` owns the full shape). */
const ManifestSchema = z.object({
	entries: z.array(
		z.object({
			sourceId: z.string(),
			slug: z.string(),
			section: z.string().nullable(),
			order: z.number().nullable(),
			filePath: z.string(),
		}),
	),
});
export type DocsManifest = z.output<typeof ManifestSchema>;

export const MANIFEST_PATH = "docs/sync/manifest.json";
const REDIRECTS_PATH = "docs/sync/redirects.json";
const SYNC_FOLDER = "docs/sync/";
const SYNCED_IMAGES_FOLDER = "docs/images/synced/";
const SIDEBAR_FILES: readonly string[] = ["docs/meta.json", "docs/blog/meta.json"];
const GENERATED_FOLDER = "docs/generated/";
const DOCS_FOLDER = "docs/";
const HISTORY_FOLDER = "docs/history/";

/** The branch the sync pushes. */
export const SYNC_BRANCH_PREFIX = "docs-sync/";

/** Sections whose every change gets a human review, whatever else the change is (plan §4; ADR 084 records the list). */
export const SENSITIVE_SECTIONS: readonly string[] = ["docs/adr/", "docs/architecture/", "docs/technical/security/"];

/** One changed file, as `git diff --name-status` reports it. */
export interface ChangedFile {
	readonly path: string;
	readonly status: "added" | "modified" | "deleted";
}

const STATUS_BY_LETTER: Readonly<Record<string, ChangedFile["status"]>> = { A: "added", M: "modified", D: "deleted" };
const NAME_STATUS_LINE = /^(?<letter>[A-Z])\t(?<path>.+)$/u;

/** `git diff --name-status --no-renames` output as changes; a status it does not know counts as a change to review. */
export function parseNameStatus(output: string): readonly ChangedFile[] {
	return output.split("\n").flatMap((line): ChangedFile[] => {
		const groups = NAME_STATUS_LINE.exec(line)?.groups;
		if (groups?.path === undefined) {
			return [];
		}
		return [{ path: groups.path, status: STATUS_BY_LETTER[groups.letter ?? ""] ?? "modified" }];
	});
}

export function parseManifestText(text: string | null): DocsManifest {
	return text === null ? { entries: [] } : ManifestSchema.parse(JSON.parse(text));
}

/** What the sync may write: its pages, images, state and sidebars. Never code, agent rules or the generated API reference. */
export function isSyncOwnedPath(path: string, manifests: readonly DocsManifest[]): boolean {
	if (path.startsWith(GENERATED_FOLDER) || path.startsWith(HISTORY_FOLDER) || !path.startsWith(DOCS_FOLDER)) {
		return false;
	}
	if (path.startsWith(SYNC_FOLDER) || path.startsWith(SYNCED_IMAGES_FOLDER) || SIDEBAR_FILES.includes(path)) {
		return true;
	}
	return manifests.some((manifest) => manifest.entries.some((entry) => entry.filePath === path));
}

/** Files only the sync may change, in a pull request that is not the sync's. */
export function handEditedGeneratedFiles(files: readonly ChangedFile[], manifest: DocsManifest): readonly string[] {
	const generated = new Set(manifest.entries.map((entry) => entry.filePath));
	return files.flatMap((file): string[] => (generated.has(file.path) || file.path === MANIFEST_PATH || file.path === REDIRECTS_PATH ? [file.path] : []));
}

/** Files in the sync's pull request that the sync does not own. */
export function outOfBoundsFiles(files: readonly ChangedFile[], before: DocsManifest, after: DocsManifest): readonly string[] {
	return files.flatMap((file): string[] => (isSyncOwnedPath(file.path, [before, after]) ? [] : [file.path]));
}

/** Why a sync pull request needs a person; empty means a routine edit that may merge by itself. */
export function reviewReasons(files: readonly ChangedFile[], before: DocsManifest, after: DocsManifest): readonly string[] {
	const reasons: string[] = [];
	const previous = new Map(before.entries.map((entry) => [entry.sourceId, entry]));
	const current = new Set(after.entries.map((entry) => entry.sourceId));
	for (const entry of after.entries) {
		const old = previous.get(entry.sourceId);
		if (old === undefined) {
			reasons.push(`New page: ${entry.slug}`);
		} else if (old.slug !== entry.slug) {
			reasons.push(`Slug changed: ${old.slug} → ${entry.slug}`);
		} else if (old.section !== entry.section || old.order !== entry.order) {
			reasons.push(`Navigation changed: ${entry.slug}`);
		}
	}
	for (const entry of before.entries) {
		if (!current.has(entry.sourceId)) {
			reasons.push(`Page removed: ${entry.slug}`);
		}
	}
	if (files.some((file) => file.path === REDIRECTS_PATH)) {
		reasons.push("The redirects changed");
	}
	for (const file of files) {
		if (SENSITIVE_SECTIONS.some((section) => file.path.startsWith(section))) {
			reasons.push(`Sensitive section: ${file.path}`);
		}
	}
	return reasons;
}

const DOCS_LINE_PATTERN = /^Docs: (?:updated in \S+|not needed, \S.*)$/mu;

/** What is wrong with a pull request's "Docs:" line, or null when it has one (plan §2). A signal, not proof. */
export function docsLineProblem(body: string): string | null {
	return DOCS_LINE_PATTERN.test(body) ? null : 'Add a line to the pull request: "Docs: updated in <link>" or "Docs: not needed, <reason>".';
}

/** Bots open pull requests that change no behaviour a writer could describe: dependency bumps, and the sync itself. */
export function isBotAuthor(login: string): boolean {
	return login.endsWith("[bot]");
}
