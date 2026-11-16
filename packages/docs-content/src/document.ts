import { DocsSourceKindSchema, DocsSyncIssueSchema, type DocsSourceKind, type DocsSyncIssue } from "@workspace/shared";
import { z } from "zod";

/**
 * What every source hands the sync engine (ADR 084). A source translates its own format into these shapes and
 * nothing else leaves it, so the engine never knows whether a document came from Notion's blocks, an Obsidian
 * vault's files or Inkdrop's notes.
 */

export { DocsSourceKindSchema, type DocsSourceKind, type DocsSyncIssue };

/** Where a document is published on the site. */
export const DocsCollectionSchema = z.enum(["docs", "blog"]);
export type DocsCollection = z.output<typeof DocsCollectionSchema>;

const TextSchema = z.string().trim().min(1);

/** A document's cover: a download the source owns, or an image already on the public web. */
export const SourceCoverSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("asset"), assetKey: TextSchema, url: z.url() }).strict(),
	z.object({ kind: z.literal("external"), url: z.url() }).strict(),
]);
export type SourceCover = z.output<typeof SourceCoverSchema>;

/**
 * A document's details: everything except its body, cheap to list. `sourceId` is the document's identity for
 * life, so a retitled or moved document stays the same page. Optional details are null when the writer left
 * them empty; whether that is allowed is `documentIssues`' decision, not the source's.
 */
export const SourceDocumentMetaSchema = z
	.object({
		sourceId: TextSchema,
		/** Where to edit it; null for a tool with no web address. */
		sourceUrl: z.url().nullable(),
		collection: DocsCollectionSchema,
		title: z.string().trim(),
		slug: z.string().trim().nullable(),
		description: TextSchema.nullable(),
		section: TextSchema.nullable(),
		order: z.number().int().positive().nullable(),
		author: TextSchema.nullable(),
		tags: z.array(TextSchema),
		category: TextSchema.nullable(),
		/** When it was first published (epoch ms), as the writer set it. */
		publishedAt: z.number().int().nullable(),
		/** When it last changed in a way a reader should know about (epoch ms), as the writer set it. */
		lastUpdated: z.number().int().nullable(),
		/** When it was last edited at all (epoch ms), by the tool's own clock: what tells the engine it must read the body again. */
		editedAt: z.number().int(),
		cover: SourceCoverSchema.nullable(),
		/**
		 * Problems only the source can see in these details, said in the writer's terms: a page in a folder tree
		 * whose folder is missing, say. Non-empty holds the document back. A source that cannot work out the slug
		 * leaves it null and explains why here.
		 */
		issues: z.array(DocsSyncIssueSchema),
	})
	.strict();
export type SourceDocumentMeta = z.output<typeof SourceDocumentMetaSchema>;

/** A file the body refers to by `assetKey`, downloaded through the source that found it. */
export const SourceAssetSchema = z.object({ assetKey: TextSchema, url: z.url() }).strict();
export type SourceAsset = z.output<typeof SourceAssetSchema>;

/** A body the source could convert. Links and assets are placeholders the engine resolves (`assetLink`, `pageLink`). */
export const SourceBodySchema = z
	.object({
		markdown: z.string(),
		assets: z.array(SourceAssetSchema),
		/** The `sourceId` of every document this body links to. */
		links: z.array(TextSchema),
		/** Non-empty: the document is held back, for these reasons. */
		issues: z.array(DocsSyncIssueSchema),
	})
	.strict();
export type SourceBody = z.output<typeof SourceBodySchema>;

const ASSET_SCHEME = "docs-sync-asset://";
const PAGE_SCHEME = "docs-sync-page://";

/** Stands in for a link's text when only the engine can know the linked document's title. */
export const PAGE_TITLE_TOKEN = "docs-sync-title";

/** What a source writes where an asset's final path belongs. */
export function assetLink(assetKey: string): string {
	return `${ASSET_SCHEME}${encodeURIComponent(assetKey)}`;
}

/** What a source writes where a link to another document belongs. */
export function pageLink(sourceId: string): string {
	return `${PAGE_SCHEME}${encodeURIComponent(sourceId)}`;
}

const ASSET_LINK_PATTERN = /docs-sync-asset:\/\/(?<key>[^\s)"']+)/gu;
const PAGE_TITLE_LINK_PATTERN = /\[docs-sync-title\]\(docs-sync-page:\/\/(?<id>[^\s)"']+)\)/gu;
const PAGE_LINK_PATTERN = /docs-sync-page:\/\/(?<id>[^\s)"']+)/gu;

/** How the engine fills in a body's placeholders. */
export interface PlaceholderResolver {
	assetPath(assetKey: string): string;
	pagePath(sourceId: string): string;
	pageTitle(sourceId: string): string;
}

/** A replace callback's first capture group, decoded: the arguments are the whole match, then the groups. */
function placeholderValue(match: readonly string[]): string {
	const [, value = ""] = match;
	return decodeURIComponent(value);
}

/** The finished Markdown of a body: every placeholder replaced. */
export function resolvePlaceholders(markdown: string, resolver: PlaceholderResolver): string {
	return markdown
		.replace(PAGE_TITLE_LINK_PATTERN, (...match: string[]): string => {
			const id = placeholderValue(match);
			return `[${resolver.pageTitle(id)}](${resolver.pagePath(id)})`;
		})
		.replace(PAGE_LINK_PATTERN, (...match: string[]): string => resolver.pagePath(placeholderValue(match)))
		.replace(ASSET_LINK_PATTERN, (...match: string[]): string => resolver.assetPath(placeholderValue(match)));
}
