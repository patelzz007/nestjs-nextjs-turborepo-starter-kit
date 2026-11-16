import { ScrollArea } from "@workspace/ui-native/components/scroll-area";
import * as React from "react";
import { Text, View } from "react-native";

const FEATURES: readonly string[] = ["Seats", "Storage", "Projects", "API calls", "SSO", "Support"];
const PLANS: readonly { readonly name: string; readonly price: string }[] = [
	{ name: "Free", price: "$0" },
	{ name: "Starter", price: "$9" },
	{ name: "Team", price: "$29" },
	{ name: "Business", price: "$79" },
	{ name: "Scale", price: "$149" },
	{ name: "Pro", price: "$199" },
	{ name: "Enterprise", price: "Talk to us" },
	{ name: "Custom", price: "Quote" },
];
const PLAN = "Plan";
const PRICE = "Price";

export function ScrollArea3Example(): React.JSX.Element {
	return (
		<ScrollArea orientation="both" variant="outline" accessibilityLabel="Plans" className="h-64">
			<View className="flex-row border-b border-border bg-muted">
				<Text className="text-caption font-sans-semibold w-28 p-2 text-foreground">{PLAN}</Text>
				<Text className="text-caption font-sans-semibold w-24 p-2 text-foreground">{PRICE}</Text>
				{FEATURES.map((feature: string): React.JSX.Element => (
					<Text key={feature} className="text-caption font-sans-semibold w-24 p-2 text-foreground">
						{feature}
					</Text>
				))}
			</View>
			{PLANS.map((plan): React.JSX.Element => (
				<View key={plan.name} className="flex-row border-b border-border">
					<Text className="text-body w-28 p-2 font-sans text-foreground">{plan.name}</Text>
					<Text className="text-body w-24 p-2 font-sans text-foreground tabular-nums">{plan.price}</Text>
					{FEATURES.map((feature: string): React.JSX.Element => (
						<Text key={feature} className="text-body w-24 p-2 font-sans text-muted-foreground">
							✓
						</Text>
					))}
				</View>
			))}
		</ScrollArea>
	);
}
