import BellRingIcon from "lucide-react-native/icons/bell-ring";
import ImagesIcon from "lucide-react-native/icons/images";
import LayersIcon from "lucide-react-native/icons/layers";
import ListChecksIcon from "lucide-react-native/icons/list-checks";
import MousePointerClickIcon from "lucide-react-native/icons/mouse-pointer-click";
import PanelsTopLeftIcon from "lucide-react-native/icons/panels-top-left";
import Table2Icon from "lucide-react-native/icons/table-2";
import TextCursorInputIcon from "lucide-react-native/icons/text-cursor-input";

import type { LucideIcon } from "@workspace/ui-native/components/icon";
import type { IconTileTone } from "@workspace/ui-native/components/icon-tile";

import type { ShowcaseFamilyId } from "./showcase-catalog";

/** How the showcase presents one family: its icon, its tile tone and a one-line summary (the web's, word for word). */
export interface ShowcaseFamilyMeta {
	readonly icon: LucideIcon;
	readonly tone: IconTileTone;
	readonly summary: string;
}

/** A `Record`, so a new family without its presentation fails to compile. */
export const SHOWCASE_FAMILY_META: Readonly<Record<ShowcaseFamilyId, ShowcaseFamilyMeta>> = {
	"family-actions": { icon: MousePointerClickIcon, tone: "blue", summary: "Buttons, toggles and the pressed-state controls built on them." },
	"family-form-inputs": { icon: TextCursorInputIcon, tone: "violet", summary: "Text entry, field layout and the inputs a form is made of." },
	"family-selection": { icon: ListChecksIcon, tone: "green", summary: "Choosing values: checkboxes, selects, sliders, dates and pickers." },
	"family-overlays": { icon: LayersIcon, tone: "orange", summary: "Dialogs, sheets, popovers, menus and the command palette." },
	"family-disclosure-navigation": { icon: PanelsTopLeftIcon, tone: "teal", summary: "Showing, hiding and moving between content: tabs, steps, trees." },
	"family-feedback-status": { icon: BellRingIcon, tone: "yellow", summary: "Alerts, toasts, progress, loading and status at a glance." },
	"family-data-display": { icon: Table2Icon, tone: "brand", summary: "Cards, tables, grids, charts and calendars for real data." },
	"family-media-content": { icon: ImagesIcon, tone: "red", summary: "Avatars, images, carousels, messages and code." },
};
