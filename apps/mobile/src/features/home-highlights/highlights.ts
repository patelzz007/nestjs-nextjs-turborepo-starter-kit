// What the Home screen's "Discover" carousel points to: one card per part of the app worth a first
// look, in the order they are shown. Each card opens its screen the way the drawer does (a tab is
// switched to, any other screen is pushed onto its tab's stack). Products replace these with their own.

import ChartColumnIcon from "lucide-react-native/icons/chart-column";
import FileTextIcon from "lucide-react-native/icons/file-text";
import LockIcon from "lucide-react-native/icons/lock";
import PaletteIcon from "lucide-react-native/icons/palette";

import type { LucideIcon } from "@workspace/ui-native/components/icon";
import type { IconTileTone } from "@workspace/ui-native/components/icon-tile";
import { ROUTES, type AppRoute } from "../../runtime/routes";

export interface HomeHighlight {
	/** Stable identity (the slide's key). */
	readonly key: string;
	readonly icon: LucideIcon;
	readonly tone: IconTileTone;
	readonly title: string;
	readonly body: string;
	/** The card's button. */
	readonly action: string;
	readonly route: AppRoute;
	/** A tab is switched to; any other screen is pushed onto its tab's stack. */
	readonly isTab: boolean;
}

export const HOME_HIGHLIGHTS: readonly HomeHighlight[] = [
	{
		key: "analytics",
		icon: ChartColumnIcon,
		tone: "blue",
		title: "See your activity",
		body: "Spending, visits and rewards over the last week, month or quarter.",
		action: "Open analytics",
		route: ROUTES.analytics,
		isTab: true,
	},
	{
		key: "app-lock",
		icon: LockIcon,
		tone: "green",
		title: "Lock the app",
		body: "Ask for your face, fingerprint or passcode whenever you come back to the app.",
		action: "Set up app lock",
		route: ROUTES.appLock,
		isTab: false,
	},
	{
		key: "pdf-viewer",
		icon: FileTextIcon,
		tone: "orange",
		title: "Read a PDF",
		body: "Open a document from your phone and read it page by page, right here.",
		action: "Open a PDF",
		route: ROUTES.pdfViewer,
		isTab: false,
	},
	{
		key: "appearance",
		icon: PaletteIcon,
		tone: "teal",
		title: "Make it yours",
		body: "Light, dark or Nord: pick the look that suits you, or follow your phone.",
		action: "Choose a theme",
		route: ROUTES.appearance,
		isTab: false,
	},
];
