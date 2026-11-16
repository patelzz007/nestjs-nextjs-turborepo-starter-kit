import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui-native/components/card";
import * as React from "react";
import { Text } from "react-native";

const TITLE = "Payouts";

export function CardDo1Example(): React.JSX.Element {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{TITLE}</CardTitle>
			</CardHeader>
			<CardContent>
				<Text className="text-label font-sans text-muted-foreground">Next payout: RM 1,240 on Friday.</Text>
			</CardContent>
		</Card>
	);
}
