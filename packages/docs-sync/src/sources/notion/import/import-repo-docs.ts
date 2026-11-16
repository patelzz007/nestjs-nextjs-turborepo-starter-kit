import path from "node:path";

import { parseNavigation } from "@workspace/docs-content/navigation";
import { filePathFor, isSafeSlug } from "@workspace/docs-content/slug";
import type { DocsCollection } from "@workspace/docs-content/document";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

import { markdownToNotion, type NotionBlockInput } from "./markdown-to-notion.ts";
import type { NotionWriter, PageProperties } from "./notion-writer.ts";

/**
 * The one-time import of the repository's pages into Notion (plan §15, phase 2). It reads the repository and never
 * changes it: pages become generated only when the first sync adopts them (`pnpm docs:sync --adopt`).
 *
 * The repository's folders become folder rows of Docs Published, each page sits in its folder, and a row's Slug is
 * only its own part of the address (`notion-tree.ts`). Then two passes, because a link needs the page it points at
 * to exist: create every page, then fill each in. It can be stopped and started: `ImportState` records what is
 * done, and a folder or page is never created twice.
 */

const FRONT_MATTER_PATTERN = /^---\r?\n(?<yaml>[\s\S]*?)\r?\n---(?:\r?\n|$)(?<body>[\s\S]*)$/u;
const SECTION_PATTERN = /^--- (?<label>.+) ---$/u;
const IMAGE_CONTENT_TYPES: Readonly<Record<string, string>> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".avif": "image/avif",
};
const MARKDOWN_EXTENSION = ".md";
const DEFAULT_SECTION = "More Guides";
const HTTPS_PREFIX = "https://";
const DOCS_ROUTE_PREFIX = "/docs/";
const BLOG_ROUTE_PREFIX = "/blog/";
const NOTION_PAGE_URL = "https://www.notion.so/";
const MS_PER_ISO_DATE = 10;
const SLUG_SEPARATOR = "/";
const DOCS_FOLDER_PREFIX = "docs/";

const FrontMatterSchema = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	author: z.string().optional(),
	tags: z.array(z.string()).default([]),
	coverImage: z.string().optional(),
	category: z.string().optional(),
	date: z.number().int().optional(),
	lastUpdated: z.number().int().optional(),
});
type FrontMatter = z.output<typeof FrontMatterSchema>;

/** An epoch-ms front matter date as Notion's date property takes it. */
function isoDate(epochMs: number | undefined): string | null {
	return epochMs === undefined ? null : new Date(epochMs).toISOString().slice(0, MS_PER_ISO_DATE);
}

/** What the import remembers between runs. */
export const ImportStateSchema = z.object({
	/** Repository file → Notion page id. */
	pages: z.record(z.string(), z.string()),
	/** Repository files whose body is in Notion. */
	filled: z.array(z.string()),
});
export type ImportState = z.output<typeof ImportStateSchema>;

/** The repository, as the import reads it. */
export interface ImportRepository {
	listMarkdown(): Promise<readonly string[]>;
	read(file: string): Promise<string>;
	readBytes(file: string): Promise<Uint8Array<ArrayBuffer>>;
}

export interface ImportTargets {
	readonly docs: string;
	readonly blog: string;
}

export interface ImportOptions {
	/** Only these slugs: a pilot of a few pages. Empty imports everything. */
	readonly only: readonly string[];
	/** Called after each change, so a stopped import resumes where it was. */
	readonly saveState: (state: ImportState) => Promise<void>;
	readonly say: (line: string) => void;
}

export interface ImportOutcome {
	readonly created: number;
	readonly filled: number;
	readonly skipped: readonly string[];
	readonly reviews: readonly string[];
}

interface RepoPage {
	readonly file: string;
	readonly collection: DocsCollection;
	readonly slug: string;
	readonly frontMatter: FrontMatter;
	readonly body: string;
	readonly section: string | null;
	readonly order: number | null;
}

function collectionOf(file: string): DocsCollection {
	return file.startsWith("docs/blog/") ? "blog" : "docs";
}

function slugOf(file: string, collection: DocsCollection): string {
	const prefix = collection === "blog" ? "docs/blog/" : "docs/";
	return file.slice(prefix.length, -MARKDOWN_EXTENSION.length);
}

