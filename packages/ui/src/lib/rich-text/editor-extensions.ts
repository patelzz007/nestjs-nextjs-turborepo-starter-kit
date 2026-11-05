import { mergeAttributes, Node, type AnyExtension, type JSONContent } from "@tiptap/core";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";
import { HttpsLinkSchema, RICH_TEXT_MAX_TEXT_LENGTH, type RichTextJsonObject } from "@workspace/shared";
import { z } from "zod";

// The broadcast editor's extensions (ADR 073): exactly the nodes and marks the shared rich-text schema
// accepts — paragraph, H2/H3, bold, italic, underline, strike, inline code, https links, lists, quotes,
// rules, code blocks, tables and one call-to-action button. Everything else (embeds, colours, font
// sizes, raw HTML) is never registered, so the editor cannot produce it.

/** The heading levels a broadcast may use (H1 is the broadcast title). */
export const RICH_TEXT_HEADING_LEVELS: readonly (2 | 3)[] = [2, 3];

/** What a call-to-action button carries. */
export interface CallToActionAttributes {
	readonly label: string;
	readonly href: string;
}

/** A picture the body names: its file id, its alt text, and (for display only) the address the server gave it. */
export interface BroadcastImageAttributes {
	readonly fileId: string;
	readonly alt: string;
	readonly src: string;
}

declare module "@tiptap/core" {
	interface Commands<ReturnType> {
		callToAction: {
			/** Insert the broadcast's call-to-action button (the schema allows one). */
			insertCallToAction: (attributes: CallToActionAttributes) => ReturnType;
		};
		broadcastImage: {
			/** Insert the broadcast's one picture (enhancement 5.4). */
			insertBroadcastImage: (attributes: BroadcastImageAttributes) => ReturnType;
		};
	}
}

const CtaAttributeSchema = z.string();

/** The call-to-action button: one labelled https link, rendered as a button in every channel. */
export const CallToAction = Node.create({
	name: "callToAction",
	group: "block",
	atom: true,
	selectable: true,
	draggable: false,
	addAttributes() {
		return {
			label: { default: "", parseHTML: (element: HTMLElement): string => element.textContent },
			href: { default: "", parseHTML: (element: HTMLElement): string => CtaAttributeSchema.catch("").parse(element.getAttribute("href")) },
		};
	},
	parseHTML() {
		return [{ tag: "a[data-call-to-action]" }];
	},
	renderHTML({ node, HTMLAttributes }) {
		const label = CtaAttributeSchema.catch("").parse(node.attrs.label);
		return [
			"a",
			mergeAttributes(HTMLAttributes, { "data-call-to-action": "", class: "rte-call-to-action", rel: "noopener noreferrer nofollow", target: "_blank", label: null }),
			label,
		];
	},
	addCommands() {
		return {
			insertCallToAction:
				(attributes: CallToActionAttributes) =>
				({ commands }): boolean =>
					commands.insertContent({ type: this.name, attrs: { label: attributes.label, href: attributes.href } }),
		};
	},
});

const ImageAttributeSchema = z.string();

/**
 * The broadcast's picture (enhancement 5.4): a block holding a scanned file of the files context, never an
 * outside address. `src` is only for showing it while editing; the composer drops it before saving.
 */
export const BroadcastImage = Node.create({
	name: "image",
	group: "block",
	atom: true,
	selectable: true,
	draggable: false,
	addAttributes() {
		return {
			fileId: { default: "", parseHTML: (element: HTMLElement): string => ImageAttributeSchema.catch("").parse(element.getAttribute("data-file-id")) },
			alt: { default: "", parseHTML: (element: HTMLElement): string => ImageAttributeSchema.catch("").parse(element.getAttribute("alt")) },
			src: { default: null },
		};
	},
	parseHTML() {
		return [{ tag: "img[data-file-id]" }];
	},
	renderHTML({ node, HTMLAttributes }) {
		return ["img", mergeAttributes(HTMLAttributes, { "data-file-id": ImageAttributeSchema.catch("").parse(node.attrs.fileId), class: "rte-image", fileId: null })];
	},
	addCommands() {
		return {
			insertBroadcastImage:
				(attributes: BroadcastImageAttributes) =>
				({ commands }): boolean =>
					commands.insertContent({ type: this.name, attrs: { fileId: attributes.fileId, alt: attributes.alt, src: attributes.src } }),
		};
	},
});

/** Whether a link may go into a broadcast: an absolute https URL (the server also checks shorteners and blocked domains). */
export function isAllowedBroadcastLink(href: string): boolean {
	return HttpsLinkSchema.safeParse(href).success;
}

export interface BroadcastEditorExtensionOptions {
	/** Shown while the document is empty. */
	readonly placeholder: string;
}

/** The extension list of the broadcast editor. */
export function broadcastEditorExtensions({ placeholder }: BroadcastEditorExtensionOptions): AnyExtension[] {
	return [
		StarterKit.configure({
			heading: { levels: [...RICH_TEXT_HEADING_LEVELS] },
			link: {
				openOnClick: false,
				autolink: true,
				defaultProtocol: "https",
				protocols: ["https"],
				isAllowedUri: (url: string): boolean => isAllowedBroadcastLink(url),
			},
			// Not in the broadcast schema.
			trailingNode: false,
		}),
		Table.configure({ resizable: false }),
		TableRow,
		// The broadcast schema holds only paragraphs in a cell (no lists, tables or buttons inside a table).
		TableHeader.extend({ content: "paragraph+" }),
		TableCell.extend({ content: "paragraph+" }),
		CallToAction,
		BroadcastImage,
		Placeholder.configure({ placeholder }),
		CharacterCount.configure({ limit: RICH_TEXT_MAX_TEXT_LENGTH }),
	];
}

/**
 * A stored document (read-only arrays, `RichTextDocument`) as the editor's starting content. Tiptap never
 * mutates the content it is given, so each node is copied key by key into its open `JSONContent` shape.
 */
export function richTextToEditorContent(document: RichTextJsonObject): JSONContent {
	const content: JSONContent = {};
	for (const [key, value] of Object.entries(document)) {
		content[key] = value;
	}
	return content;
}
