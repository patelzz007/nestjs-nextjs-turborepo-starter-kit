// A grouped block of content on a screen.

import * as React from "react";
import { View } from "react-native";

import { Subheading, MutedText } from "./text";

export interface CardProps {
	readonly title?: string;
	readonly description?: string;
	readonly children: React.ReactNode;
	readonly testID?: string;
}

export function Card({ title, description, children, testID }: CardProps): React.JSX.Element {
	return (
		<View className="gap-4 rounded-xl border border-border bg-card p-4" testID={testID}>
			{title === undefined ? null : (
				<View className="gap-1">
					<Subheading>{title}</Subheading>
					{description === undefined ? null : <MutedText>{description}</MutedText>}
				</View>
			)}
			{children}
		</View>
	);
}
