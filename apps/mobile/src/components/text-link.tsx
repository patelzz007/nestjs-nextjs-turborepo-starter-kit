// An inline link to another screen ("Forgot password?", "Create one"), with an
// optional lead-in sentence before it ("Don't have an account?"). Presentational:
// the caller says what it does. Announced as a link — or as a button when it
// acts in place ("Sign out") rather than going somewhere. The touch area is at
// least 44 pt tall even though the text is small.

import * as React from "react";
import { Pressable, Text, View } from "react-native";

export interface TextLinkProps {
	readonly label: string;
	readonly onPress: () => void;
	/** Plain text shown before the link, on the same line. */
	readonly leadIn?: string;
	/** `button` when it acts instead of navigating. */
	readonly role?: "link" | "button";
	readonly testID?: string;
}

export function TextLink({ label, onPress, leadIn, role = "link", testID }: TextLinkProps): React.JSX.Element {
	return (
		<View className="flex-row flex-wrap items-center justify-center gap-1">
			{leadIn === undefined ? null : <Text className="font-sans text-sm text-muted-foreground">{leadIn}</Text>}
			<Pressable accessibilityRole={role} accessibilityLabel={label} onPress={onPress} hitSlop={8} testID={testID} className="min-h-11 justify-center active:opacity-60">
				<Text className="font-sans-semibold text-sm text-primary">{label}</Text>
			</Pressable>
		</View>
	);
}
