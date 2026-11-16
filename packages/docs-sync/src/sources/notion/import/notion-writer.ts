import { z } from "zod";

import type { NotionClient } from "../notion-client.ts";
import { FOLDER_KIND, NOTION_PROPERTIES, PAGE_KIND, PUBLISHED_STATUS } from "../notion-source.ts";
import type { TreeRowKind } from "../notion-tree.ts";
import type { NotionBlockInput } from "./markdown-to-notion.ts";

/**
 * Everything that writes to Notion, used only by the one-time setup and import with the temporary write token. The
 * sync itself reads: this file is the only place a page is created.
 */

/** Notion's limit on children in one request. */
const APPEND_BATCH_SIZE = 100;

const CreatedSchema = z.object({ id: z.string() });
const CreatedDatabaseSchema = z.object({ id: z.string(), data_sources: z.array(z.object({ id: z.string() })) });
const AppendedSchema = z.object({ results: z.array(z.object({ id: z.string() })) });
const FileUploadSchema = z.object({ id: z.string() });
const DataSourceSchema = z.object({
	parent: z.object({ database_id: z.string() }),
	properties: z.record(z.string(), z.object({ id: z.string(), type: z.string() })),
});
const DatabaseSchema = z.object({ parent: z.object({ page_id: z.string().optional() }), data_sources: z.array(z.object({ id: z.string() })) });
const ChildrenSchema = z.object({
	results: z.array(
		z.object({
			id: z.string(),
			type: z.string(),
			child_database: z.object({ title: z.string() }).optional(),
			paragraph: z.object({ rich_text: z.array(z.object({ plain_text: z.string() })) }).optional(),
		}),
	),
	has_more: z.boolean(),
	next_cursor: z.string().nullable(),
});

/** The relation Notion shows as sub-items: a docs row's folder, and its partner listing what a folder holds. */
export const SUB_ITEMS_PROPERTY = "Sub-items";

const DRAFT_STATUS = "Draft";
const IN_REVIEW_STATUS = "In Review";
const ARCHIVED_STATUS = "Archived";

function selectProperty(names: readonly string[]): object {
	return { type: "select", select: { options: names.map((name) => ({ name })) } };
}

const TEXT_PROPERTY = { type: "rich_text", rich_text: {} };
const LAST_UPDATED_PROPERTY = { type: "date", date: {} };

/** The properties every docs database has (plan §3). The title property is named Title so the source can read it. */
function databaseProperties(statuses: readonly string[]): object {
	return {
		[NOTION_PROPERTIES.title]: { type: "title", title: {} },
		[NOTION_PROPERTIES.slug]: TEXT_PROPERTY,
		[NOTION_PROPERTIES.description]: TEXT_PROPERTY,
		[NOTION_PROPERTIES.author]: TEXT_PROPERTY,
		[NOTION_PROPERTIES.section]: { type: "select", select: { options: [] } },
		[NOTION_PROPERTIES.order]: { type: "number", number: { format: "number" } },
		[NOTION_PROPERTIES.tags]: { type: "multi_select", multi_select: { options: [] } },
		[NOTION_PROPERTIES.category]: { type: "select", select: { options: [] } },
		[NOTION_PROPERTIES.date]: { type: "date", date: {} },
		[NOTION_PROPERTIES.lastUpdated]: LAST_UPDATED_PROPERTY,
		[NOTION_PROPERTIES.status]: selectProperty(statuses),
	};
}

export interface DocsDatabases {
	readonly docsPublished: string;
	readonly blogPublished: string;
	readonly docsDrafts: string;
	readonly blogDrafts: string;
}

/** Where a docs row sits in the folder tree. The blog has no tree. */
export interface TreePosition {
	readonly kind: TreeRowKind;
	/** The folder it is in; null at the top. */
	readonly parentId: string | null;
}

/** What one page's properties hold. Nulls are left out. */
export interface PageProperties {
	readonly title: string;
	/** For a docs row, only its own part of the address. */
	readonly slug: string;
	readonly description: string | null;
	readonly author: string | null;
	readonly section: string | null;
	readonly order: number | null;
	readonly tags: readonly string[];
	readonly category: string | null;
	/** First published and last meaningfully updated, as ISO dates (`2026-11-12`). */
	readonly date: string | null;
	readonly lastUpdated: string | null;
	readonly tree: TreePosition | null;
}

/** A view of a database: the table, list or gallery a person sees. */
export interface ViewSpec {
	readonly dataSourceId: string;
	readonly name: string;
	readonly type: "table" | "list" | "gallery";
	readonly configuration: object | null;
	readonly sorts: readonly object[];
}

