import type { DocsCollection, SourceAsset, SourceBody, SourceCover, SourceDocumentMeta } from "@workspace/docs-content/document";

import { downloadImage, type DownloadEnvironment } from "../../locked-download.ts";
import type { DocsSource, DownloadedAsset } from "../../source.ts";
import { convertBlocks, NOTION_CONVERTER_VERSION } from "./notion-blocks.ts";
import type { NotionClient } from "./notion-client.ts";
import { normalisePageId, plainText } from "./notion-rich-text.ts";
import type { NotionPage, PropertyValue } from "./notion-schemas.ts";
import { placementOf, type TreePlacement, type TreeRow } from "./notion-tree.ts";

/**
 * Notion as a docs source. Only pages whose Status is Published are read, and the integration is shared with the
 * Published databases alone, so a draft can never reach the site (plan §3). Docs pages sit in a folder tree that
 * gives them their addresses (`notion-tree.ts`); blog posts are flat.
 */

/** The property names of the Published databases (`docs:notion:setup` creates them). */
export const NOTION_PROPERTIES = {
	title: "Title",
	slug: "Slug",
	description: "Description",
	section: "Section",
	order: "Order",
	author: "Author",
	tags: "Tags",
	category: "Category",
	/** When the page was first published. */
	date: "Date",
	/** When it last changed in a way a reader should know about. Notion's own edit time is the third date. */
	lastUpdated: "Last updated",
	status: "Status",
	/** Docs only: Page or Folder. Empty counts as Page. */
	kind: "Kind",
	/** Docs only: the folder a row sits in (a relation to the same database, shown by Notion as sub-items). */
	parent: "Parent",
} satisfies Record<string, string>;

export const PUBLISHED_STATUS = "Published";
export const FOLDER_KIND = "Folder";
export const PAGE_KIND = "Page";

/** The hosts Notion serves uploaded files from. Anything else is refused. */
export const NOTION_FILE_HOSTS: ReadonlySet<string> = new Set(["prod-files-secure.s3.us-west-2.amazonaws.com", "s3.us-west-2.amazonaws.com", "file.notion.so"]);

export interface NotionDataSources {
	readonly docs: string;
	readonly blog: string;
}

function textOf(property: PropertyValue | undefined): string | null {
	const text = plainText(property?.rich_text ?? property?.title ?? []).trim();
	return text.length === 0 ? null : text;
}

const COVER_KEY_SUFFIX = "cover";

function coverOf(page: NotionPage): SourceCover | null {
	const { cover } = page;
	if (cover?.file !== undefined) {
		return { kind: "asset", assetKey: `${page.id}-${COVER_KEY_SUFFIX}`, url: cover.file.url };
	}
	return cover?.external === undefined ? null : { kind: "external", url: cover.external.url };
}

/** Whole numbers above zero only: anything else is left empty, and `documentIssues` asks the writer to fix it. */
function orderOf(property: PropertyValue | undefined): number | null {
	const value = property?.number ?? null;
	return value !== null && Number.isInteger(value) && value > 0 ? value : null;
}

function epochMsOf(text: string | undefined): number | null {
	return text === undefined ? null : Date.parse(text);
}

/** A docs row as the folder tree sees it. */
export function treeRowOf(page: NotionPage): TreeRow {
	const property = (name: string): PropertyValue | undefined => page.properties[name];
	return {
		id: normalisePageId(page.id),
		kind: property(NOTION_PROPERTIES.kind)?.select?.name === FOLDER_KIND ? "folder" : "page",
		title: textOf(property(NOTION_PROPERTIES.title)) ?? "",
		ownSlug: textOf(property(NOTION_PROPERTIES.slug)),
		parentIds: (property(NOTION_PROPERTIES.parent)?.relation ?? []).map((related) => normalisePageId(related.id)),
	};
}

/**
 * A Notion page as a document. Its slug is the Slug property, unless `placement` gives the full slug a docs page
 * takes from its folders, with any reason it has none.
 */
export function documentMetaOf(page: NotionPage, collection: DocsCollection, placement: TreePlacement | null = null): SourceDocumentMeta {
	const property = (name: string): PropertyValue | undefined => page.properties[name];
	return {
		sourceId: normalisePageId(page.id),
		sourceUrl: page.url,
		collection,
		title: textOf(property(NOTION_PROPERTIES.title)) ?? "",
		slug: placement === null ? textOf(property(NOTION_PROPERTIES.slug)) : placement.slug,
		description: textOf(property(NOTION_PROPERTIES.description)),
		section: property(NOTION_PROPERTIES.section)?.select?.name ?? null,
		order: orderOf(property(NOTION_PROPERTIES.order)),
		author: textOf(property(NOTION_PROPERTIES.author)),
		tags: (property(NOTION_PROPERTIES.tags)?.multi_select ?? []).map((tag) => tag.name),
		category: property(NOTION_PROPERTIES.category)?.select?.name ?? null,
		publishedAt: epochMsOf(property(NOTION_PROPERTIES.date)?.date?.start),
		lastUpdated: epochMsOf(property(NOTION_PROPERTIES.lastUpdated)?.date?.start),
		editedAt: Date.parse(page.last_edited_time),
		cover: coverOf(page),
		issues: [...(placement?.issues ?? [])],
	};
}

/** The published docs pages, each placed in the folder tree. Folders are not documents: they only give addresses. */
export function placedDocs(rows: readonly NotionPage[]): readonly SourceDocumentMeta[] {
	const tree = new Map(rows.map((page): [string, TreeRow] => [normalisePageId(page.id), treeRowOf(page)]));
	return rows.flatMap((page): SourceDocumentMeta[] => {
		const row = tree.get(normalisePageId(page.id));
		return row === undefined || row.kind === "folder" ? [] : [documentMetaOf(page, "docs", placementOf(row, tree))];
	});
}

export class NotionSource implements DocsSource {
	public readonly kind = "NOTION";
	public readonly converterVersion = NOTION_CONVERTER_VERSION;
	private readonly _client: NotionClient;
	private readonly _dataSources: NotionDataSources;
	private readonly _downloads: DownloadEnvironment;

	public constructor(client: NotionClient, dataSources: NotionDataSources, downloads: DownloadEnvironment) {
		this._client = client;
		this._dataSources = dataSources;
		this._downloads = downloads;
	}

	public async list(): Promise<readonly SourceDocumentMeta[]> {
		const published = { property: NOTION_PROPERTIES.status, select: { equals: PUBLISHED_STATUS } };
		// Docs: the published pages, and every folder, whatever its Status, because folders only give addresses.
		const docsRows = await this._client.queryAll(this._dataSources.docs, { or: [published, { property: NOTION_PROPERTIES.kind, select: { equals: FOLDER_KIND } }] });
		const blog = await this._client.queryAll(this._dataSources.blog, published);
		return [...placedDocs(docsRows), ...blog.map((page) => documentMetaOf(page, "blog"))];
	}

	public async read(meta: SourceDocumentMeta): Promise<SourceBody> {
		return convertBlocks(await this._client.blockTree(meta.sourceId));
	}

	public fetchAsset(asset: SourceAsset): Promise<DownloadedAsset> {
		return downloadImage(asset.url, NOTION_FILE_HOSTS, this._downloads);
	}
}
