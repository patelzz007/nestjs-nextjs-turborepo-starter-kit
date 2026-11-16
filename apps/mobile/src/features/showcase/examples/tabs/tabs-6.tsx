import ChartLineIcon from "lucide-react-native/icons/chart-line";
import LayoutDashboardIcon from "lucide-react-native/icons/layout-dashboard";
import SettingsIcon from "lucide-react-native/icons/settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui-native/components/tabs";
import * as React from "react";
import { Text } from "react-native";

const OVERVIEW = "Your workspace at a glance.";
const ANALYTICS = "Traffic and conversions over time.";
const SETTINGS = "Workspace name, members and billing.";

export function Tabs6Example(): React.JSX.Element {
	const [tab, setTab] = React.useState("overview");
	return (
		<Tabs value={tab} onChange={setTab}>
			<TabsList>
				<TabsTrigger value="overview" label="Overview" icon={LayoutDashboardIcon} />
				<TabsTrigger value="analytics" label="Analytics" icon={ChartLineIcon} />
				<TabsTrigger value="settings" label="Settings" icon={SettingsIcon} />
			</TabsList>
			<TabsContent value="overview" className="rounded-card border border-border p-4">
				<Text className="text-body font-sans text-muted-foreground">{OVERVIEW}</Text>
			</TabsContent>
			<TabsContent value="analytics" className="rounded-card border border-border p-4">
				<Text className="text-body font-sans text-muted-foreground">{ANALYTICS}</Text>
			</TabsContent>
			<TabsContent value="settings" className="rounded-card border border-border p-4">
				<Text className="text-body font-sans text-muted-foreground">{SETTINGS}</Text>
			</TabsContent>
		</Tabs>
	);
}
