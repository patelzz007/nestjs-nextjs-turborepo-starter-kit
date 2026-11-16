import BracesIcon from "lucide-react-native/icons/braces";
import FileCodeIcon from "lucide-react-native/icons/file-code";
import FileTextIcon from "lucide-react-native/icons/file-text";
import FolderIcon from "lucide-react-native/icons/folder";
import FolderOpenIcon from "lucide-react-native/icons/folder-open";
import PaletteIcon from "lucide-react-native/icons/palette";
import { Tree, type TreeNode } from "@workspace/ui-native/components/tree";
import * as React from "react";

const ITEMS: readonly TreeNode[] = [
	{
		value: "app",
		label: "app",
		icon: FolderIcon,
		openIcon: FolderOpenIcon,
		iconColorClassName: "accent-tone-yellow",
		children: [
			{ value: "app/page.tsx", label: "page.tsx", icon: FileCodeIcon, iconColorClassName: "accent-tone-blue" },
			{ value: "app/globals.css", label: "globals.css", icon: PaletteIcon, iconColorClassName: "accent-tone-violet" },
			{ value: "app/data.json", label: "data.json", icon: BracesIcon, iconColorClassName: "accent-tone-yellow" },
		],
	},
	{ value: "readme", label: "README.md", icon: FileTextIcon },
];
const OPEN: readonly string[] = ["app"];

export function Tree5Example(): React.JSX.Element {
	const [selected, setSelected] = React.useState<string | null>(null);
	return <Tree items={ITEMS} defaultExpanded={OPEN} selected={selected} onSelect={setSelected} guides />;
}
