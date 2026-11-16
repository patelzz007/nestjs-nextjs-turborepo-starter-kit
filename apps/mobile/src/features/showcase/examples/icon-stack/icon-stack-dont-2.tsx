import { IconStack } from "@workspace/ui-native/components/icon-stack";
import * as React from "react";
import { Text } from "react-native";

// A sentence printed on the front layer: skewed with the face, it is unreadable.
export function IconStackDont2Example(): React.JSX.Element {
	return (
		<IconStack tone="primary" className="self-center">
			<Text className="text-caption font-sans text-foreground">Your package is ready</Text>
		</IconStack>
	);
}
