import { assertNever } from "../../../lib/assert-never";
import type { RichTextBlock, RichTextDocument } from "./rich-text";

// The pictures of a broadcast body (enhancement 5.4), for the API (adding addresses) and the apps (dropping
// them before saving). A stored body names its pictures by file id only; what the
// server answers gives each its public address (`src`). Images can sit at the top level, in a list item or in a
// quote; a table holds only paragraphs.

function blockImageIds(block: RichTextBlock): string[] {
	switch (block.type) {
		case "image":
			return [block.attrs.fileId];
		case "bulletList":
		case "orderedList":
			return block.content.flatMap((item) => item.content.flatMap(blockImageIds));
		case "blockquote":
			return block.content.flatMap(blockImageIds);
		case "paragraph":
		case "heading":
		case "codeBlock":
		case "horizontalRule":
		case "callToAction":
		case "table":
			return [];
		default:
			return assertNever(block, "rich-text block");
	}
}

/** Every image's file id in the body, each once, in order. */
export function imageFileIdsOf(document: RichTextDocument): readonly string[] {
	return [...new Set(document.content.flatMap(blockImageIds))];
}

function withBlockSources(block: RichTextBlock, sources: ReadonlyMap<string, string>): RichTextBlock {
	switch (block.type) {
		case "image": {
			const src = sources.get(block.attrs.fileId);
			return { ...block, attrs: { fileId: block.attrs.fileId, alt: block.attrs.alt, ...(src === undefined ? {} : { src }) } };
		}
		case "bulletList":
		case "orderedList":
			return { ...block, content: block.content.map((item) => ({ ...item, content: item.content.map((child) => withBlockSources(child, sources)) })) };
		case "blockquote":
			return { ...block, content: block.content.map((child) => withBlockSources(child, sources)) };
		case "paragraph":
		case "heading":
		case "codeBlock":
		case "horizontalRule":
		case "callToAction":
		case "table":
			return block;
		default:
			return assertNever(block, "rich-text block");
	}
}

/**
 * The body as the server answers it: each image with its public address. One the map doesn't know (removed,
 * or not ready) keeps no `src`, so every renderer leaves it out rather than showing a broken picture.
 */
export function withImageSources(document: RichTextDocument, sources: ReadonlyMap<string, string>): RichTextDocument {
	return { ...document, content: document.content.map((block) => withBlockSources(block, sources)) };
}

function withoutBlockSources(block: RichTextBlock): RichTextBlock {
	switch (block.type) {
		case "image":
			return { ...block, attrs: { fileId: block.attrs.fileId, alt: block.attrs.alt } };
		case "bulletList":
		case "orderedList":
			return { ...block, content: block.content.map((item) => ({ ...item, content: item.content.map(withoutBlockSources) })) };
		case "blockquote":
			return { ...block, content: block.content.map(withoutBlockSources) };
		case "paragraph":
		case "heading":
		case "codeBlock":
		case "horizontalRule":
		case "callToAction":
		case "table":
			return block;
		default:
			return assertNever(block, "rich-text block");
	}
}

/**
 * The body as a client saves it: every picture named by file id only. The server answers with addresses
 * (`src`); a request may not carry them (the request schema refuses one), so an edited body drops them first.
 */
export function withoutImageSources(document: RichTextDocument): RichTextDocument {
	return { ...document, content: document.content.map(withoutBlockSources) };
}
