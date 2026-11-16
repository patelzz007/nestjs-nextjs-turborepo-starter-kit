import { Button } from "@workspace/ui-native/components/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@workspace/ui-native/components/card";
import ExternalLinkIcon from "lucide-react-native/icons/external-link";
import * as React from "react";
import { Text } from "react-native";

import { ignorePress } from "../example-support";

const TITLE = "Need a help in Claim?";

export function Card5Example(): React.JSX.Element {
	return (
		<Card className="gap-2">
			<CardHeader>
				<CardTitle>{TITLE}</CardTitle>
			</CardHeader>
			<CardContent>
				<Text className="text-label font-sans text-foreground">Go to this step by step guideline process on how to certify for your weekly benefits:</Text>
			</CardContent>
			<CardFooter>
				<Button label="See our guideline" variant="link" icon={ExternalLinkIcon} iconPosition="end" onPress={ignorePress} className="px-0" />
			</CardFooter>
		</Card>
	);
}