/** One top-level block of a page, as the layout needs to know it. */
export interface PageChild {
	readonly id: string;
	readonly type: string;
	/** A database block's title; null for any other block. */
	readonly databaseTitle: string | null;
	/** An empty paragraph: the blank line Notion starts a page with, not anything a person wrote. */
	readonly blank: boolean;
}

function richText(content: string): object {
	return { rich_text: [{ type: "text", text: { content } }] };
}

/** Commas are not allowed in a select option. */
function optionName(name: string): string {
	return name.replaceAll(",", " ");
}

function treePropertiesOf(tree: TreePosition | null): object {
	if (tree === null) {
		return {};
	}
	return {
		[NOTION_PROPERTIES.kind]: { select: { name: tree.kind === "folder" ? FOLDER_KIND : PAGE_KIND } },
		[NOTION_PROPERTIES.parent]: { relation: tree.parentId === null ? [] : [{ id: tree.parentId }] },
	};
}

function propertiesOf(page: PageProperties): object {
	return {
		[NOTION_PROPERTIES.title]: { title: [{ type: "text", text: { content: page.title } }] },
		[NOTION_PROPERTIES.slug]: richText(page.slug),
		...treePropertiesOf(page.tree),
		// A folder is not published or archived: it only gives the pages in it their addresses.
		...(page.tree?.kind === "folder" ? {} : { [NOTION_PROPERTIES.status]: { select: { name: PUBLISHED_STATUS } } }),
		[NOTION_PROPERTIES.tags]: { multi_select: page.tags.map((tag) => ({ name: optionName(tag) })) },
		...(page.description === null ? {} : { [NOTION_PROPERTIES.description]: richText(page.description) }),
		...(page.author === null ? {} : { [NOTION_PROPERTIES.author]: richText(page.author) }),
		...(page.section === null ? {} : { [NOTION_PROPERTIES.section]: { select: { name: optionName(page.section) } } }),
		...(page.order === null ? {} : { [NOTION_PROPERTIES.order]: { number: page.order } }),
		...(page.category === null ? {} : { [NOTION_PROPERTIES.category]: { select: { name: optionName(page.category) } } }),
		...(page.date === null ? {} : { [NOTION_PROPERTIES.date]: { date: { start: page.date } } }),
		...(page.lastUpdated === null ? {} : { [NOTION_PROPERTIES.lastUpdated]: { date: { start: page.lastUpdated } } }),
	};
}

/** A view as the API takes it, wherever it is placed. */
function viewBody(view: ViewSpec): object {
	return {
		data_source_id: view.dataSourceId,
		name: view.name,
		type: view.type,
		...(view.configuration === null ? {} : { configuration: view.configuration }),
		...(view.sorts.length === 0 ? {} : { sorts: [...view.sorts] }),
	};
}

/** A block as the API takes it: its children are sent separately, so nesting can be any depth. */
function requestBlock(block: NotionBlockInput): object {
	return { object: "block", type: block.type, [block.type]: block.content };
}

/**
 * Table rows must arrive with their table, because the API refuses a table with no rows, but at most a batch of
 * them: Notion refuses more than 100 in one request. `append` adds the rest to the table afterwards.
 */
function requestBlockWithRows(block: NotionBlockInput): object {
	if (block.type !== "table") {
		return requestBlock(block);
	}
	return { object: "block", type: "table", table: { ...block.content, children: block.children.slice(0, APPEND_BATCH_SIZE).map(requestBlock) } };
}

/** The children `append` still has to add under a block it just created: a table's rows past the first batch. */
function childrenLeftFor(block: NotionBlockInput): readonly NotionBlockInput[] {
	return block.type === "table" ? block.children.slice(APPEND_BATCH_SIZE) : block.children;
}

export class NotionWriter {
	private readonly _client: NotionClient;

	public constructor(client: NotionClient) {
		this._client = client;
	}

	/** The four databases of plan §3, under one parent page, with Docs Published's folder tree. Answers each one's data source id. */
	public async createDatabases(parentPageId: string): Promise<DocsDatabases> {
		const published = [PUBLISHED_STATUS, ARCHIVED_STATUS];
		const drafts = [DRAFT_STATUS, IN_REVIEW_STATUS];
		const databases = {
			docsPublished: await this.createDatabase(parentPageId, "Docs Published", published),
			docsDrafts: await this.createDatabase(parentPageId, "Docs Drafts", drafts),
			blogPublished: await this.createDatabase(parentPageId, "Blog Published", published),
			blogDrafts: await this.createDatabase(parentPageId, "Blog Drafts", drafts),
		};
		await this.ensureDocsTree(databases.docsPublished);
		return databases;
	}

