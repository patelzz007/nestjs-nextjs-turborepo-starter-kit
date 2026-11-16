import { Badge, type BadgeTone } from "@workspace/ui-native/components/badge";
import { Button } from "@workspace/ui-native/components/button";
import { Icon, type LucideIcon } from "@workspace/ui-native/components/icon";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@workspace/ui-native/components/item";
import FileSpreadsheetIcon from "lucide-react-native/icons/file-spreadsheet";
import FileTextIcon from "lucide-react-native/icons/file-text";
import ImageIcon from "lucide-react-native/icons/image";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

interface FileRow {
	readonly icon: LucideIcon;
	readonly name: string;
	readonly detail: string;
	readonly status: string;
	readonly tone: BadgeTone;
}

const FILES: readonly FileRow[] = [
	{ icon: FileTextIcon, name: "Quarterly Report.pdf", detail: "2.4 MB · Updated 2 hours ago", status: "Final", tone: "success" },
	{ icon: FileSpreadsheetIcon, name: "Budget 2025.xlsx", detail: "856 KB · Updated yesterday", status: "Draft", tone: "warning" },
	{ icon: ImageIcon, name: "Hero Banner.png", detail: "4.1 MB · Updated 3 days ago", status: "Review", tone: "info" },
];

export function Item6Example(): React.JSX.Element {
	return (
		<View className="gap-2">
			{FILES.map((file: FileRow): React.JSX.Element => (
				<Item key={file.name} variant="outline" size="xs">
					<ItemMedia variant="icon">
						<Icon icon={file.icon} size="sm" colorClassName="accent-foreground" />
					</ItemMedia>
					<ItemContent>
						<ItemTitle>{file.name}</ItemTitle>
						<ItemDescription>{file.detail}</ItemDescription>
					</ItemContent>
					<ItemActions>
						<Badge label={file.status} tone={file.tone} variant="light" size="sm" />
						<Button label="Open" variant="outline" size="sm" onPress={ignorePress} />
					</ItemActions>
				</Item>
			))}
		</View>
	);
}
