import { Button } from "@workspace/ui-native/components/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui-native/components/card";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

const TITLE = "Default Card";
const DESCRIPTION = "This card uses the default size variant.";

// A deck: two blank layers peek out below the card's bottom edge.
export function Card11Example(): React.JSX.Element {
	return (
		<View className="pb-3">
			<View className="rounded-card absolute inset-x-4 top-4 -bottom-0 border border-border bg-card shadow-md" />
			<View className="rounded-card absolute inset-x-2 top-2 bottom-1.5 border border-border bg-card shadow-md" />
			<Card>
				<CardHeader>
					<CardTitle>{TITLE}</CardTitle>
					<CardDescription>{DESCRIPTION}</CardDescription>
				</CardHeader>
				<CardContent>
					<Text className="text-label font-sans text-foreground">
						The card component supports a size prop that defaults to &quot;md&quot; for standard spacing and sizing.
					</Text>
				</CardContent>
				<CardFooter>
					<Button label="Action" variant="outline" onPress={ignorePress} className="flex-1" />
				</CardFooter>
			</Card>
		</View>
	);
}
