import type { NotionBlock, NotionBlockTree, RichText } from "../notion-schemas.ts";

/**
 * Fixtures in the shape of Notion's API reference (version 2026-03-11). They were written from the reference, not
 * captured from a live workspace, because no workspace was connected when this was built: replace them with
 * captured responses at the first live sync (plan §6, "Block support").
 */

const PLAIN = { bold: false, italic: false, strikethrough: false, code: false };

export function text(content: string, annotations: Partial<typeof PLAIN> = {}, href: string | null = null): RichText {
	return { type: "text", plain_text: content, href, annotations: { ...PLAIN, ...annotations } };
}

export function block(type: string, fields: Partial<NotionBlock> = {}, id = `${type}-1`): NotionBlock {
	return { id, type, has_children: false, ...fields };
}

export function tree(value: NotionBlock, children: readonly NotionBlockTree[] = []): NotionBlockTree {
	return { block: value, children };
}

export function paragraph(content: string): NotionBlockTree {
	return tree(block("paragraph", { paragraph: { rich_text: [text(content)] } }));
}

export const PAGE_ID = "11111111-2222-3333-4444-555555555555";
export const FOLDER_ID = "99999999-8888-7777-6666-555555555555";

/** A published docs page, `setup`, inside the `guides` folder (`apiFolder`): its address is `guides/setup`. */
export function apiPage(overrides: Readonly<Record<string, object | string | null>> = {}): object {
	return {
		object: "page",
		id: PAGE_ID,
		url: "https://www.notion.so/Setup-11111111222233334444555555555555",
		last_edited_time: "2026-11-07T10:00:00.000Z",
		cover: null,
		properties: {
			Title: { type: "title", title: [text("Setup")] },
			Slug: { type: "rich_text", rich_text: [text("setup")] },
			Description: { type: "rich_text", rich_text: [text("How to set up.")] },
			Section: { type: "select", select: { name: "Guides" } },
			Order: { type: "number", number: 3 },
			Author: { type: "rich_text", rich_text: [] },
			Tags: { type: "multi_select", multi_select: [{ name: "setup" }] },
			Status: { type: "select", select: { name: "Published" } },
			Kind: { type: "select", select: { name: "Page" } },
			Parent: { type: "relation", relation: [{ id: FOLDER_ID }], has_more: false },
		},
		...overrides,
	};
}

/** A folder row of the Docs Published database: Kind Folder, its own Slug, and a Parent of its own if nested. */
export function apiFolder(id: string = FOLDER_ID, slug = "guides", parentId: string | null = null): object {
	return {
		object: "page",
		id,
		url: `https://www.notion.so/${id.replaceAll("-", "")}`,
		last_edited_time: "2026-11-07T09:00:00.000Z",
		cover: null,
		properties: {
			Title: { type: "title", title: [text(slug)] },
			Slug: { type: "rich_text", rich_text: [text(slug)] },
			Status: { type: "select", select: null },
			Kind: { type: "select", select: { name: "Folder" } },
			Parent: { type: "relation", relation: parentId === null ? [] : [{ id: parentId }], has_more: false },
		},
	};
}
