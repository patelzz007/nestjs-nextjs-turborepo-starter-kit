import { Avatar } from "@workspace/ui-native/components/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui-native/components/collapsible";
import * as React from "react";
import { Text, View } from "react-native";

export function Collapsible8Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	return (
		<Collapsible open={open} onOpenChange={setOpen} variant="card">
			<CollapsibleTrigger label="@avapatel" description="Ava Patel" leading={<Avatar name="Ava Patel" imageUrl={null} size="md" />} />
			<CollapsibleContent className="gap-1">
				<Text className="text-body font-sans text-foreground">Last active: 5 minutes ago</Text>
				<Text className="text-body font-sans text-muted-foreground">Online since 08:12</Text>
				<View className="flex-row items-center gap-1.5">
					<Text className="text-body">🇵🇹</Text>
					<Text className="text-body font-sans text-muted-foreground">Lisbon, Portugal</Text>
				</View>
			</CollapsibleContent>
		</Collapsible>
	);
}
