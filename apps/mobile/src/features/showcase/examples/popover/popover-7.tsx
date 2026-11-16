import SparklesIcon from "lucide-react-native/icons/sparkles";
import { Button } from "@workspace/ui-native/components/button";
import { Icon } from "@workspace/ui-native/components/icon";
import { Popover } from "@workspace/ui-native/components/popover";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

const CONTENT = (
	<View className="gap-3">
		<View className="-mx-4 -mt-4 flex-row items-center gap-2 rounded-t-2xl bg-primary px-4 py-3">
			<Icon icon={SparklesIcon} size="sm" colorClassName="accent-primary-foreground" />
			<Text className="text-body font-sans-semibold text-primary-foreground">New: AI summaries</Text>
		</View>
		<Text className="text-body font-sans text-foreground">Get a short summary of every long thread, written as you open it.</Text>
		<View className="flex-row gap-2">
			<Button label="Enable AI" size="sm" onPress={ignorePress} />
			<Button label="Learn more" variant="ghost" size="sm" onPress={ignorePress} />
		</View>
	</View>
);

export function Popover7Example(): React.JSX.Element {
	return (
		<Popover content={CONTENT} accessibilityLabel="AI summaries">
			<Button label="What's new" icon={SparklesIcon} variant="outline" onPress={ignorePress} />
		</Popover>
	);
}
