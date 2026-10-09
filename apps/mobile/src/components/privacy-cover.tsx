// Covers the app while it is in the app switcher and the app lock is on, so
// the task switcher snapshot does not show the last screen (§11.5).

import * as React from "react";
import { View } from "react-native";

import { Heading } from "./text";

export interface PrivacyCoverProps {
	readonly visible: boolean;
	/** The app's name, shown on the cover. */
	readonly appName: string;
}

export function PrivacyCover({ visible, appName }: PrivacyCoverProps): React.JSX.Element | null {
	if (!visible) {
		return null;
	}
	return (
		<View
			testID="privacy-cover"
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			className="absolute inset-0 items-center justify-center bg-background">
			<Heading>{appName}</Heading>
		</View>
	);
}
