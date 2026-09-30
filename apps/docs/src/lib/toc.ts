/** A rendered heading, as Astro's `render()` returns it. */
export interface HeadingLike {
	readonly depth: number;
	readonly slug: string;
	readonly text: string;
}

export interface TocItem {
	readonly slug: string;
	readonly text: string;
	readonly depth: 2 | 3;
}

/** Headings removed from the rendered text (the "#" permalink appended by the anchor plugin). */
function cleanHeadingText(text: string): string {
	return text.replace(/#$/, "").trim();
}

/** In-page "Table of Contents" headings — redundant next to the "On this page" rail. */
const CONTENTS_HEADING = /^(?:table of )?contents$/i;

/** "On this page" entries: h2 and h3 only, in document order, skipping in-page "Table of Contents" headings. */
export function buildToc(headings: readonly HeadingLike[]): readonly TocItem[] {
	const items: TocItem[] = [];
	for (const heading of headings) {
		const text = cleanHeadingText(heading.text);
		if ((heading.depth === 2 || heading.depth === 3) && !CONTENTS_HEADING.test(text)) {
			items.push({ slug: heading.slug, text, depth: heading.depth });
		}
	}
	return items;
}

/** The first `limit` h2 headings — the quick links on landing-page cards. */
export function topSections(headings: readonly HeadingLike[], limit: number): readonly TocItem[] {
	return buildToc(headings)
		.filter((item) => item.depth === 2)
		.slice(0, limit);
}

/** One "On this page" entry with the h3s that follow it (the rail's nested groups). */
export interface TocGroup {
	readonly item: TocItem;
	readonly children: readonly TocItem[];
}

/** Nests every h3 under the h2 before it; an h3 before the first h2 stands alone. */
export function groupToc(items: readonly TocItem[]): readonly TocGroup[] {
	const groups: { item: TocItem; children: TocItem[] }[] = [];
	for (const item of items) {
		const last = groups.at(-1);
		if (item.depth === 3 && last?.item.depth === 2) {
			last.children.push(item);
		} else {
			groups.push({ item, children: [] });
		}
	}
	return groups;
}
