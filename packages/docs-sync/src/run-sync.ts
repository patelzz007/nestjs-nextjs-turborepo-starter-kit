import { createHash } from "node:crypto";
import path from "node:path";

import { resolvePlaceholders, type SourceBody, type SourceDocumentMeta } from "@workspace/docs-content/document";
import { generatedFile } from "@workspace/docs-content/front-matter";
import {
	CorruptManifestError,
	EMPTY_MANIFEST,
	MANIFEST_PATH,
	parseManifest,
	REDIRECTS_PATH,
	serialiseManifest,
	SYNCED_IMAGES_FOLDER,
	type Manifest,
	type ManifestEntry,
} from "@workspace/docs-content/manifest";
import {
	BLOG_META_PATH,
	DOCS_META_PATH,
	EMPTY_NAVIGATION,
	mergeBlogNavigation,
	mergeDocsNavigation,
	parseNavigation,
	serialiseNavigation,
	type NavigationMeta,
} from "@workspace/docs-content/navigation";
import { buildRedirects, redirectProblems, serialiseRedirects } from "@workspace/docs-content/redirects";
import { DOCS_ROOT, filePathFor } from "@workspace/docs-content/slug";
import { documentIssues, workspaceProblems } from "@workspace/docs-content/validation";
import {
	DOCS_SYNC_HELD_BACK_MAX_ITEMS,
	DOCS_SYNC_ISSUES_PER_PAGE_MAX_ITEMS,
	DOCS_SYNC_TEXT_MAX_LENGTH,
	epochMs,
	type DocsSyncHeldBackPage,
	type DocsSyncIssue,
	type DocsSyncRunReport,
	type DocsSyncTrigger,
} from "@workspace/shared";

import type { ContentStore } from "./content-store.ts";
import type { DocsSource, DownloadedAsset } from "./source.ts";

/**
 * One sync (plan §6). Its invariants, each with a test:
 *
 * 1. The same input gives byte-identical output, and an unchanged source writes nothing.
 * 2. Pages are identified by their source id, never by title or slug.
 * 3. A failed page keeps its last good version, and the others still publish.
 * 4. A workspace-level problem writes nothing at all.
 * 5. Nothing is written until the whole run is decided: every change is staged, then applied.
 * 6. A page still linked from another cannot be removed, and a file still in use is never deleted.
 */

export interface SyncOptions {
	readonly runId: string;
	readonly trigger: DocsSyncTrigger;
	/** Read every page, not only the changed ones: rebuilds the whole generated state. */
	readonly full: boolean;
	/** Allow a page to take over a hand-written file at its path: the one-time import. */
	readonly adopt: boolean;
	readonly defaultAuthor: string;
	readonly now: () => number;
}

export interface SyncOutcome {
	readonly report: DocsSyncRunReport;
	readonly warnings: readonly string[];
}

/** Synced file names use the start of the SHA-256: enough to never collide in one site, short enough to read. */
const ASSET_HASH_LENGTH = 32;

function clip(text: string): string {
	return text.length > DOCS_SYNC_TEXT_MAX_LENGTH ? `${text.slice(0, DOCS_SYNC_TEXT_MAX_LENGTH - 1)}…` : text;
}

function sha256(content: string | Uint8Array): string {
	return createHash("sha256").update(content).digest("hex");
}

function pageIssue(reason: string, fix: string): DocsSyncIssue {
	return { blockId: null, blockType: null, reason: clip(reason), fix: clip(fix) };
}

function heldBackPage(meta: Pick<SourceDocumentMeta, "sourceId" | "sourceUrl" | "title" | "slug">, issues: readonly DocsSyncIssue[]): DocsSyncHeldBackPage {
	return {
		sourceId: meta.sourceId,
		title: clip(meta.title.length === 0 ? "Untitled page" : meta.title),
		slug: meta.slug === null || meta.slug.length === 0 ? null : clip(meta.slug),
		sourceUrl: meta.sourceUrl,
		issues: issues.slice(0, DOCS_SYNC_ISSUES_PER_PAGE_MAX_ITEMS).map((issue) => ({ ...issue, reason: clip(issue.reason), fix: clip(issue.fix) })),
	};
}

