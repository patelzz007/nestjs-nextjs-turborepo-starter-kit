import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";

export function TabsDont2Example(): React.JSX.Element {
	return (
		<Tabs defaultValue="details" className="w-full max-w-xs">
			<TabsList>
				<TabsTrigger value="details">1. Details</TabsTrigger>
				<TabsTrigger value="payment">2. Payment</TabsTrigger>
				<TabsTrigger value="confirm">3. Confirm</TabsTrigger>
			</TabsList>
			<TabsContent value="details" className="text-sm text-muted-foreground">
				1. Details for this project.
			</TabsContent>
			<TabsContent value="payment" className="text-sm text-muted-foreground">
				2. Payment for this project.
			</TabsContent>
			<TabsContent value="confirm" className="text-sm text-muted-foreground">
				3. Confirm for this project.
			</TabsContent>
		</Tabs>
	);
}
