import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui-native/components/tabs";
import * as React from "react";
import { Text } from "react-native";

const LABELS: readonly string[] = ["Overview", "Activity", "Members", "Billing", "Security", "Webhooks", "Logs"];

export function TabsDont1Example(): React.JSX.Element {
	const [tab, setTab] = React.useState("Overview");
	return (
		<Tabs value={tab} onChange={setTab} size="sm">
			<TabsList>
				{LABELS.map((label: string): React.JSX.Element => (
					<TabsTrigger key={label} value={label} label={label} />
				))}
			</TabsList>
			<TabsContent value={tab}>
				<Text className="text-body font-sans text-muted-foreground">{tab}</Text>
			</TabsContent>
		</Tabs>
	);
}
