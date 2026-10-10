// A "coming soon" panel for a destination that exists in the navigation but
// whose feature is not built yet. Presentational: the screen supplies the icon,
// the title, the description and the one action, and this only lays them out.

import * as React from "react";
import { View } from "react-native";

import { Button } from "./button";
import { Icon, type LucideIcon } from "./icon";
import { Heading, MutedText } from "./text";

export interface ComingSoonAction {
	readonly label: string;
	readonly onPress: () => void;
	/** What the action does, for screen readers when the label alone is not enough. */
	readonly accessibilityHint?: string;
}

export interface ComingSoonProps {
	readonly icon: LucideIcon;
	readonly title: string;
	readonly description: string;
	readonly action: ComingSoonAction;
	readonly testID?: string;
}

export function ComingSoon({ icon, title, description, action, testID }: ComingSoonProps): React.JSX.Element {
	return (
		<View className="flex-1 items-center justify-center gap-8 px-2 py-10" testID={testID}>
			<View className="items-center gap-5">
				<View className="size-20 items-center justify-center rounded-full border border-primary/15 bg-primary/10">
					<Icon icon={icon} size="xl" colorClassName="accent-primary" />
				</View>
				<View className="max-w-sm items-center gap-2">
					<Heading className="text-center">{title}</Heading>
					<MutedText className="text-center">{description}</MutedText>
				</View>
			</View>
			<View className="w-full max-w-xs">
				<Button label={action.label} onPress={action.onPress} {...(action.accessibilityHint === undefined ? {} : { accessibilityHint: action.accessibilityHint })} />
			</View>
		</View>
	);
}
