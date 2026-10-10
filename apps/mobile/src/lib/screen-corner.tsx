// Whether a layout-level control sits in the screens' top-left corner (the
// app drawer's menu button, ADR 038). The control belongs to the layout — it
// is rendered once and never re-mounts as screens change — so each screen
// learns from here to move its title over and keep the corner clear.

import * as React from "react";

const ScreenCornerContext = React.createContext(false);

export const ScreenCornerProvider = ScreenCornerContext.Provider;

/** `true` while the top-left corner is taken: the screen's title sits beside it. */
export function useScreenCornerTaken(): boolean {
	return React.use(ScreenCornerContext);
}