/** Files to write and remove once the run is decided. */
interface StagedChanges {
	readonly writes: Map<string, string | Uint8Array>;
	readonly removals: Set<string>;
}

/** A page ready to publish. */
interface ConvertedPage {
	readonly entry: ManifestEntry;
	readonly content: string;
	readonly assets: ReadonlyMap<string, Uint8Array>;
}

class SyncRun {
	private readonly _source: DocsSource;
	private readonly _store: ContentStore;
	private readonly _options: SyncOptions;
	private readonly _startedAt: number;
	private readonly _warnings: string[] = [];
	private readonly _heldBack: DocsSyncHeldBackPage[] = [];

	public constructor(source: DocsSource, store: ContentStore, options: SyncOptions) {
		this._source = source;
		this._store = store;
		this._options = options;
		this._startedAt = options.now();
	}

	public async execute(): Promise<SyncOutcome> {
		let manifest: Manifest;
		try {
			manifest = await this.readManifest();
		} catch (error) {
			if (error instanceof CorruptManifestError) {
				return this.stopped("BLOCKED", error.message);
			}
			throw error;
		}
		let documents: readonly SourceDocumentMeta[];
		try {
			documents = await this._source.list();
		} catch (error) {
			return this.stopped("FAILED", `Could not list the published documents: ${error instanceof Error ? error.message : "unknown error"}`);
		}
		const problems = workspaceProblems(documents);
		if (problems.length > 0) {
			return this.stopped("BLOCKED", problems.join(" "));
		}
		return this.reconcile(manifest, documents);
	}

	private async reconcile(manifest: Manifest, documents: readonly SourceDocumentMeta[]): Promise<SyncOutcome> {
		const previous = new Map(manifest.entries.map((entry) => [entry.sourceId, entry]));
		const valid = documents.filter((meta) => this.passesValidation(meta));
		const toRead = this.documentsToRead(valid, previous);
		const files = this.finalFiles(valid, previous);
		const titles = new Map([...previous.values()].map((entry) => [entry.sourceId, entry.title]));
		for (const meta of valid) {
			titles.set(meta.sourceId, meta.title);
		}

		const converted: ConvertedPage[] = [];
		for (const meta of toRead) {
			const page = await this.convert(meta, previous.get(meta.sourceId), files, titles);
			if (page !== null) {
				converted.push(page);
			}
		}

		const nextById = new Map(previous);
		for (const page of converted) {
			nextById.set(page.entry.sourceId, page.entry);
		}
		const listed = new Set(documents.map((meta) => meta.sourceId));
		const removed = this.removablePages(manifest, nextById, listed);
		for (const entry of removed) {
			nextById.delete(entry.sourceId);
		}

		const next: Manifest = {
			...manifest,
			entries: [...nextById.values()],
			tombstones: [
				...manifest.tombstones.filter((tombstone) => !nextById.has(tombstone.sourceId)),
				...removed.map((entry) => ({ source: entry.source, sourceId: entry.sourceId, collection: entry.collection, slug: entry.slug, lastRunId: this._options.runId })),
			],
		};
		const redirects = buildRedirects(next);
		const redirectIssues = redirectProblems(redirects, next);
		if (redirectIssues.length > 0) {
			return this.stopped("BLOCKED", redirectIssues.join(" "));
		}

		if (converted.length > 0 || removed.length > 0) {
			await this.apply(this.stage(previous, converted, removed), next, redirects, previous, removed);
		}
		return this.finished(converted.length, valid.length - toRead.length, removed.length);
	}

	private async readManifest(): Promise<Manifest> {
		const text = await this._store.read(MANIFEST_PATH);
		return text === null ? EMPTY_MANIFEST : parseManifest(text);
	}

	private passesValidation(meta: SourceDocumentMeta): boolean {
		const issues = documentIssues(meta);
		if (issues.length > 0) {
			this._heldBack.push(heldBackPage(meta, issues));
			return false;
		}
		if (meta.collection === "docs" && meta.cover === null) {
			this._warnings.push(`${meta.title}: no cover, so sharing falls back to the site's default image.`);
		}
		return true;
	}