/** Each listed guide's section and position in the sidebar. */
function navigationPlaces(sidebar: string): ReadonlyMap<string, { readonly section: string; readonly order: number }> {
	const places = new Map<string, { readonly section: string; readonly order: number }>();
	let section = DEFAULT_SECTION;
	let order = 0;
	for (const page of parseNavigation(sidebar).pages) {
		const label = SECTION_PATTERN.exec(page)?.groups?.label;
		if (label === undefined) {
			order += 1;
			places.set(page, { section, order });
		} else {
			section = label;
		}
	}
	return places;
}

function parsePage(file: string, text: string, places: ReadonlyMap<string, { readonly section: string; readonly order: number }>, unlistedOrder: number): RepoPage | null {
	const groups = FRONT_MATTER_PATTERN.exec(text)?.groups;
	const parsed = FrontMatterSchema.safeParse(parseYaml(groups?.yaml ?? ""));
	if (!parsed.success) {
		return null;
	}
	const collection = collectionOf(file);
	const slug = slugOf(file, collection);
	if (!isSafeSlug(slug, collection)) {
		return null;
	}
	const place = places.get(slug);
	return {
		file,
		collection,
		slug,
		frontMatter: parsed.data,
		body: groups?.body ?? "",
		section: collection === "blog" ? null : (place?.section ?? DEFAULT_SECTION),
		order: collection === "blog" ? null : (place?.order ?? unlistedOrder),
	};
}

/** The folder a docs slug sits in (`technical/api` for `technical/api/rest`); null at the top. */
export function folderOf(slug: string): string | null {
	const end = slug.lastIndexOf(SLUG_SEPARATOR);
	return end === -1 ? null : slug.slice(0, end);
}

/** A slug's own last part: what a docs row's Slug holds, because its folders give the rest. */
function ownSlugOf(slug: string): string {
	return slug.slice(slug.lastIndexOf(SLUG_SEPARATOR) + 1);
}

/** Every folder the pages need, each after the folders above it. */
export function foldersFor(slugs: readonly string[]): readonly string[] {
	const folders = new Set<string>();
	for (const slug of slugs) {
		for (let folder = folderOf(slug); folder !== null; folder = folderOf(folder)) {
			folders.add(folder);
		}
	}
	const depth = (folder: string): number => folder.split(SLUG_SEPARATOR).length;
	return [...folders].sort((left, right) => depth(left) - depth(right) || left.localeCompare(right));
}

/** The import state's key for a folder: its repository directory, which no Markdown file can be. */
function folderKey(folder: string): string {
	return `${DOCS_FOLDER_PREFIX}${folder}/`;
}

function propertiesOf(page: RepoPage, folderId: string | null): PageProperties {
	const { frontMatter } = page;
	return {
		title: frontMatter.title,
		slug: page.collection === "blog" ? page.slug : ownSlugOf(page.slug),
		description: frontMatter.description ?? null,
		author: frontMatter.author ?? null,
		section: page.section,
		order: page.order,
		tags: frontMatter.tags,
		category: frontMatter.category ?? null,
		date: isoDate(frontMatter.date),
		lastUpdated: isoDate(frontMatter.lastUpdated),
		tree: page.collection === "blog" ? null : { kind: "page", parentId: folderId },
	};
}

function folderProperties(folder: string, parentId: string | null): PageProperties {
	return {
		title: ownSlugOf(folder),
		slug: ownSlugOf(folder),
		description: null,
		author: null,
		section: null,
		order: null,
		tags: [],
		category: null,
		date: null,
		lastUpdated: null,
		tree: { kind: "folder", parentId },
	};
}

/** Uploads a repository image to Notion and returns the upload's id, for a block or a page cover. Null when Notion does not take the file's type. */
async function uploadRepositoryImage(writer: NotionWriter, repository: Pick<ImportRepository, "readBytes">, file: string): Promise<string | null> {
	const contentType = IMAGE_CONTENT_TYPES[path.extname(file).toLowerCase()];
	if (contentType === undefined) {
		return null;
	}
	return writer.uploadImage(path.basename(file), await repository.readBytes(file), contentType);
}

function notionUrl(pageId: string): string {
	return `${NOTION_PAGE_URL}${pageId.replaceAll("-", "")}`;
}

