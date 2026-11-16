import path from "node:path";

import { NOTION_PROPERTIES } from "../notion-source.ts";
import type { ImportRepository } from "./import-repo-docs.ts";
import type { NotionWriter, PageChild, ViewSpec } from "./notion-writer.ts";

/**
 * The page the four docs databases sit on, laid out for the people who write there (ADR 084): what goes where, the
 * folder tree, what changed lately, the blog, and the rules, above the databases themselves. `docs:notion:setup`
 * lays it out; `docs:notion:layout` lays out an existing page.
 */

const HOME_ICON = "📚";
/** The Notion home page's own cover, uploaded to Notion. No docs page uses it: every page has its own. */
export const HOME_COVER_FILE = "docs/images/covers/notion-home.webp";
const HOME_COVER_CONTENT_TYPE = "image/webp";

export const DOCS_PUBLISHED_TITLE = "Docs Published";
export const DOCS_DRAFTS_TITLE = "Docs Drafts";
export const BLOG_PUBLISHED_TITLE = "Blog Published";
export const BLOG_DRAFTS_TITLE = "Blog Drafts";

/** A database the page links to: its block on the page, and the data source a view of it reads. */
export interface HomeDatabase {
	readonly databaseId: string;
	readonly dataSourceId: string;
}

export interface HomeDatabases {
	readonly docsPublished: HomeDatabase;
	readonly blogPublished: HomeDatabase;
	/** The Drafts databases, when the page has them. */
	readonly docsDrafts: string | null;
	readonly blogDrafts: string | null;
}

/** The page's blocks, and which of them each view goes after. */
export interface HomePage {
	readonly blocks: readonly object[];
	readonly views: readonly { readonly afterIndex: number; readonly view: ViewSpec }[];
}

type Annotation = "bold" | "italic" | "code";

interface TextPart {
	readonly text: string;
	readonly annotations: readonly Annotation[];
}

/** A run of text, plain or styled. */
function t(text: string, ...annotations: readonly Annotation[]): TextPart {
	return { text, annotations };
}

function richText(parts: readonly TextPart[]): object[] {
	return parts.map(({ text, annotations }): object => ({
		type: "text",
		text: { content: text },
		...(annotations.length === 0 ? {} : { annotations: Object.fromEntries(annotations.map((annotation) => [annotation, true])) }),
	}));
}

function textBlock(type: string, parts: readonly TextPart[], extra: object = {}): object {
	return { object: "block", type, [type]: { rich_text: richText(parts), ...extra } };
}

function linkToDatabase(databaseId: string): object {
	return { object: "block", type: "link_to_page", link_to_page: { type: "database_id", database_id: databaseId } };
}

function column(children: readonly object[]): object {
	return { object: "block", type: "column", column: { children: [...children] } };
}

const DIVIDER = { object: "block", type: "divider", divider: {} };

/** What a writer must know, said once, where they write. */
const WRITER_RULES: readonly (readonly TextPart[])[] = [
	[t("Slug", "bold"), t(" is only this row's own part of the address: letters, digits, dashes and dots, with no "), t("/", "code"), t(".")],
	[t("To put a page in a folder, set its "), t("Parent", "bold"), t(" to the folder. A folder is a row whose "), t("Kind", "bold"), t(" is Folder.")],
	[t("Moving a page, or renaming or moving a folder, changes the address. The old address keeps working: the site redirects it.")],
	[t("After moving a draft into Docs Published, set its "), t("Parent", "bold"), t(": a relation does not move with the page.")],
	[
		t("Every page needs a Description, a "),
		t("Category", "bold"),
		t(", a "),
		t("Date", "bold"),
		t(" (first published) and "),
		t("Last updated", "bold"),
		t(" (when it last changed in a way a reader should know). Notion keeps the third date, the last edit, by itself."),
	],
	[t("Every docs page also needs a Section and an Order (its place in the sidebar). Every post needs an Author and a cover image.")],
	[t("Status "), t("Archived", "bold"), t(" takes a page off the site and keeps it here. Status has no effect on a folder.")],
];

/** The tree of Docs Published, opened folder by folder. */
export function folderTreeView(dataSourceId: string, parentPropertyId: string): ViewSpec {
	return {
		dataSourceId,
		name: "Docs by folder",
		type: "table",
		configuration: { type: "table", subtasks: { property_id: parentPropertyId, display_mode: "show" } },
		sorts: [{ property: NOTION_PROPERTIES.title, direction: "ascending" }],
	};
}

