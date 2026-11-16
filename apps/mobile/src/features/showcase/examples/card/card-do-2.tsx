import { Button } from "@workspace/ui-native/components/button";
import { Card, CardContent, CardFooter } from "@workspace/ui-native/components/card";
import * as React from "react";
import { Text } from "react-native";

import { ignorePress } from "../example-support";

export function CardDo2Example(): React.JSX.Element {
	return (
		<Card title="Invite your team">
			<CardContent>
				<Text className="text-label font-sans text-muted-foreground">Projects move faster with more hands.</Text>
			</CardContent>
			<CardFooter>
				<Button label="Invite people" onPress={ignorePress} className="flex-1" />
			</CardFooter>
		</Card>
	);
}
