import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui-native/components/tabs";
import * as React from "react";
import { Text } from "react-native";

const FOLDERS: readonly { readonly value: string; readonly label: string; readonly count?: string }[] = [
	{ value: "inbox", label: "Inbox", count: "12" },
	{ value: "drafts", label: "Drafts", count: "3" },
	{ value: "sent", label: "Sent" },
	{ value: "spam", label: "Spam", count: "28" },
];

export function Tabs7Example(): React.JSX.Element {
	const [tab, setTab] = React.useState("inbox");
	return (
		<Tabs value={tab} onChange={setTab} variant="line" size="sm">
			<TabsList accessibilityLabel="Mail folders">
				{FOLDERS.map((folder): React.JSX.Element => (
					<TabsTrigger key={folder.value} value={folder.value} label={folder.label} badge={folder.count} />
				))}
			</TabsList>
			{FOLDERS.map((folder): React.JSX.Element => (
				<TabsContent key={folder.value} value={folder.value}>
					<Text className="text-body font-sans text-muted-foreground">{`${folder.label}: ${folder.count ?? "no"} messages`}</Text>
				</TabsContent>
			))}
		</Tabs>
	);
}
