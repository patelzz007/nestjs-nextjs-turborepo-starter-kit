import { Button } from "@workspace/ui-native/components/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui-native/components/card";
import * as React from "react";
import { Text } from "react-native";

import { ignorePress } from "../example-support";

const TITLE = "Default Card";
const DESCRIPTION = "This card uses the default size variant.";

export function Card1Example(): React.JSX.Element {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{TITLE}</CardTitle>
				<CardDescription>{DESCRIPTION}</CardDescription>
			</CardHeader>
			<CardContent>
				<Text className="text-label font-sans text-foreground">The card component supports a size prop that defaults to &quot;md&quot; for standard spacing and sizing.</Text>
			</CardContent>
			<CardFooter>
				<Button label="Action" variant="outline" onPress={ignorePress} className="flex-1" />
			</CardFooter>
		</Card>
	);
}
