import { z } from "zod";

/**
 * Pure helper that detects whether a markdown `<table>` is actually an image
 * gallery (every body row carries an `<img>` in one of its cells) and, if so,
 * extracts the `{ title, description, src, alt }` pairs for the gallery UI.
 *
 * The docs renderer routes any table whose body rows all contain an image to
 * `DocsImageGallery` instead of the data-table chrome (sticky header, zebra
 * stripes) — a screenshot gallery reads far better as a responsive card grid.
 * The rule is deliberately conservative: a table with a mixed shape (some
 * rows image-less) falls back to the normal table so data tables with an
 * occasional icon column are never hijacked.
 *
 * `title` = the image alt text (or the label cell's text when no alt is
 * set); `description` = the sibling text-cell content (e.g. the accent note
 * in the email-template gallery). A row with no `<img>` anywhere aborts the
 * whole detection (mixed-shape table → regular table).
 *
 * Typing: the component layer receives hast `Element` nodes from
 * react-markdown, but `@types/hast` is not a direct dependency of this app —
 * so this module uses a **structural** view of the node shape instead of
 * importing the hast types (rule: no `any`/`unknown`/casts; a plain readonly
 * shape keeps every access type-safe).
 */

/** One gallery card: the screenshot plus its caption. */
export const ImageGalleryItemSchema = z.object({
	title: z.string(),
	description: z.string(),
	src: z.string(),
	alt: z.string(),
});

export type ImageGalleryItem = z.infer<typeof ImageGalleryItemSchema>;

/** Structural view of a hast node — only the fields this module reads. */
interface HastNodeShape {
	readonly type: string;
	readonly tagName?: string;
	readonly properties?: Readonly<Record<string, unknown>>;
	readonly value?: string;
	readonly children?: readonly HastNodeShape[];
}

/** Recursively collects plain text from a hast subtree (inline code included). */
function collectText(node: HastNodeShape): string {
	if (node.type === "text") {
		return node.value ?? "";
	}
	if (node.type === "element") {
		return (node.children ?? []).map(collectText).join("");
	}
	return "";
}

/** Recursively finds the FIRST `<img>` element in a hast subtree, if any. */
function findFirstImage(node: HastNodeShape): HastNodeShape | undefined {
	if (node.type === "element" && node.tagName === "img") {
		return node;
	}
	for (const child of node.children ?? []) {
		const found = findFirstImage(child);
		if (found !== undefined) {
			return found;
		}
	}
	return undefined;
}

/** A table row split into its cells (hast `td`/`th` elements). */
function cellsOfRow(row: HastNodeShape): readonly HastNodeShape[] {
	return (row.children ?? []).filter((child): boolean => child.type === "element" && (child.tagName === "td" || child.tagName === "th"));
}

/** Reads a string property from a hast element via zod (rule 13 — no string sniffing). */
function propertyString(element: HastNodeShape | undefined, name: string): string {
	const raw = element?.properties?.[name];
	const parsed = z.string().safeParse(raw);
	return parsed.success ? parsed.data : "";
}

/** Extracts a gallery item from one `<tr>` — `null` when the row has no image. */
function extractRowItem(row: HastNodeShape): ImageGalleryItem | null {
	const cells = cellsOfRow(row);
	const imageCell = cells.find((cell) => findFirstImage(cell) !== undefined);
	if (imageCell === undefined) {
		return null;
	}

	const img = findFirstImage(imageCell);
	const src = propertyString(img, "src");
	if (src.length === 0) {
		return null;
	}
	const alt = propertyString(img, "alt");

	// The caption text is everything the row says OUTSIDE the image cell
	// (e.g. `**Email Verification** (green accent)`), normalized to one line.
	const labelText = cells
		.filter((cell) => cell !== imageCell)
		.map(collectText)
		.join(" ")
		.replace(/\s+/g, " ")
		.trim(); // Title = the alt text (most descriptive) or the label when no alt is set.
	const title = alt.length > 0 ? alt : labelText;
	// Description = the label with a LEADING title occurrence stripped (only
	// when it actually starts the label — a substring replace could mangle a
	// label where the title appears mid-text), then wrapping punctuation
	// (`(green accent)` → `green accent`) trimmed off.
	const description = (labelText.startsWith(title) ? labelText.slice(title.length) : labelText)
		.replace(/^[(:,\s]+/, "")
		.replace(/[)]+$/, "")
		.trim();

	return { title, description, src, alt };
}

/**
 * Walks a hast table collecting every BODY `tr` element (returns [] for
 * non-tables). Rows inside `<thead>` are deliberately skipped — the header
 * row (`| Template | Preview |`) has no image, so treating it as a gallery
 * row would abort detection. GFM wraps rows in `thead`/`tbody`; a bare `tr`
 * (no sections) is treated as a body row.
 */
function bodyRowsOfTable(node: HastNodeShape): readonly HastNodeShape[] {
	const rows: HastNodeShape[] = [];
	for (const child of node.children ?? []) {
		if (child.type !== "element") {
			continue;
		}
		if (child.tagName === "tbody") {
			rows.push(...bodyRowsOfTable(child));
		} else if (child.tagName === "tr") {
			// Bare rows only count when NOT inside a `<thead>` — `thead` is
			// handled by the loop below (it contributes nothing).
			rows.push(child);
		}
	}
	return rows;
}

/**
 * Detects an image-gallery table and returns its items. Returns an EMPTY list
 * when the table is not a gallery (no rows, no images, or a mixed shape) — the
 * renderer then falls back to the regular `DocsTable`.
 */
export function extractImageGalleryItems(node: HastNodeShape | undefined): readonly ImageGalleryItem[] {
	if (node?.type !== "element" || node.tagName !== "table") {
		return [];
	}

	const rows = bodyRowsOfTable(node);
	if (rows.length === 0) {
		return [];
	}

	const items: ImageGalleryItem[] = [];
	for (const row of rows) {
		const item = extractRowItem(row);
		if (item === null) {
			// A single image-less row means this is a data table, not a gallery.
			return [];
		}
		items.push(item);
	}
	return items;
}
