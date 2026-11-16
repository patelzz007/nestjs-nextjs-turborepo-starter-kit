import { Button } from "@workspace/ui-native/components/button";
import { Card, CardContent, CardFooter } from "@workspace/ui-native/components/card";
import * as React from "react";
import { Text } from "react-native";

import { ignorePress } from "../example-support";

// Four equal buttons: nothing says which one the card is for.
export function CardDont2Example(): React.JSX.Element {
	return (
		<Card title="Invite your team">
			<CardContent>
				<Text className="text-label font-sans text-muted-foreground">Projects move faster with more hands.</Text>
			</CardContent>
			<CardFooter className="flex-wrap">
				<Button label="Invite" onPress={ignorePress} />
				<Button label="Share" onPress={ignorePress} />
				<Button label="Export" onPress={ignorePress} />
				<Button label="Settings" onPress={ignorePress} />
			</CardFooter>
		</Card>
	);
}
