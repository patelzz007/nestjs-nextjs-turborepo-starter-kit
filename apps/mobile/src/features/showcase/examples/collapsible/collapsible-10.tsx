import DownloadIcon from "lucide-react-native/icons/download";
import FileCodeIcon from "lucide-react-native/icons/file-code";
import FolderIcon from "lucide-react-native/icons/folder";
import Trash2Icon from "lucide-react-native/icons/trash-2";
import { CascaderPanel } from "@workspace/ui-native/components/cascader";
import { Icon } from "@workspace/ui-native/components/icon";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui-native/components/tabs";
import type { CascaderNode } from "@workspace/ui-native/lib/cascader";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

const FOLDER = <Icon icon={FolderIcon} size="sm" colorClassName="accent-muted-foreground" />;
const FILE = <Icon icon={FileCodeIcon} size="sm" colorClassName="accent-muted-foreground" />;

const FILES: readonly CascaderNode[] = [
	{
		value: "src",
		label: "src",
		icon: FOLDER,
		children: [
			{ value: "src/app.tsx", label: "app.tsx", icon: FILE },
			{ value: "src/routes.ts", label: "routes.ts", icon: FILE },
		],
	},
	{ value: "package.json", label: "package.json", icon: FILE },
];

/** The picked file's actions, at the end of its row. */
function FileActions(node: CascaderNode): React.ReactNode {
	return node.children === undefined ? (
		<View className="flex-row">
			<IconButton icon={DownloadIcon} label={`Download ${node.label}`} variant="ghost" size="xs" onPress={ignorePress} />
			<IconButton icon={Trash2Icon} label={`Delete ${node.label}`} variant="ghost" size="xs" onPress={ignorePress} />
		</View>
	) : null;
}

const OUTLINE = "Open a file to see its outline.";

export function Collapsible10Example(): React.JSX.Element {
	const [tab, setTab] = React.useState("explorer");
	const [value, setValue] = React.useState<string | null>("src/app.tsx");
	return (
		<Tabs value={tab} onChange={setTab} variant="line">
			<TabsList>
				<TabsTrigger value="explorer" label="Explorer" />
				<TabsTrigger value="outline" label="Outline" />
			</TabsList>
			<TabsContent value="explorer">
				<CascaderPanel items={FILES} value={value} onChange={setValue} mode="tree" searchable={false} listSize="sm" renderTrailing={FileActions} />
			</TabsContent>
			<TabsContent value="outline">
				<Text className="text-body font-sans text-muted-foreground">{OUTLINE}</Text>
			</TabsContent>
		</Tabs>
	);
}