/** The repository file a link points at, from the page it is on. */
export function linkedFile(fromFile: string, url: string): string | null {
	const [target = ""] = url.split("#");
	if (target.startsWith(DOCS_ROUTE_PREFIX)) {
		return `docs/${target.slice(DOCS_ROUTE_PREFIX.length)}${MARKDOWN_EXTENSION}`;
	}
	if (target.startsWith(BLOG_ROUTE_PREFIX)) {
		return `docs/blog/${target.slice(BLOG_ROUTE_PREFIX.length)}${MARKDOWN_EXTENSION}`;
	}
	return target.endsWith(MARKDOWN_EXTENSION) ? path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), target)) : null;
}

/** Where a link goes in Notion: another imported page, or the same web address. */
function linkTargetFor(page: RepoPage, pages: Readonly<Record<string, string>>): (url: string) => string | null {
	return (url: string): string | null => {
		if (url.startsWith(HTTPS_PREFIX)) {
			return url;
		}
		const file = linkedFile(page.file, url);
		const pageId = file === null ? undefined : pages[file];
		return pageId === undefined ? null : notionUrl(pageId);
	};
}

/** The repository file an image path means. */
function imageFile(url: string): string {
	return `docs/${url.replace(/^(?:\.{1,2}\/)+/u, "").replace(/^\//u, "")}`;
}

class Import {
	private readonly _writer: NotionWriter;
	private readonly _repository: ImportRepository;
	private readonly _targets: ImportTargets;
	private readonly _options: ImportOptions;
	private readonly _state: { pages: Record<string, string>; filled: string[] };
	private readonly _reviews: string[] = [];
	private readonly _skipped: string[] = [];
	private _created = 0;
	private _filledNow = 0;

	public constructor(writer: NotionWriter, repository: ImportRepository, targets: ImportTargets, state: ImportState, options: ImportOptions) {
		this._writer = writer;
		this._repository = repository;
		this._targets = targets;
		this._options = options;
		this._state = { pages: { ...state.pages }, filled: [...state.filled] };
	}

	public async run(): Promise<ImportOutcome> {
		const pages = await this.readPages();
		const guides = pages.filter((page) => page.collection === "docs");
		const folders = foldersFor(guides.map((page) => page.slug));
		const toCreate = [...folders.map(folderKey), ...guides.map((page) => page.file)].filter((key) => this._state.pages[key] === undefined);
		if (toCreate.length > 0) {
			await this._writer.ensureDocsTree(this._targets.docs);
		}
		const blogToCreate = pages.some((page) => page.collection === "blog" && this._state.pages[page.file] === undefined);
		if (toCreate.length > 0 || blogToCreate) {
			for (const dataSourceId of [this._targets.docs, this._targets.blog]) {
				await this._writer.ensureLastUpdated(dataSourceId);
			}
		}
		for (const folder of folders) {
			await this.createFolder(folder);
		}
		for (const page of pages) {
			await this.create(page);
		}
		for (const page of pages) {
			await this.fill(page);
		}
		return { created: this._created, filled: this._filledNow, skipped: this._skipped, reviews: this._reviews };
	}

	private async readPages(): Promise<readonly RepoPage[]> {
		const places = navigationPlaces(await this._repository.read("docs/meta.json"));
		const files = await this._repository.listMarkdown();
		const pages: RepoPage[] = [];
		for (const [index, file] of files.entries()) {
			const page = parsePage(file, await this._repository.read(file), places, places.size + index + 1);
			if (page === null) {
				this._skipped.push(file);
			} else if (this._options.only.length === 0 || this._options.only.includes(page.slug)) {
				pages.push(page);
			}
		}
		return pages;
	}

	/** The folder row a folder already has, or null at the top. */
	private folderId(folder: string | null): string | null {
		return folder === null ? null : (this._state.pages[folderKey(folder)] ?? null);
	}

	private async createFolder(folder: string): Promise<void> {
		const key = folderKey(folder);
		if (this._state.pages[key] !== undefined) {
			return;
		}
		this._state.pages[key] = await this._writer.createPage(this._targets.docs, folderProperties(folder, this.folderId(folderOf(folder))), null);
		this._created += 1;
		await this._options.saveState(this._state);
		this._options.say(`Created folder ${folder}`);
	}

