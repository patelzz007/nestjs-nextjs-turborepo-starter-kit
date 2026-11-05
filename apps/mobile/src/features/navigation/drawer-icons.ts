// The glyphs mobile-drawer-items.json may name, by their Lucide names (the web menus' `icon`
// convention): the JSON stays plain text, and a name the app does not bundle fails when the menu loads.

import BellIcon from "lucide-react-native/icons/bell";
import BlocksIcon from "lucide-react-native/icons/blocks";
import ChartColumnIcon from "lucide-react-native/icons/chart-column";
import FileTextIcon from "lucide-react-native/icons/file-text";
import GitPullRequestIcon from "lucide-react-native/icons/git-pull-request";
import HouseIcon from "lucide-react-native/icons/house";
import KeyRoundIcon from "lucide-react-native/icons/key-round";
import LanguagesIcon from "lucide-react-native/icons/languages";
import LockKeyholeIcon from "lucide-react-native/icons/lock-keyhole";
import PaletteIcon from "lucide-react-native/icons/palette";
import ScanQrCodeIcon from "lucide-react-native/icons/scan-qr-code";
import SearchIcon from "lucide-react-native/icons/search";
import ServerIcon from "lucide-react-native/icons/server";
import SettingsIcon from "lucide-react-native/icons/settings";
import ShieldCheckIcon from "lucide-react-native/icons/shield-check";
import SmartphoneIcon from "lucide-react-native/icons/smartphone";
import UserIcon from "lucide-react-native/icons/user";
import { z } from "zod";

import type { LucideIcon } from "@workspace/ui-native/components/icon";

export const DrawerIconNameSchema = z.enum([
	"Bell",
	"Blocks",
	"ChartColumn",
	"FileText",
	"GitPullRequest",
	"House",
	"KeyRound",
	"Languages",
	"LockKeyhole",
	"Palette",
	"ScanQrCode",
	"Search",
	"Server",
	"Settings",
	"ShieldCheck",
	"Smartphone",
	"User",
]);

export type DrawerIconName = z.output<typeof DrawerIconNameSchema>;

export const DRAWER_ICONS: Readonly<Record<DrawerIconName, LucideIcon>> = {
	Bell: BellIcon,
	Blocks: BlocksIcon,
	ChartColumn: ChartColumnIcon,
	FileText: FileTextIcon,
	GitPullRequest: GitPullRequestIcon,
	House: HouseIcon,
	KeyRound: KeyRoundIcon,
	Languages: LanguagesIcon,
	LockKeyhole: LockKeyholeIcon,
	Palette: PaletteIcon,
	ScanQrCode: ScanQrCodeIcon,
	Search: SearchIcon,
	Server: ServerIcon,
	Settings: SettingsIcon,
	ShieldCheck: ShieldCheckIcon,
	Smartphone: SmartphoneIcon,
	User: UserIcon,
};
