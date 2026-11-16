import { Button } from "@workspace/ui-native/components/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@workspace/ui-native/components/card";
import * as React from "react";
import { Text } from "react-native";

import { ignorePress } from "../example-support";

const TITLE = "Header with Border";

export function Card4Example(): React.JSX.Element {
	return (
		<Card>
			<CardHeader className="border-b border-border pb-4">
				<CardTitle>{TITLE}</CardTitle>
			</CardHeader>
			<CardContent>
				<Text className="text-label font-sans text-foreground">The footer has a top border, creating a visual separation between the content and footer sections.</Text>
			</CardContent>
			<CardFooter className="border-t border-border pt-4">
				<Button label="Action" variant="outline" onPress={ignorePress} className="flex-1" />
			</CardFooter>
		</Card>
	);
}
