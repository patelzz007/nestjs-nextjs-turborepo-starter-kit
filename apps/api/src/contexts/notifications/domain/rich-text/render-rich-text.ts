// ============================================
// notifications/domain/rich-text/render-rich-text.ts — a broadcast body, three ways (ADR 073)
// ============================================
// Input is ALWAYS a document that passed `RichTextDocumentSchema` (the allowlist): only known nodes and
// marks, https links, one image (a scanned file id), one call-to-action. Every text is HTML-escaped
// here, so the email HTML can be inserted into the email shell as is. Colours come from the email
// theme, never from the sender.

import {
	richTextInlines,
	type RichTextBlock,
	type RichTextDocument,
	type RichTextInline,
	type RichTextMark,
	type RichTextTableCell,
	type RichTextTableRow,
	type RichTextText,
} from "@workspace/shared";

/** Push bodies are cut to this many characters (ADR 070 renderer limit). */
export const PUSH_BODY_MAX_LENGTH = 240;
const ELLIPSIS = "…";

export interface RichTextRenderOptions {
	/** The public URL of a scanned image file; null when it may not be shown (unscanned, failed, gone). */
	readonly imageUrl: (fileId: string) => string | null;
}

const HTML_ESCAPES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (character: string): string => HTML_ESCAPES[character] ?? character);
}

const TEXT_STYLE = "margin: 0 0 16px 0; font-size: 15px; line-height: 1.6;";
const CELL_STYLE = "border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; vertical-align: top; font-size: 14px;";
const CODE_STYLE =
	"margin: 0 0 16px 0; padding: 12px 14px; border-radius: 8px; background: #f3f4f6; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 13px; white-space: pre-wrap; word-break: break-word;";

function markHtml(mark: RichTextMark, inner: string): string {
	switch (mark.type) {
		case "bold":
			return `<strong>${inner}</strong>`;
		case "italic":
			return `<em>${inner}</em>`;
		case "underline":
			return `<u>${inner}</u>`;
		case "strike":
			return `<s>${inner}</s>`;
		case "code":
			return `<code style="font-family: ui-monospace, Menlo, Consolas, monospace; background: #f3f4f6; padding: 1px 4px; border-radius: 4px;">${inner}</code>`;
		case "link":
			return `<a href="${escapeHtml(mark.attrs.href)}" style="color: #2563eb; text-decoration: underline;">${inner}</a> <span style="color: #6b7280; font-size: 12px;">(${escapeHtml(new URL(mark.attrs.href).hostname)})</span>`;
	}
}

function inlineHtml(inline: RichTextInline): string {
	if (inline.type === "hardBreak") {
		return "<br>";
	}
	return (inline.marks ?? []).reduce((inner: string, mark: RichTextMark): string => markHtml(mark, inner), escapeHtml(inline.text));
}

function inlinesHtml(inlines: readonly RichTextInline[]): string {
	return inlines.map(inlineHtml).join("");
}

function cellHtml(cell: RichTextTableCell): string {
	const tag = cell.type === "tableHeader" ? "th" : "td";
	const weight = cell.type === "tableHeader" ? " font-weight: 600; background: #f9fafb;" : "";
	return `<${tag} style="${CELL_STYLE}${weight}">${cell.content.map((paragraph) => inlinesHtml(paragraph.content ?? [])).join("<br>")}</${tag}>`;
}