	/**
	 * New and edited pages, pages whose slug changed, every page on a full sync or a converter change, and pages whose
	 * link targets moved or were retitled. A slug can change without the page itself being edited: moving or renaming
	 * the folder it sits in (a Notion tree, an Obsidian folder) changes its address but not its edit time.
	 */
	private documentsToRead(documents: readonly SourceDocumentMeta[], previous: ReadonlyMap<string, ManifestEntry>): readonly SourceDocumentMeta[] {
		const moved = new Set(
			documents.flatMap((meta): string[] => {
				const entry = previous.get(meta.sourceId);
				return entry !== undefined && (entry.slug !== meta.slug || entry.title !== meta.title) ? [meta.sourceId] : [];
			}),
		);
		return documents.filter((meta) => {
			const entry = previous.get(meta.sourceId);
			return (
				this._options.full ||
				entry === undefined ||
				entry.editedAt !== meta.editedAt ||
				entry.slug !== meta.slug ||
				entry.converterVersion !== this._source.converterVersion ||
				entry.links.some((link) => moved.has(link))
			);
		});
	}

	/** Each document's file after this run: where its slug puts it, or for a held-back page, its last good file. */
	private finalFiles(documents: readonly SourceDocumentMeta[], previous: ReadonlyMap<string, ManifestEntry>): ReadonlyMap<string, string> {
		const files = new Map([...previous.values()].map((entry) => [entry.sourceId, entry.filePath]));
		for (const meta of documents) {
			if (meta.slug !== null) {
				files.set(meta.sourceId, filePathFor(meta.slug, meta.collection));
			}
		}
		return files;
	}

	private async convert(
		meta: SourceDocumentMeta,
		entry: ManifestEntry | undefined,
		files: ReadonlyMap<string, string>,
		titles: ReadonlyMap<string, string>,
	): Promise<ConvertedPage | null> {
		const { slug } = meta;
		if (slug === null) {
			return null;
		}
		let body: SourceBody;
		try {
			body = await this._source.read(meta);
		} catch (error) {
			return this.hold(meta, [pageIssue(`The page could not be read: ${error instanceof Error ? error.message : "unknown error"}`, "It is retried on the next sync.")]);
		}
		const brokenLinks = body.links.filter((link) => !files.has(link));
		const issues = [
			...body.issues,
			...brokenLinks.map((link) => pageIssue(`"${meta.title}" links to ${link}, which is not published.`, "Publish the linked page, or remove the link.")),
		];
		if (issues.length > 0) {
			return this.hold(meta, issues);
		}
		const filePath = filePathFor(slug, meta.collection);
		if (entry?.filePath !== filePath && !this._options.adopt && (await this._store.read(filePath)) !== null) {
			return this.hold(meta, [pageIssue(`${filePath} already exists and no synced page owns it.`, "Choose another slug, or run the import with --adopt.")]);
		}
		const assets = await this.downloadAssets(meta, body);
		if (assets === null) {
			return null;
		}
		const siteAssets = new Map([...assets].map(([key, asset]) => [key, asset.sitePath]));
		const directory = path.posix.dirname(filePath);
		const markdown = resolvePlaceholders(body.markdown, {
			assetPath: (key) => siteAssets.get(key) ?? key,
			pagePath: (id) => path.posix.relative(directory, files.get(id) ?? id),
			pageTitle: (id) => titles.get(id) ?? id,
		});
		const cover = meta.cover === null ? null : meta.cover.kind === "external" ? meta.cover.url : (siteAssets.get(meta.cover.assetKey) ?? null);
		const content = generatedFile(meta, { source: this._source.kind, coverImage: cover, defaultAuthor: this._options.defaultAuthor }, markdown);
		return {
			content,
			assets: new Map([...assets.values()].map((asset) => [asset.file, asset.bytes])),
			entry: {
				source: this._source.kind,
				sourceId: meta.sourceId,
				sourceUrl: meta.sourceUrl,
				collection: meta.collection,
				slug,
				title: meta.title,
				previousSlugs: this.slugHistory(entry, slug),
				section: meta.section,
				order: meta.order,
				filePath,
				contentHash: sha256(content),
				converterVersion: this._source.converterVersion,
				editedAt: meta.editedAt,
				lastRunId: this._options.runId,
				links: [...new Set(body.links)].sort(),
				assets: [...new Set([...assets.values()].map((asset) => asset.file))].sort(),
			},
		};
	}

