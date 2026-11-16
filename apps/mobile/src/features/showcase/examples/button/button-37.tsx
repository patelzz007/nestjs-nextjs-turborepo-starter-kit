import ThumbsUpIcon from "lucide-react-native/icons/thumbs-up";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

export function Button37Example(): React.JSX.Element {
	return (
		<Button
			label="Like"
			icon={ThumbsUpIcon}
			accessibilityLabel="Like, 456 likes"
			trailing={
				<View className="flex-row items-center gap-2">
					<View className="h-4 w-px bg-primary-foreground/40" />
					<Text className="text-button font-sans text-primary-foreground tabular-nums">456</Text>
				</View>
			}
			onPress={ignorePress}
		/>
	);
}
