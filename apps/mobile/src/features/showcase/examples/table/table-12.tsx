import { Badge, type BadgeTone, type BadgeVariant } from "@workspace/ui-native/components/badge";
import { Card } from "@workspace/ui-native/components/card";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { Table, type TableColumn, type TableRow } from "@workspace/ui-native/components/table";
import Trash2Icon from "lucide-react-native/icons/trash-2";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

type Column = "name" | "key" | "permissions" | "status" | "actions";

interface ApiKey {
	readonly name: string;
	readonly token: string;
	readonly permissions: readonly string[];
	readonly lastUsed: string;
	readonly status: string;
	readonly tone: BadgeTone;
}

const API_KEYS: readonly ApiKey[] = [
	{ name: "Production API", token: "sk_live_••••4f3a", permissions: ["read", "write"], lastUsed: "2 minutes ago", status: "Active", tone: "success" },
	{ name: "Staging API", token: "sk_test_••••8b2c", permissions: ["read", "write", "admin"], lastUsed: "1 hour ago", status: "Active", tone: "success" },
	{ name: "CI/CD Pipeline", token: "sk_ci_••••1d9e", permissions: ["read"], lastUsed: "3 days ago", status: "Active", tone: "success" },
	{ name: "Legacy Integration", token: "sk_old_••••7a5f", permissions: ["read", "write"], lastUsed: "30 days ago", status: "Expired", tone: "destructive" },
];

const PERMISSION_LOOK: Readonly<Record<string, { readonly tone: BadgeTone; readonly variant: BadgeVariant }>> = {
	read: { tone: "neutral", variant: "outline" },
	write: { tone: "info", variant: "light" },
	admin: { tone: "warning", variant: "light" },
};
const DEFAULT_LOOK = { tone: "neutral", variant: "outline" } satisfies { readonly tone: BadgeTone; readonly variant: BadgeVariant };

const COLUMNS: readonly TableColumn<Column>[] = [
	{ key: "name", label: "Name" },
	{ key: "key", label: "Key", width: "lg" },
	{ key: "permissions", label: "Permissions", width: "lg" },
	{ key: "status", label: "Status" },
	{ key: "actions", label: "Actions", align: "end", width: "xs" },
];

const ROWS: readonly TableRow<Column>[] = API_KEYS.map((key: ApiKey): TableRow<Column> => ({
	key: key.name,
	cells: { name: `${key.name}, last used ${key.lastUsed}`, key: key.token, permissions: key.permissions.join(", "), status: key.status, actions: "" },
	interactive: true,
	content: {
		name: (
			<View>
				<Text numberOfLines={1} className="text-label font-sans-medium text-foreground">
					{key.name}
				</Text>
				<Text className="text-caption font-sans text-muted-foreground">{`Last used: ${key.lastUsed}`}</Text>
			</View>
		),
		key: (
			<View className="self-start rounded bg-muted px-1.5 py-0.5">
				<Text className="text-caption font-code text-foreground">{key.token}</Text>
			</View>
		),
		permissions: (
			<View className="flex-row flex-wrap gap-1">
				{key.permissions.map((permission: string): React.JSX.Element => (
					<Badge
						key={permission}
						label={permission}
						tone={(PERMISSION_LOOK[permission] ?? DEFAULT_LOOK).tone}
						variant={(PERMISSION_LOOK[permission] ?? DEFAULT_LOOK).variant}
						size="sm"
					/>
				))}
			</View>
		),
		status: <Badge label={key.status} tone={key.tone} variant="light" size="sm" />,
		actions: <IconButton icon={Trash2Icon} label={`Revoke ${key.name}`} variant="ghost" size="sm" onPress={ignorePress} className="self-end" />,
	},
}));

export function Table12Example(): React.JSX.Element {
	return (
		<Card className="p-2">
			<Table caption="API keys" columns={COLUMNS} rows={ROWS} variant="plain" scrollable />
		</Card>
	);
}
