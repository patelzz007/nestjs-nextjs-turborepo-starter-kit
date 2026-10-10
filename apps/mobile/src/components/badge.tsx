// A short status label ("This device", "On").

import * as React from "react";
import { Text, View } from "react-native";

export type BadgeTone = "neutral" | "success" | "warning";

const TONE_CLASSES: Readonly<Record<BadgeTone, { readonly container: string; readonly text: string }>> = {
	neutral: { container: "border border-border bg-muted", text: "text-muted-foreground" },
	success: { container: "bg-success-soft", text: "text-success-foreground" },
	warning: { container: "bg-warning-soft", text: "text-warning-foreground" },
};

export interface BadgeProps {
	readonly label: string;
	readonly tone?: BadgeTone;
}

export function Badge({ label, tone = "neutral" }: BadgeProps): React.JSX.Element {
	const classes = TONE_CLASSES[tone];
	return (
		<View className={`self-start rounded-full px-2.5 py-0.5 ${classes.container}`}>
			<Text className={`font-sans-medium text-xs ${classes.text}`}>{label}</Text>
		</View>
	);
}
