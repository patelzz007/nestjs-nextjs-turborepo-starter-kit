import TriangleAlertIcon from "lucide-react-native/icons/triangle-alert";
import { Icon } from "@workspace/ui-native/components/icon";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { Tooltip } from "@workspace/ui-native/components/tooltip";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

const RICH = (
	<View className="flex-row items-center gap-1.5">
		<Icon icon={TriangleAlertIcon} size="xs" colorClassName="accent-warning" />
		<Text className="text-caption font-sans text-background">This cannot be undone.</Text>
	</View>
);

export function Tooltip9Example(): React.JSX.Element {
	return (
		<Tooltip content="Warning: this cannot be undone." richContent={RICH} accessibilityLabel="Reset data" asChild>
			<IconButton icon={TriangleAlertIcon} label="Reset data" variant="secondary" onPress={ignorePress} />
		</Tooltip>
	);
}