	/**
	 * Gives a docs database its folder tree, if it has none yet: Kind (Page or Folder) and Parent, a relation to the
	 * same database whose partner, Sub-items, is what Notion nests rows by. Safe to run again. Answers Parent's id.
	 */
	public async ensureDocsTree(dataSourceId: string): Promise<string> {
		const existing = await this.dataSource(dataSourceId);
		const missing = {
			...(existing.properties[NOTION_PROPERTIES.kind] === undefined ? { [NOTION_PROPERTIES.kind]: selectProperty([PAGE_KIND, FOLDER_KIND]) } : {}),
			...(existing.properties[NOTION_PROPERTIES.parent] === undefined
				? {
						[NOTION_PROPERTIES.parent]: {
							type: "relation",
							relation: { data_source_id: dataSourceId, type: "dual_property", dual_property: { synced_property_name: SUB_ITEMS_PROPERTY } },
						},
					}
				: {}),
		};
		const properties = Object.keys(missing).length === 0 ? existing.properties : (await this.updateDataSource(dataSourceId, missing)).properties;
		const parent = properties[NOTION_PROPERTIES.parent];
		if (parent?.type !== "relation") {
			throw new Error(`The docs database's ${NOTION_PROPERTIES.parent} property is not a relation; rename it so setup can add the folder tree.`);
		}
		return parent.id;
	}

	/** Gives a database made before it existed its Last updated date. Safe to run again. */
	public async ensureLastUpdated(dataSourceId: string): Promise<void> {
		const existing = await this.dataSource(dataSourceId);
		if (existing.properties[NOTION_PROPERTIES.lastUpdated] === undefined) {
			await this.updateDataSource(dataSourceId, { [NOTION_PROPERTIES.lastUpdated]: LAST_UPDATED_PROPERTY });
		}
	}

	/** The database a data source belongs to, and the page that database sits on (null when it is not on a page). */
	public async databaseOf(dataSourceId: string): Promise<{ readonly databaseId: string; readonly pageId: string | null }> {
		const { parent } = await this.dataSource(dataSourceId);
		const database = await this._client.request({ method: "GET", path: `/databases/${parent.database_id}` }, DatabaseSchema);
		return { databaseId: parent.database_id, pageId: database.parent.page_id ?? null };
	}

	/**
	 * Whether a database block is a database itself, rather than a linked view of one shown on a page: the data
	 * source of an original belongs to it, a linked view's to another database.
	 */
	public async isOriginalDatabase(databaseId: string): Promise<boolean> {
		const database = await this._client.request({ method: "GET", path: `/databases/${databaseId}` }, DatabaseSchema);
		const [source] = database.data_sources;
		return source !== undefined && (await this.dataSource(source.id)).parent.database_id === databaseId;
	}

	/** A page's top-level blocks, in order. */
	public async pageChildren(pageId: string): Promise<readonly PageChild[]> {
		const children: PageChild[] = [];
		let cursor: string | null = null;
		do {
			const query = cursor === null ? "" : `&start_cursor=${cursor}`;
			const listed: z.output<typeof ChildrenSchema> = await this._client.request(
				{ method: "GET", path: `/blocks/${pageId}/children?page_size=${String(APPEND_BATCH_SIZE)}${query}` },
				ChildrenSchema,
			);
			children.push(
				...listed.results.map((child): PageChild => ({
					id: child.id,
					type: child.type,
					databaseTitle: child.child_database?.title ?? null,
					blank: child.paragraph?.rich_text.every((part) => part.plain_text.trim().length === 0) === true,
				})),
			);
			cursor = listed.has_more ? listed.next_cursor : null;
		} while (cursor !== null);
		return children;
	}

	/** Moves a block, or a linked view's block, to the trash. */
	public async trashBlock(blockId: string): Promise<void> {
		await this._client.request({ method: "PATCH", path: `/blocks/${blockId}`, body: { in_trash: true } }, CreatedSchema);
	}

	/** Puts blocks, already in the API's shape, at the top of a page. Answers their ids, in order. */
	public async prependBlocks(pageId: string, blocks: readonly object[]): Promise<readonly string[]> {
		const appended = await this._client.request(
			{ method: "PATCH", path: `/blocks/${pageId}/children`, body: { position: { type: "start" }, children: [...blocks] } },
			AppendedSchema,
		);
		return appended.results.map((block) => block.id);
	}

