// Whether layout-level controls sit in the screens' top corners (the app
// drawer's menu button on the left, ADR 038; the status pills on the right).
// The controls belong to the layout — rendered once, never re-mounted as
// screens change — so each screen learns from here to keep its title clear of
// both corners.

import * as React from "react";

const ScreenCornerContext = React.createContext(false);

export const ScreenCornerProvider = ScreenCornerContext.Provider;

/** `true` while the top corners are taken: the screen's title sits between them. */
export function useScreenCornerTaken(): boolean {
	return React.use(ScreenCornerContext);
}
