import DatabaseIcon from "lucide-react-native/icons/database";
import DownloadIcon from "lucide-react-native/icons/download";
import FileSpreadsheetIcon from "lucide-react-native/icons/file-spreadsheet";
import GitBranchIcon from "lucide-react-native/icons/git-branch";
import MailIcon from "lucide-react-native/icons/mail";
import MessageSquareIcon from "lucide-react-native/icons/message-square";
import ServerIcon from "lucide-react-native/icons/server";
import TableIcon from "lucide-react-native/icons/table";
import { Cascader } from "@workspace/ui-native/components/cascader";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import type { CascaderNode } from "@workspace/ui-native/lib/cascader";
import * as React from "react";
import { Text, View } from "react-native";

const PROPERTIES: readonly CascaderNode[] = [
	{
		value: "contact",
		label: "Contact",
		children: [
			{ value: "contact.email", label: "Email" },
			{ value: "contact.phone", label: "Phone" },
		],
	},
	{
		value: "deal",
		label: "Deal",
		children: [
			{ value: "deal.amount", label: "Amount" },
			{ value: "deal.stage", label: "Stage" },
		],
	},
];

const SOURCES: readonly DropdownMenuItemData<string>[] = [
	{ value: "github", label: "GitHub", icon: GitBranchIcon, group: "Apps" },
	{ value: "slack", label: "Slack", icon: MessageSquareIcon, group: "Apps" },
	{ value: "gmail", label: "Gmail", icon: MailIcon, group: "Apps" },
	{ value: "postgres", label: "PostgreSQL", icon: DatabaseIcon, group: "Data sources" },
	{ value: "mysql", label: "MySQL", icon: ServerIcon, group: "Data sources" },
	{ value: "sheets", label: "Google Sheets", icon: FileSpreadsheetIcon, group: "Data sources" },
	{ value: "airtable", label: "Airtable", icon: TableIcon, group: "Data sources" },
];

export function Cascader4Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	const [imported, setImported] = React.useState<string | null>(null);
	const footer = <DropdownMenu label="Import from…" icon={DownloadIcon} items={SOURCES} onSelect={setImported} variant="outline" />;
	return (
		<View className="gap-2">
			<Cascader label="Property" items={PROPERTIES} value={value} onChange={setValue} placeholder="Pick a property" footer={footer} />
			<Text className="text-body font-sans text-muted-foreground">{imported === null ? "Nothing imported." : `Importing from ${imported}.`}</Text>
		</View>
	);
}