	/** Gives a page an emoji icon and a cover uploaded with `uploadImage`. */
	public async decoratePage(pageId: string, emoji: string, coverUploadId: string): Promise<void> {
		await this._client.request(
			{ method: "PATCH", path: `/pages/${pageId}`, body: { icon: { type: "emoji", emoji }, cover: { type: "file_upload", file_upload: { id: coverUploadId } } } },
			CreatedSchema,
		);
	}

	/** Adds a view to a database itself, as a tab beside its others. */
	public async createDatabaseView(databaseId: string, view: ViewSpec): Promise<void> {
		await this._client.request({ method: "POST", path: "/views", body: { database_id: databaseId, ...viewBody(view) } }, CreatedSchema);
	}

	/** Shows a database on a page, through a view of its own, right after a given block. */
	public async createLinkedView(pageId: string, afterBlockId: string, view: ViewSpec): Promise<void> {
		await this._client.request(
			{
				method: "POST",
				path: "/views",
				body: { create_database: { parent: { type: "page_id", page_id: pageId }, position: { type: "after_block", block_id: afterBlockId } }, ...viewBody(view) },
			},
			CreatedSchema,
		);
	}

	public async createPage(dataSourceId: string, page: PageProperties, cover: object | null): Promise<string> {
		const created = await this._client.request(
			{
				method: "POST",
				path: "/pages",
				body: { parent: { type: "data_source_id", data_source_id: dataSourceId }, properties: propertiesOf(page), ...(cover === null ? {} : { cover }) },
			},
			CreatedSchema,
		);
		return created.id;
	}

	/** Moves every page of a data source to Notion's trash, where it can be restored for 30 days. Answers how many. */
	public async trashAllPages(dataSourceId: string): Promise<number> {
		const pages = await this._client.queryAll(dataSourceId, null);
		for (const page of pages) {
			await this._client.request({ method: "PATCH", path: `/pages/${page.id}`, body: { in_trash: true } }, CreatedSchema);
		}
		return pages.length;
	}

	/** Appends blocks in batches, then each block's children under it. */
	public async append(parentId: string, blocks: readonly NotionBlockInput[]): Promise<void> {
		for (let start = 0; start < blocks.length; start += APPEND_BATCH_SIZE) {
			const batch = blocks.slice(start, start + APPEND_BATCH_SIZE);
			const appended = await this._client.request(
				{ method: "PATCH", path: `/blocks/${parentId}/children`, body: { children: batch.map(requestBlockWithRows) } },
				AppendedSchema,
			);
			for (const [index, block] of batch.entries()) {
				const id = appended.results.at(index)?.id;
				const childrenLeft = childrenLeftFor(block);
				if (id !== undefined && childrenLeft.length > 0) {
					await this.append(id, childrenLeft);
				}
			}
		}
	}

	/** Uploads a repository image; answers what a block or cover refers to it by. */
	public async uploadImage(name: string, bytes: Uint8Array<ArrayBuffer>, contentType: string): Promise<string> {
		const upload = await this._client.request({ method: "POST", path: "/file_uploads", body: { filename: name, content_type: contentType } }, FileUploadSchema);
		const form = new FormData();
		form.set("file", new Blob([bytes], { type: contentType }), name);
		await this._client.sendForm(`/file_uploads/${upload.id}/send`, form);
		return upload.id;
	}

	private dataSource(dataSourceId: string): Promise<z.output<typeof DataSourceSchema>> {
		return this._client.request({ method: "GET", path: `/data_sources/${dataSourceId}` }, DataSourceSchema);
	}

	private updateDataSource(dataSourceId: string, properties: object): Promise<z.output<typeof DataSourceSchema>> {
		return this._client.request({ method: "PATCH", path: `/data_sources/${dataSourceId}`, body: { properties } }, DataSourceSchema);
	}

	private async createDatabase(parentPageId: string, title: string, statuses: readonly string[]): Promise<string> {
		const created = await this._client.request(
			{
				method: "POST",
				path: "/databases",
				body: {
					parent: { type: "page_id", page_id: parentPageId },
					title: [{ type: "text", text: { content: title } }],
					initial_data_source: { properties: databaseProperties(statuses) },
				},
			},
			CreatedDatabaseSchema,
		);
		const [dataSource] = created.data_sources;
		if (dataSource === undefined) {
			throw new Error(`Notion created "${title}" with no data source`);
		}
		return dataSource.id;
	}
}
