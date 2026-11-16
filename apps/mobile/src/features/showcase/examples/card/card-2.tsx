import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui-native/components/card";
import * as React from "react";
import { Text } from "react-native";

const TITLE = "Header with Border";
const DESCRIPTION = "This is a card with a header that has a bottom border.";

export function Card2Example(): React.JSX.Element {
	return (
		<Card>
			<CardHeader className="border-b border-border pb-4">
				<CardTitle>{TITLE}</CardTitle>
				<CardDescription>{DESCRIPTION}</CardDescription>
			</CardHeader>
			<CardContent>
				<Text className="text-label font-sans text-foreground">The header has a bottom border, creating a visual separation between the header and content sections.</Text>
			</CardContent>
		</Card>
	);
}
