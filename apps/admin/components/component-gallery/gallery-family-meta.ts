import type { IconTileTone } from "@workspace/ui/components/icon-tile";
import { BellRing, Images, Layers, ListChecks, type LucideIcon, MousePointerClick, PanelsTopLeft, Table2, TextCursorInput } from "lucide-react";

import type { GalleryFamilyId } from "@/components/component-gallery/gallery-catalog";

/** How the gallery presents one family: its icon, its tile tone and a one-line summary. */
export interface GalleryFamilyMeta {
	readonly icon: LucideIcon;
	readonly tone: IconTileTone;
	readonly summary: string;
}

/** A `Record`, so a new family without its presentation fails to compile. */
export const GALLERY_FAMILY_META: Readonly<Record<GalleryFamilyId, GalleryFamilyMeta>> = {
	"family-actions": { icon: MousePointerClick, tone: "blue", summary: "Buttons, toggles and the pressed-state controls built on them." },
	"family-form-inputs": { icon: TextCursorInput, tone: "violet", summary: "Text entry, field layout and the inputs a form is made of." },
	"family-selection": { icon: ListChecks, tone: "green", summary: "Choosing values: checkboxes, selects, sliders, dates and pickers." },
	"family-overlays": { icon: Layers, tone: "orange", summary: "Dialogs, sheets, popovers, menus and the command palette." },
	"family-disclosure-navigation": { icon: PanelsTopLeft, tone: "teal", summary: "Showing, hiding and moving between content: tabs, steps, trees." },
	"family-feedback-status": { icon: BellRing, tone: "yellow", summary: "Alerts, toasts, progress, loading and status at a glance." },
	"family-data-display": { icon: Table2, tone: "brand", summary: "Cards, tables, grids, charts and calendars for real data." },
	"family-media-content": { icon: Images, tone: "red", summary: "Avatars, images, carousels, messages and code." },
};
