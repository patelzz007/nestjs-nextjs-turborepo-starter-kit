import { Card } from "@workspace/ui-native/components/card";
import * as React from "react";
import { Text } from "react-native";

// A card inside a card: two borders around one thought.
export function CardDont1Example(): React.JSX.Element {
	return (
		<Card title="Payouts">
			<Card>
				<Text className="text-label font-sans text-muted-foreground">Next payout: RM 1,240 on Friday.</Text>
			</Card>
		</Card>
	);
}
