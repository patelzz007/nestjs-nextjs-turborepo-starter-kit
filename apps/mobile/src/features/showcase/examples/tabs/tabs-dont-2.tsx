import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui-native/components/tabs";
import * as React from "react";
import { Text } from "react-native";

const STEPS = "Fill in step 1 before step 2.";

export function TabsDont2Example(): React.JSX.Element {
	const [tab, setTab] = React.useState("one");
	return (
		<Tabs value={tab} onChange={setTab}>
			<TabsList>
				<TabsTrigger value="one" label="Step 1" />
				<TabsTrigger value="two" label="Step 2" />
			</TabsList>
			<TabsContent value={tab}>
				<Text className="text-body font-sans text-muted-foreground">{STEPS}</Text>
			</TabsContent>
		</Tabs>
	);
}
