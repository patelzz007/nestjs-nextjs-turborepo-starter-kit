// A message block: a request error, a notice, a success. Errors are announced
// to screen readers as alerts.

import * as React from "react";
import { View } from "react-native";

import { BodyText } from "./text";

export type BannerTone = "error" | "info" | "success" | "warning";

const TONE_CLASSES: Readonly<Record<BannerTone, { readonly container: string; readonly text: string }>> = {
	error: { container: "border-destructive bg-destructive-soft", text: "text-destructive-foreground" },
	info: { container: "border-info bg-info-soft", text: "text-info-foreground" },
	success: { container: "border-success bg-success-soft", text: "text-success-foreground" },
	warning: { container: "border-warning bg-warning-soft", text: "text-warning-foreground" },
};

export interface BannerProps {
	readonly tone: BannerTone;
	readonly message: string;
	readonly testID?: string;
}

export function Banner({ tone, message, testID }: BannerProps): React.JSX.Element {
	const classes = TONE_CLASSES[tone];
	const isError = tone === "error";
	return (
		<View
			accessible
			accessibilityRole={isError ? "alert" : "summary"}
			accessibilityLiveRegion={isError ? "assertive" : "polite"}
			testID={testID}
			className={`rounded-lg border px-4 py-3 ${classes.container}`}>
			<BodyText className={classes.text}>{message}</BodyText>
		</View>
	);
}
