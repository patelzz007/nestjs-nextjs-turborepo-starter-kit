import * as React from "react";
import { FileTextIcon, FolderIcon, HomeIcon, SettingsIcon } from "lucide-react";

import { GuidelineRail, type GuidelineRailItem } from "@/components/component-showcase/examples/sidebar/sidebar-guideline-sample";

const ITEMS: readonly GuidelineRailItem[] = [
	{ label: "Home", icon: HomeIcon },
	{ label: "Projects", icon: FolderIcon },
	{ label: "Documents", icon: FileTextIcon },
	{ label: "Settings", icon: SettingsIcon },
];

export function SidebarDont2Example(): React.JSX.Element {
	return <GuidelineRail items={ITEMS} withTrigger={false} />;
}
