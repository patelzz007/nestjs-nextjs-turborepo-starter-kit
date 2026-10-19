// The pages of a "Load more" list (docs/technical/api/list-queries.md): each page on screen is one
// cached read keyed by its keyset cursor — the first page has none — and "Load more" appends the
// cursor the last page answered with.

import * as React from "react";

/** The first page has no cursor. */
const FIRST_PAGE: readonly (string | undefined)[] = [undefined];

export interface CursorPages {
	/** The cursor of each page on screen, in order (`undefined` for the first). */
	readonly cursors: readonly (string | undefined)[];
	/** Appends the page that starts at `cursor`; a cursor already on screen is not added twice. */
	readonly loadMore: (cursor: string) => void;
	/** Back to the first page only (a filter change, a pull to refresh). */
	readonly reset: () => void;
}

export function useCursorPages(): CursorPages {
	const [cursors, setCursors] = React.useState<readonly (string | undefined)[]>(FIRST_PAGE);
	const loadMore = React.useCallback((cursor: string): void => {
		setCursors((current: readonly (string | undefined)[]): readonly (string | undefined)[] => (current.includes(cursor) ? current : [...current, cursor]));
	}, []);
	const reset = React.useCallback((): void => {
		setCursors(FIRST_PAGE);
	}, []);
	return { cursors, loadMore, reset };
}