	private async create(page: RepoPage): Promise<void> {
		if (this._state.pages[page.file] !== undefined) {
			return;
		}
		const target = page.collection === "blog" ? this._targets.blog : this._targets.docs;
		const folderId = page.collection === "blog" ? null : this.folderId(folderOf(page.slug));
		this._state.pages[page.file] = await this._writer.createPage(target, propertiesOf(page, folderId), await this.coverOf(page));
		this._created += 1;
		await this._options.saveState(this._state);
		this._options.say(`Created ${filePathFor(page.slug, page.collection)}`);
	}

	/**
	 * The page's cover as Notion takes it at creation: a web address as it is, a repository image (the docs' own
	 * covers, `docs/images/covers/`) uploaded. One Notion does not take is reported to add by hand.
	 */
	private async coverOf(page: RepoPage): Promise<object | null> {
		const { coverImage } = page.frontMatter;
		if (coverImage === undefined) {
			return null;
		}
		if (coverImage.startsWith(HTTPS_PREFIX)) {
			return { type: "external", external: { url: coverImage } };
		}
		const uploadId = await uploadRepositoryImage(this._writer, this._repository, imageFile(coverImage));
		if (uploadId === null) {
			this._reviews.push(`${page.file}: the cover ${coverImage} is not an image Notion takes; add it to the page by hand.`);
			return null;
		}
		return { type: "file_upload", file_upload: { id: uploadId } };
	}

	private async fill(page: RepoPage): Promise<void> {
		const pageId = this._state.pages[page.file];
		if (pageId === undefined || this._state.filled.includes(page.file)) {
			return;
		}
		const { blocks, reviews } = markdownToNotion(page.body, { linkTarget: linkTargetFor(page, this._state.pages) });
		this._reviews.push(...reviews.map((review) => `${page.file}: ${review}`));
		await this._writer.append(pageId, await this.withUploads(page, blocks));
		this._state.filled.push(page.file);
		this._filledNow += 1;
		await this._options.saveState(this._state);
		this._options.say(`Filled ${page.file}`);
	}

	/** Uploads the repository images a page uses. One that cannot be read is dropped and reported. */
	private async withUploads(page: RepoPage, blocks: readonly NotionBlockInput[]): Promise<readonly NotionBlockInput[]> {
		const uploaded: NotionBlockInput[] = [];
		for (const block of blocks) {
			const children = await this.withUploads(page, block.children);
			if (block.localImage === undefined) {
				uploaded.push({ ...block, children });
				continue;
			}
			const uploadId = await uploadRepositoryImage(this._writer, this._repository, imageFile(block.localImage));
			if (uploadId === null) {
				this._reviews.push(`${page.file}: ${block.localImage} is not an image Notion takes; add it by hand.`);
				continue;
			}
			uploaded.push({ type: "image", content: { ...block.content, type: "file_upload", file_upload: { id: uploadId } }, children: [] });
		}
		return uploaded;
	}
}

/** Imports the repository's pages. Safe to run again: what is done stays done. */
export function importRepoDocs(
	writer: NotionWriter,
	repository: ImportRepository,
	targets: ImportTargets,
	state: ImportState,
	options: ImportOptions,
): Promise<ImportOutcome> {
	return new Import(writer, repository, targets, state, options).run();
}

/** Nothing imported yet: where an import starts from, and where `clearImportTargets` leaves it. */
export const EMPTY_IMPORT_STATE: ImportState = { pages: {}, filled: [] };

/**
 * Empties both Published databases for an import from scratch (`pnpm docs:import --fresh`): every page in them goes
 * to Notion's trash, including any a writer made there, and the saved progress is cleared to match. Only the import
 * targets are touched; the Drafts databases are not.
 */
export async function clearImportTargets(writer: NotionWriter, targets: ImportTargets, options: Pick<ImportOptions, "saveState" | "say">): Promise<ImportState> {
	const databases: readonly { readonly name: string; readonly dataSourceId: string }[] = [
		{ name: "docs", dataSourceId: targets.docs },
		{ name: "blog", dataSourceId: targets.blog },
	];
	for (const { name, dataSourceId } of databases) {
		const trashed = await writer.trashAllPages(dataSourceId);
		options.say(`Moved ${String(trashed)} ${name} pages to Notion's trash (restorable for 30 days)`);
	}
	await options.saveState(EMPTY_IMPORT_STATE);
	return EMPTY_IMPORT_STATE;
}