	private slugHistory(entry: ManifestEntry | undefined, slug: string): string[] {
		if (entry === undefined) {
			return [];
		}
		const history = entry.slug === slug ? entry.previousSlugs : [...entry.previousSlugs, entry.slug];
		return history.filter((previous) => previous !== slug);
	}

	private async downloadAssets(
		meta: SourceDocumentMeta,
		body: SourceBody,
	): Promise<ReadonlyMap<string, { readonly file: string; readonly sitePath: string; readonly bytes: Uint8Array }> | null> {
		const wanted = meta.cover?.kind === "asset" ? [...body.assets, { assetKey: meta.cover.assetKey, url: meta.cover.url }] : body.assets;
		const downloaded = new Map<string, { readonly file: string; readonly sitePath: string; readonly bytes: Uint8Array }>();
		const failures: DocsSyncIssue[] = [];
		for (const asset of wanted) {
			let file: DownloadedAsset;
			try {
				file = await this._source.fetchAsset(asset);
			} catch (error) {
				failures.push({
					blockId: clip(asset.assetKey),
					blockType: "asset",
					reason: clip(error instanceof Error ? error.message : "The file could not be downloaded."),
					fix: "Upload the file again, or replace it.",
				});
				continue;
			}
			const name = `${sha256(file.bytes).slice(0, ASSET_HASH_LENGTH)}.${file.extension}`;
			downloaded.set(asset.assetKey, {
				file: `${SYNCED_IMAGES_FOLDER}/${name}`,
				sitePath: `/${path.posix.relative(DOCS_ROOT, `${SYNCED_IMAGES_FOLDER}/${name}`)}`,
				bytes: file.bytes,
			});
		}
		if (failures.length > 0) {
			return this.hold(meta, failures);
		}
		return downloaded;
	}

	private hold(meta: SourceDocumentMeta, issues: readonly DocsSyncIssue[]): null {
		this._heldBack.push(heldBackPage(meta, issues));
		return null;
	}

	/** Pages gone from the source. One another page still links to stays, and is reported, until that link is fixed. */
	private removablePages(manifest: Manifest, next: ReadonlyMap<string, ManifestEntry>, listed: ReadonlySet<string>): readonly ManifestEntry[] {
		const gone = manifest.entries.filter((entry) => !listed.has(entry.sourceId));
		const goneIds = new Set(gone.map((entry) => entry.sourceId));
		const linkers = [...next.values()].filter((entry) => !goneIds.has(entry.sourceId));
		return gone.filter((entry) => {
			const linker = linkers.find((candidate) => candidate.links.includes(entry.sourceId));
			if (linker === undefined) {
				return true;
			}
			this._heldBack.push(
				heldBackPage({ sourceId: entry.sourceId, sourceUrl: entry.sourceUrl, title: entry.title, slug: entry.slug }, [
					pageIssue(`"${entry.title}" was unpublished, but "${linker.title}" still links to it.`, `Remove the link from "${linker.title}", then unpublish again.`),
				]),
			);
			return false;
		});
	}

	private stage(previous: ReadonlyMap<string, ManifestEntry>, converted: readonly ConvertedPage[], removed: readonly ManifestEntry[]): StagedChanges {
		const staged: StagedChanges = { writes: new Map(), removals: new Set() };
		for (const page of converted) {
			staged.writes.set(page.entry.filePath, page.content);
			for (const [file, bytes] of page.assets) {
				staged.writes.set(file, bytes);
			}
			const before = previous.get(page.entry.sourceId);
			if (before !== undefined && before.filePath !== page.entry.filePath) {
				staged.removals.add(before.filePath);
			}
		}
		for (const entry of removed) {
			staged.removals.add(entry.filePath);
		}
		return staged;
	}

