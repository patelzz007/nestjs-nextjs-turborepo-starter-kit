// How far the page header reaches down from the top of the screen (status bar,
// the header's row and the fade under it), or `null` where no header is laid over the screens.
// The header belongs to the app shell — rendered once, never re-mounted as
// screens change — so each screen learns from here to start its content below
// it (and to leave its title to it).

import * as React from "react";

const PageHeaderClearanceContext = React.createContext<number | null>(null);

export const PageHeaderClearanceProvider = PageHeaderClearanceContext.Provider;

/** The header's height in points while one is laid over the screen, otherwise `null`. */
export function usePageHeaderClearance(): number | null {
	return React.use(PageHeaderClearanceContext);
}