/** The home page's content, top to bottom, above the databases. */
export function homePage(databases: HomeDatabases, parentPropertyId: string): HomePage {
	const draftLinks = [databases.docsDrafts, databases.blogDrafts].flatMap((id): object[] => (id === null ? [] : [linkToDatabase(id)]));
	const blocks: object[] = [];
	/** Adds a block and answers its position, for a view to follow. */
	const add = (block: object): number => blocks.push(block) - 1;
	add(
		textBlock(
			"callout",
			[
				t("How this works. ", "bold"),
				t(
					"Write in a Drafts database. When a page is ready, a publisher moves it to Docs Published or Blog Published and sets its Status to Published. It is on the docs site within about 15 minutes.",
				),
			],
			{ icon: { type: "emoji", emoji: "💡" }, color: "gray_background" },
		),
	);
	add({
		object: "block",
		type: "column_list",
		column_list: {
			children: [
				column([textBlock("heading_3", [t("✍️ Write")]), textBlock("paragraph", [t("Anyone on the team. Nothing here is ever published.", "italic")]), ...draftLinks]),
				column([
					textBlock("heading_3", [t("🌐 Live")]),
					textBlock("paragraph", [t("Publishers only. A Published page here is on the site.", "italic")]),
					linkToDatabase(databases.docsPublished.databaseId),
					linkToDatabase(databases.blogPublished.databaseId),
				]),
			],
		},
	});
	add(DIVIDER);
	add(textBlock("heading_2", [t("🗂️ Docs by folder")]));
	const treeAnchor = add(
		textBlock("paragraph", [
			t("Open a folder's ▸ to see what is in it. A page's address is its folders' Slugs and its own: "),
			t("technical › api › rest", "code"),
			t(" is "),
			t("/docs/technical/api/rest", "code"),
			t("."),
		]),
	);
	const recentAnchor = add(textBlock("heading_2", [t("🕘 Recently edited")]));
	const blogAnchor = add(textBlock("heading_2", [t("📰 Blog")]));
	add(textBlock("toggle", [t("📏 Rules for writers", "bold")], { children: WRITER_RULES.map((rule) => textBlock("bulleted_list_item", rule)) }));
	add(DIVIDER);
	add(textBlock("heading_2", [t("🗄️ Databases")]));
	return {
		blocks,
		views: [
			{ afterIndex: treeAnchor, view: folderTreeView(databases.docsPublished.dataSourceId, parentPropertyId) },
			{
				afterIndex: recentAnchor,
				view: {
					dataSourceId: databases.docsPublished.dataSourceId,
					name: "Recently edited",
					type: "list",
					configuration: null,
					sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
				},
			},
			{
				afterIndex: blogAnchor,
				view: {
					dataSourceId: databases.blogPublished.dataSourceId,
					name: "Posts",
					type: "gallery",
					configuration: { type: "gallery", cover: { type: "page_cover" } },
					sorts: [{ property: NOTION_PROPERTIES.date, direction: "descending" }],
				},
			},
		],
	};
}

/** The page already holds something besides its databases, and replacing it was not asked for. */
export class HomePageNotEmptyError extends Error {
	public constructor(count: number) {
		super(`The page already has ${String(count)} block(s) besides its databases. Run with --replace to lay it out again: they go to Notion's trash (restorable for 30 days).`);
		this.name = "HomePageNotEmptyError";
	}
}

export interface HomeLayoutOptions {
	/** Move what is on the page now, other than the databases, to the trash first. */
	readonly replace: boolean;
	readonly say: (line: string) => void;
	/** Where the home cover is read from, to upload. */
	readonly repository: Pick<ImportRepository, "readBytes">;
}

/** The page's own databases (not linked views of them) by title, its blank lines, and everything else on it. */
async function sortChildren(
	writer: NotionWriter,
	children: readonly PageChild[],
): Promise<{ readonly databases: ReadonlyMap<string, string>; readonly blanks: readonly PageChild[]; readonly others: readonly PageChild[] }> {
	const databases = new Map<string, string>();
	const blanks: PageChild[] = [];
	const others: PageChild[] = [];
	for (const child of children) {
		if (child.type === "child_database" && child.databaseTitle !== null && (await writer.isOriginalDatabase(child.id))) {
			if (!databases.has(child.databaseTitle)) {
				databases.set(child.databaseTitle, child.id);
			}
		} else if (child.blank) {
			blanks.push(child);
		} else {
			others.push(child);
		}
	}
	return { databases, blanks, others };
}

/**
 * Lays out the page the Published databases sit on. The first time, Docs Published also gets the folder tree as a
 * view of its own. Answers the page's id.
 */
export async function applyHomeLayout(writer: NotionWriter, published: { readonly docs: string; readonly blog: string }, options: HomeLayoutOptions): Promise<string> {
	const docs = await writer.databaseOf(published.docs);
	const blog = await writer.databaseOf(published.blog);
	if (docs.pageId === null) {
		throw new Error("Docs Published is not on a page, so there is no page to lay out.");
	}
	const { databases, blanks, others } = await sortChildren(writer, await writer.pageChildren(docs.pageId));
	if (others.length > 0 && !options.replace) {
		throw new HomePageNotEmptyError(others.length);
	}
	// Blank lines go either way: nobody wrote them, and they would sit between the layout and the databases.
	for (const block of [...blanks, ...others]) {
		await writer.trashBlock(block.id);
	}
	const parentPropertyId = await writer.ensureDocsTree(published.docs);
	if (others.length === 0) {
		await writer.createDatabaseView(docs.databaseId, folderTreeView(published.docs, parentPropertyId));
	}
	const coverUploadId = await writer.uploadImage(path.basename(HOME_COVER_FILE), await options.repository.readBytes(HOME_COVER_FILE), HOME_COVER_CONTENT_TYPE);
	await writer.decoratePage(docs.pageId, HOME_ICON, coverUploadId);
	const page = homePage(
		{
			docsPublished: { databaseId: docs.databaseId, dataSourceId: published.docs },
			blogPublished: { databaseId: blog.databaseId, dataSourceId: published.blog },
			docsDrafts: databases.get(DOCS_DRAFTS_TITLE) ?? null,
			blogDrafts: databases.get(BLOG_DRAFTS_TITLE) ?? null,
		},
		parentPropertyId,
	);
	const ids = await writer.prependBlocks(docs.pageId, page.blocks);
	for (const { afterIndex, view } of page.views) {
		const anchor = ids.at(afterIndex);
		if (anchor === undefined) {
			throw new Error(`Notion did not answer with the block the "${view.name}" view goes after.`);
		}
		await writer.createLinkedView(docs.pageId, anchor, view);
	}
	options.say(
		`Laid out the page ${docs.pageId}: ${String(page.blocks.length)} blocks and ${String(page.views.length)} views${others.length > 0 ? `, after moving ${String(others.length)} old block(s) to the trash` : ""}.`,
	);
	return docs.pageId;
}
