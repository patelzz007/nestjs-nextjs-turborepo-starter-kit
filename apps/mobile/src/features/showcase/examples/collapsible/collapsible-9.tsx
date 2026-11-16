import FileTextIcon from "lucide-react-native/icons/file-text";
import FolderIcon from "lucide-react-native/icons/folder";
import SettingsIcon from "lucide-react-native/icons/settings";
import { CascaderPanel } from "@workspace/ui-native/components/cascader";
import { Icon } from "@workspace/ui-native/components/icon";
import type { CascaderNode } from "@workspace/ui-native/lib/cascader";
import * as React from "react";

const FOLDER = <Icon icon={FolderIcon} size="sm" colorClassName="accent-muted-foreground" />;
const PAGE = <Icon icon={FileTextIcon} size="sm" colorClassName="accent-muted-foreground" />;
const GEAR = <Icon icon={SettingsIcon} size="sm" colorClassName="accent-muted-foreground" />;

const MENU: readonly CascaderNode[] = [
	{
		value: "docs",
		label: "Documents",
		icon: FOLDER,
		children: [
			{
				value: "docs/reports",
				label: "Reports",
				icon: FOLDER,
				children: [
					{ value: "docs/reports/q3", label: "Q3 report", icon: PAGE },
					{ value: "docs/reports/q4", label: "Q4 report", icon: PAGE },
				],
			},
			{ value: "docs/notes", label: "Notes", icon: PAGE },
		],
	},
	{ value: "settings", label: "Settings", icon: GEAR, children: [{ value: "settings/profile", label: "Profile", icon: PAGE }] },
];

export function Collapsible9Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("docs/reports/q3");
	return <CascaderPanel items={MENU} value={value} onChange={setValue} mode="tree" searchable={false} listSize="sm" />;
}
