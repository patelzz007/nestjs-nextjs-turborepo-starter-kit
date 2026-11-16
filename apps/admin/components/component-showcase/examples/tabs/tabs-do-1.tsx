import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";

export function TabsDo1Example(): React.JSX.Element {
	return (
		<Tabs defaultValue="overview" className="w-full max-w-xs">
			<TabsList>
				<TabsTrigger value="overview">Overview</TabsTrigger>
				<TabsTrigger value="activity">Activity</TabsTrigger>
				<TabsTrigger value="settings">Settings</TabsTrigger>
			</TabsList>
			<TabsContent value="overview" className="text-sm text-muted-foreground">
				Overview for this project.
			</TabsContent>
			<TabsContent value="activity" className="text-sm text-muted-foreground">
				Activity for this project.
			</TabsContent>
			<TabsContent value="settings" className="text-sm text-muted-foreground">
				Settings for this project.
			</TabsContent>
		</Tabs>
	);
}
