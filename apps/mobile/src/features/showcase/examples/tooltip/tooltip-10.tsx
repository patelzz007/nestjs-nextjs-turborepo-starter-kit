import LockIcon from "lucide-react-native/icons/lock";
import { Badge } from "@workspace/ui-native/components/badge";
import { Button } from "@workspace/ui-native/components/button";
import { HoverCard } from "@workspace/ui-native/components/hover-card";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

const CONTENT = (
	<View className="gap-2">
		<View className="flex-row items-center gap-2">
			<Text className="text-body-lg font-sans-semibold text-foreground">Version history</Text>
			<Badge label="Pro" tone="info" size="sm" />
		</View>
		<Text className="text-body font-sans text-muted-foreground">Go back to any version of a file from the last 90 days.</Text>
		<Button label="Upgrade to Pro" size="sm" onPress={ignorePress} />
	</View>
);

export function Tooltip10Example(): React.JSX.Element {
	return (
		<HoverCard content={CONTENT} accessibilityLabel="Version history">
			<IconButton icon={LockIcon} label="Version history (Pro)" variant="secondary" onPress={ignorePress} />
		</HoverCard>
	);
}
