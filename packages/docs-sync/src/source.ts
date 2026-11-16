import type { DocsSourceKind, SourceAsset, SourceBody, SourceDocumentMeta } from "@workspace/docs-content/document";

/**
 * The one seam between the sync engine and a writing tool (ADR 084). Everything a tool does differently stays
 * behind it: Notion's blocks and API, an Obsidian vault's files and wikilinks, Inkdrop's notes and local server.
 *
 * Adding a tool is one folder under `sources/` implementing this, one value in `DocsSourceKindSchema`, and one
 * case in `create-source.ts`. It must pass `sources/__tests__/source-contract.ts`. Nothing in the engine changes.
 */
export interface DocsSource {
	readonly kind: DocsSourceKind;
	/** Bumped when conversion changes, so every page is rebuilt with the new rules. */
	readonly converterVersion: number;
	/**
	 * Every document that is published right now, complete. An incomplete list must throw: a document missing from
	 * it is treated as unpublished.
	 */
	list(): Promise<readonly SourceDocumentMeta[]>;
	/** One document's body. A body it cannot convert comes back with `issues`; only a failed read throws. */
	read(meta: SourceDocumentMeta): Promise<SourceBody>;
	/** One file a body or cover refers to. Each source decides what it may read and how. */
	fetchAsset(asset: SourceAsset): Promise<DownloadedAsset>;
}

/** A file's bytes, already checked by whoever fetched them. */
export interface DownloadedAsset {
	readonly bytes: Uint8Array;
	/** Without the dot: `png`. */
	readonly extension: string;
}
