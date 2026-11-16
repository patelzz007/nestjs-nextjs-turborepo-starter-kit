import { Button } from "@workspace/ui-native/components/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@workspace/ui-native/components/card";
import * as React from "react";
import { Text } from "react-native";

import { ignorePress } from "../example-support";

const TITLE = "Header";

// Zero-gap sections: a slim header with its own button, a body ruled above and below, and a footer button.
export function Card3Example(): React.JSX.Element {
	return (
		<Card className="gap-0 p-0">
			<CardHeader className="flex-row items-center justify-between px-4 py-2">
				<CardTitle>{TITLE}</CardTitle>
				<Button label="Action" variant="outline" size="sm" onPress={ignorePress} />
			</CardHeader>
			<CardContent className="border-y border-border px-4 py-3">
				<Text className="text-label font-sans text-foreground">The body is ruled above and below, separating it from the header and the footer.</Text>
			</CardContent>
			<CardFooter className="px-4 py-3">
				<Button label="Action" variant="outline" onPress={ignorePress} className="flex-1" />
			</CardFooter>
		</Card>
	);
}
