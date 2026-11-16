import FileIcon from "lucide-react-native/icons/file";
import FolderIcon from "lucide-react-native/icons/folder";
import FolderOpenIcon from "lucide-react-native/icons/folder-open";
import { Tree, type TreeNode } from "@workspace/ui-native/components/tree";
import * as React from "react";

const ITEMS: readonly TreeNode[] = [
	{
		value: "src",
		label: "src",
		icon: FolderIcon,
		openIcon: FolderOpenIcon,
		children: [
			{
				value: "src/components",
				label: "components",
				icon: FolderIcon,
				openIcon: FolderOpenIcon,
				children: [{ value: "src/components/button.tsx", label: "button.tsx", icon: FileIcon }],
			},
			{ value: "src/app.tsx", label: "app.tsx", icon: FileIcon },
		],
	},
	{ value: "package.json", label: "package.json", icon: FileIcon },
];
const OPEN: readonly string[] = ["src"];

export function TreeDo1Example(): React.JSX.Element {
	const [selected, setSelected] = React.useState<string | null>(null);
	return <Tree items={ITEMS} defaultExpanded={OPEN} selected={selected} onSelect={setSelected} guides />;
}
