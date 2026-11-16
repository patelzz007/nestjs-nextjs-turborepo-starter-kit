import { HoverCard } from "@workspace/ui-native/components/hover-card";
import * as React from "react";
import { Pressable, Text } from "react-native";

const CONTENT = <Text className="text-body font-sans text-foreground">Next.js: the React framework, by Vercel.</Text>;

export function HoverCardDont2Example(): React.JSX.Element {
	return (
		<HoverCard content={CONTENT} accessibilityLabel="Next.js">
			<Pressable accessibilityRole="button" accessibilityLabel="Next.js">
				<Text className="text-body font-sans text-foreground">Next.js</Text>
			</Pressable>
		</HoverCard>
	);
}
