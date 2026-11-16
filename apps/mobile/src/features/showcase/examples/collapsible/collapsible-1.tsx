import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui-native/components/collapsible";
import { Badge } from "@workspace/ui-native/components/badge";
import * as React from "react";
import { Text, View } from "react-native";

export function Collapsible1Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	return (
		<Collapsible open={open} onOpenChange={setOpen} variant="card">
			<CollapsibleTrigger label="Order #48213" description="2 items · $129.00" trailing={<Badge label="Shipped" tone="success" size="sm" />} />
			<CollapsibleContent className="gap-2">
				<Text className="text-body font-sans text-foreground">Ships to: 12 Rue Oberkampf, 75011 Paris</Text>
				<View className="gap-1">
					<Text className="text-body font-sans text-muted-foreground">1 × Desk lamp — $89.00</Text>
					<Text className="text-body font-sans text-muted-foreground">1 × Cable kit — $40.00</Text>
				</View>
			</CollapsibleContent>
		</Collapsible>
	);
}
