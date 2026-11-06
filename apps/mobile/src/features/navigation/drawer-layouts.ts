// The side drawer's looks (Settings → Appearance), each a combination of the same few parts, so the panel
// (app-drawer.tsx) is one layout and a new look is one more row here.
//
//   surface   ink: the sign-in panel's deep colour behind the person. wash: a soft glow fading into the page.
//   profile   row: avatar beside the name. stacked: a large name under the avatar. centred: all on the middle.
//   status    line: one line under the person. cards: two small cards under them.
//   sheet     the menu sits on a rounded sheet rising over the surface.
//   selected  solid: the current screen is a filled capsule, like the tab bar's. soft: a grey one in the dark themes, slate in light.
//   action    chevron or link: what says the person can be pressed; none: only the press.

import type { DrawerAction, DrawerProfileLayout, DrawerSelection } from "../../components/drawer-menu";
import type { DrawerStyle } from "../../lib/secure-store";

export type DrawerSurface = "ink" | "wash";

export type DrawerStatusStyle = "line" | "cards";

export interface DrawerLayout {
	readonly surface: DrawerSurface;
	readonly profile: DrawerProfileLayout;
	readonly status: DrawerStatusStyle;
	readonly sheet: boolean;
	readonly selected: DrawerSelection;
	readonly action: DrawerAction;
}

export const DRAWER_LAYOUTS: Readonly<Record<DrawerStyle, DrawerLayout>> = {
	"centred-ink": { surface: "ink", profile: "centred", status: "line", sheet: true, selected: "solid", action: "none" },
	"ink-cards": { surface: "ink", profile: "row", status: "cards", sheet: true, selected: "solid", action: "chevron" },
	"wash-sheet": { surface: "wash", profile: "stacked", status: "line", sheet: true, selected: "solid", action: "none" },
	"centred-wash": { surface: "wash", profile: "centred", status: "cards", sheet: false, selected: "soft", action: "link" },
	"wash-cards": { surface: "wash", profile: "row", status: "cards", sheet: false, selected: "solid", action: "chevron" },
};

/** The status cards sit across the sheet's top edge, half on the surface and half on the sheet. */
export function statusBridgesSheet(layout: DrawerLayout): boolean {
	return layout.sheet && layout.status === "cards";
}