function blockHtml(block: RichTextBlock, options: RichTextRenderOptions): string {
	switch (block.type) {
		case "paragraph":
			return `<p style="${TEXT_STYLE}">${inlinesHtml(block.content ?? [])}</p>`;
		case "heading": {
			const size = block.attrs.level === 2 ? "20px" : "17px";
			return `<h${String(block.attrs.level)} style="margin: 8px 0 12px 0; font-size: ${size}; line-height: 1.3;">${inlinesHtml(block.content ?? [])}</h${String(block.attrs.level)}>`;
		}
		case "codeBlock":
			return `<pre style="${CODE_STYLE}">${escapeHtml((block.content ?? []).map((text: RichTextText): string => text.text).join(""))}</pre>`;
		case "bulletList":
		case "orderedList": {
			const tag = block.type === "bulletList" ? "ul" : "ol";
			return `<${tag} style="margin: 0 0 16px 0; padding-left: 22px;">${block.content.map((item) => `<li style="margin: 0 0 6px 0;">${item.content.map((child) => blockHtml(child, options)).join("")}</li>`).join("")}</${tag}>`;
		}
		case "blockquote":
			return `<blockquote style="margin: 0 0 16px 0; padding: 4px 0 4px 14px; border-left: 3px solid #d1d5db; color: #4b5563;">${block.content.map((child) => blockHtml(child, options)).join("")}</blockquote>`;
		case "horizontalRule":
			return '<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">';
		case "image": {
			const url = options.imageUrl(block.attrs.fileId);
			return url === null
				? ""
				: `<p style="margin: 0 0 16px 0;"><img src="${escapeHtml(url)}" alt="${escapeHtml(block.attrs.alt)}" style="max-width: 100%; height: auto; border-radius: 8px;"></p>`;
		}
		case "callToAction":
			return `<p style="margin: 8px 0 20px 0;"><a href="${escapeHtml(block.attrs.href)}" style="display: inline-block; padding: 12px 22px; border-radius: 8px; background: #2563eb; color: #ffffff; font-weight: 600; text-decoration: none;">${escapeHtml(block.attrs.label)}</a><br><span style="color: #6b7280; font-size: 12px;">${escapeHtml(new URL(block.attrs.href).hostname)}</span></p>`;
		case "table":
			return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse: collapse; width: 100%; margin: 0 0 16px 0;">${block.content.map((row: RichTextTableRow): string => `<tr>${row.content.map(cellHtml).join("")}</tr>`).join("")}</table>`;
	}
}

/** Email HTML: safe to insert into the email shell. */
export function renderRichTextHtml(document: RichTextDocument, options: RichTextRenderOptions): string {
	return document.content.map((block: RichTextBlock): string => blockHtml(block, options)).join("");
}

function inlinesText(inlines: readonly RichTextInline[]): string {
	return inlines
		.map((inline: RichTextInline): string => {
			if (inline.type === "hardBreak") {
				return "\n";
			}
			const link = (inline.marks ?? []).find((mark: RichTextMark): boolean => mark.type === "link");
			return link?.type === "link" ? `${inline.text} (${link.attrs.href})` : inline.text;
		})
		.join("");
}

function blockText(block: RichTextBlock, tableHeader: readonly string[] | null): string {
	switch (block.type) {
		case "paragraph":
		case "heading":
			return inlinesText(richTextInlines(block));
		case "codeBlock":
			return (block.content ?? []).map((text: RichTextText): string => text.text).join("");
		case "bulletList":
			return block.content.map((item): string => `• ${item.content.map((child) => blockText(child, null)).join(" ")}`).join("\n");
		case "orderedList":
			return block.content
				.map((item, index): string => `${String((block.attrs?.start ?? 1) + index)}. ${item.content.map((child) => blockText(child, null)).join(" ")}`)
				.join("\n");
		case "blockquote":
			return block.content.map((child) => `> ${blockText(child, null)}`).join("\n");
		case "horizontalRule":
			return "———";
		case "image":
			return block.attrs.alt;
		case "callToAction":
			return `${block.attrs.label}: ${block.attrs.href}`;
		case "table": {
			const [first, ...rest] = block.content;
			const cellsText = (row: RichTextTableRow): string[] => row.content.map((cell) => cell.content.map((paragraph) => inlinesText(paragraph.content ?? [])).join(" "));
			const header = first?.content.every((cell) => cell.type === "tableHeader") === true ? cellsText(first) : tableHeader;
			const bodyRows = header === null ? block.content : rest;
			// Flattened to "Column: value" lines (push and plain-text email, ADR 073).
			return bodyRows
				.map((row: RichTextTableRow): string =>
					cellsText(row)
						.map((value: string, index: number): string => (header?.at(index) === undefined ? value : `${header.at(index) ?? ""}: ${value}`))
						.join("\n"),
				)
				.join("\n\n");
		}
	}
}

/** Plain text in reading order: the email's text twin. */
export function renderRichTextPlain(document: RichTextDocument): string {
	return document.content
		.map((block: RichTextBlock): string => blockText(block, null))
		.filter((text: string): boolean => text.trim().length > 0)
		.join("\n\n");
}

/** Push body: plain text on one line, cut to {@link PUSH_BODY_MAX_LENGTH}. */
export function renderRichTextPreview(document: RichTextDocument, maxLength: number = PUSH_BODY_MAX_LENGTH): string {
	const flat = renderRichTextPlain(document).replace(/\s+/g, " ").trim();
	return flat.length <= maxLength ? flat : `${flat.slice(0, maxLength - ELLIPSIS.length).trimEnd()}${ELLIPSIS}`;
}
