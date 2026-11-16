import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";

export function TabsDo2Example(): React.JSX.Element {
	return (
		<Tabs defaultValue="preview" className="w-full max-w-xs">
			<TabsList>
				<TabsTrigger value="preview">Preview</TabsTrigger>
				<TabsTrigger value="code">Code</TabsTrigger>
			</TabsList>
			<TabsContent value="preview" className="text-sm text-muted-foreground">
				Preview for this project.
			</TabsContent>
			<TabsContent value="code" className="text-sm text-muted-foreground">
				Code for this project.
			</TabsContent>
		</Tabs>
	);
}
