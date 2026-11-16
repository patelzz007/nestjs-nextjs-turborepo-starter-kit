import { Avatar } from "@workspace/ui-native/components/avatar";
import { Badge, type BadgeTone, type BadgeVariant } from "@workspace/ui-native/components/badge";
import { Icon, type LucideIcon } from "@workspace/ui-native/components/icon";
import { Table, type TableColumn, type TableRow } from "@workspace/ui-native/components/table";
import FileSpreadsheetIcon from "lucide-react-native/icons/file-spreadsheet";
import FileTextIcon from "lucide-react-native/icons/file-text";
import FolderIcon from "lucide-react-native/icons/folder";
import ImageIcon from "lucide-react-native/icons/image";
import PenToolIcon from "lucide-react-native/icons/pen-tool";
import * as React from "react";
import { Text, View } from "react-native";

import { PORTRAITS } from "./table-sample";

type Column = "name" | "owner" | "sharing" | "size" | "modified";

interface SharedFile {
	readonly name: string;
	readonly icon: LucideIcon;
	readonly size: string;
	readonly owner: string;
	readonly sharing: string;
	readonly tone: BadgeTone;
	readonly variant: BadgeVariant;
	readonly modified: string;
}

const FILES: readonly SharedFile[] = [
	{ name: "Q4 Financial Report.pdf", icon: FileTextIcon, size: "2.4 MB", owner: "Sarah Chen", sharing: "Team", tone: "info", variant: "light", modified: "2 hours ago" },
	{ name: "Brand Guidelines", icon: FolderIcon, size: "—", owner: "Emily Park", sharing: "Public", tone: "success", variant: "light", modified: "1 day ago" },
	{
		name: "Product Roadmap 2025.xlsx",
		icon: FileSpreadsheetIcon,
		size: "856 KB",
		owner: "Marcus Johnson",
		sharing: "Private",
		tone: "neutral",
		variant: "outline",
		modified: "3 days ago",
	},
	{ name: "App Screenshots", icon: ImageIcon, size: "48.2 MB", owner: "David Kim", sharing: "Team", tone: "info", variant: "light", modified: "1 week ago" },
	{
		name: "Architecture Diagram.fig",
		icon: PenToolIcon,
		size: "12.8 MB",
		owner: "Sofia Davis",
		sharing: "Restricted",
		tone: "warning",
		variant: "light",
		modified: "2 weeks ago",
	},
];

const COLUMNS: readonly TableColumn<Column>[] = [
	{ key: "name", label: "Name" },
	{ key: "owner", label: "Owner", width: "lg" },
	{ key: "sharing", label: "Sharing" },
	{ key: "size", label: "Size", align: "end" },
	{ key: "modified", label: "Modified", align: "end", width: "md" },
];

const ROWS: readonly TableRow<Column>[] = FILES.map((file: SharedFile): TableRow<Column> => ({
	key: file.name,
	cells: { name: file.name, owner: file.owner, sharing: file.sharing, size: file.size, modified: file.modified },
	content: {
		name: (
			<View className="flex-row items-center gap-2">
				<Icon icon={file.icon} size="sm" colorClassName="accent-muted-foreground" />
				<Text numberOfLines={1} className="text-label font-sans-medium shrink text-foreground">
					{file.name}
				</Text>
			</View>
		),
		owner: (
			<View className="flex-row items-center gap-2">
				<Avatar name={file.owner} imageUrl={PORTRAITS[file.owner] ?? null} size="sm" />
				<Text numberOfLines={1} className="text-label shrink font-sans text-foreground">
					{file.owner}
				</Text>
			</View>
		),
		sharing: <Badge label={file.sharing} tone={file.tone} variant={file.variant} size="sm" />,
	},
}));

export function Table13Example(): React.JSX.Element {
	return <Table caption="Files" columns={COLUMNS} rows={ROWS} scrollable />;
}