	private async apply(
		staged: StagedChanges,
		next: Manifest,
		redirects: ReturnType<typeof buildRedirects>,
		previous: ReadonlyMap<string, ManifestEntry>,
		removed: readonly ManifestEntry[],
	): Promise<void> {
		for (const [file, content] of staged.writes) {
			await this._store.write(file, content);
		}
		for (const file of staged.removals) {
			if (!staged.writes.has(file)) {
				await this._store.remove(file);
			}
		}
		await this._store.write(MANIFEST_PATH, serialiseManifest(next));
		await this._store.write(REDIRECTS_PATH, serialiseRedirects(redirects));
		await this.applyNavigation(next, previous, removed);
		await this.collectUnusedAssets(next);
	}

	private async applyNavigation(next: Manifest, previous: ReadonlyMap<string, ManifestEntry>, removed: readonly ManifestEntry[]): Promise<void> {
		const leaving = [...previous.values()].filter(
			(entry) => removed.includes(entry) || next.entries.some((current) => current.sourceId === entry.sourceId && current.slug !== entry.slug),
		);
		const idsIn = (collection: ManifestEntry["collection"]): readonly string[] => leaving.filter((entry) => entry.collection === collection).map((entry) => entry.slug);
		const entriesIn = (collection: ManifestEntry["collection"]): readonly ManifestEntry[] => next.entries.filter((entry) => entry.collection === collection);
		await this.writeNavigation(DOCS_META_PATH, (meta) => mergeDocsNavigation(meta, entriesIn("docs"), idsIn("docs")));
		await this.writeNavigation(BLOG_META_PATH, (meta) => mergeBlogNavigation(meta, entriesIn("blog"), idsIn("blog")));
	}

	private async writeNavigation(file: string, merge: (meta: NavigationMeta) => NavigationMeta): Promise<void> {
		const text = await this._store.read(file);
		const current = text === null ? EMPTY_NAVIGATION : parseNavigation(text);
		const merged = merge(current);
		if (JSON.stringify(merged) !== JSON.stringify(current)) {
			await this._store.write(file, serialiseNavigation(merged));
		}
	}

	/** Mark, then sweep: only a file no page uses is deleted. */
	private async collectUnusedAssets(next: Manifest): Promise<void> {
		const inUse = new Set(next.entries.flatMap((entry) => entry.assets));
		for (const file of await this._store.list(SYNCED_IMAGES_FOLDER)) {
			if (!inUse.has(file)) {
				await this._store.remove(file);
			}
		}
	}

	private stopped(status: "BLOCKED" | "FAILED", reason: string): SyncOutcome {
		return { warnings: this._warnings, report: this.report(status, clip(reason), 0, 0, 0) };
	}

	private finished(processed: number, unchanged: number, removed: number): SyncOutcome {
		return { warnings: this._warnings, report: this.report(this._heldBack.length > 0 ? "PARTIAL" : "SUCCEEDED", null, processed, unchanged, removed) };
	}

	private report(status: DocsSyncRunReport["status"], errorSummary: string | null, processed: number, unchanged: number, removed: number): DocsSyncRunReport {
		return {
			runId: this._options.runId,
			source: this._source.kind,
			trigger: this._options.trigger,
			status,
			converterVersion: this._source.converterVersion,
			pagesProcessed: processed,
			pagesUnchanged: unchanged,
			pagesRemoved: removed,
			pagesHeldBack: this._heldBack.length,
			warnings: this._warnings.length,
			heldBack: this._heldBack.slice(0, DOCS_SYNC_HELD_BACK_MAX_ITEMS),
			errorSummary,
			pullRequestUrl: null,
			commitSha: null,
			startedAt: epochMs(this._startedAt),
			finishedAt: epochMs(this._options.now()),
		};
	}
}

/** Runs one sync from `source` into `store`. */
export function runSync(source: DocsSource, store: ContentStore, options: SyncOptions): Promise<SyncOutcome> {
	return new SyncRun(source, store, options).execute();
}
