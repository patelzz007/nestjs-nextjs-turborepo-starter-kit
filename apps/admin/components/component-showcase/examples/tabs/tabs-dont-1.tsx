import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";

export function TabsDont1Example(): React.JSX.Element {
	return (
		<Tabs defaultValue="overview" className="w-full max-w-xs">
			<TabsList className="max-w-full overflow-hidden">
				<TabsTrigger value="overview">Overview</TabsTrigger>
				<TabsTrigger value="activity">Activity</TabsTrigger>
				<TabsTrigger value="members">Members</TabsTrigger>
				<TabsTrigger value="invoices">Invoices</TabsTrigger>
				<TabsTrigger value="integrations">Integrations</TabsTrigger>
				<TabsTrigger value="webhooks">Webhooks</TabsTrigger>
				<TabsTrigger value="settings">Settings</TabsTrigger>
			</TabsList>
			<TabsContent value="overview" className="text-sm text-muted-foreground">
				Overview for this project.
			</TabsContent>
			<TabsContent value="activity" className="text-sm text-muted-foreground">
				Activity for this project.
			</TabsContent>
			<TabsContent value="members" className="text-sm text-muted-foreground">
				Members for this project.
			</TabsContent>
			<TabsContent value="invoices" className="text-sm text-muted-foreground">
				Invoices for this project.
			</TabsContent>
			<TabsContent value="integrations" className="text-sm text-muted-foreground">
				Integrations for this project.
			</TabsContent>
			<TabsContent value="webhooks" className="text-sm text-muted-foreground">
				Webhooks for this project.
			</TabsContent>
			<TabsContent value="settings" className="text-sm text-muted-foreground">
				Settings for this project.
			</TabsContent>
		</Tabs>
	);
}
