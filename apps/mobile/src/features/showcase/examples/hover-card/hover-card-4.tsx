import ZapIcon from "lucide-react-native/icons/zap";
import { Button } from "@workspace/ui-native/components/button";
import { HoverCard } from "@workspace/ui-native/components/hover-card";
import { Icon } from "@workspace/ui-native/components/icon";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

const CONTENT = (
	<View className="flex-row gap-3">
		<Icon icon={ZapIcon} size="md" colorClassName="accent-warning" />
		<View className="flex-1 gap-1">
			<Text className="text-body-lg font-sans-semibold text-foreground">Instant deploys</Text>
			<Text className="text-body font-sans text-muted-foreground">Every push goes live in under 10 seconds.</Text>
		</View>
	</View>
);

export function HoverCard4Example(): React.JSX.Element {
	return (
		<HoverCard content={CONTENT} accessibilityLabel="Instant deploys">
			<Button label="Instant deploys" icon={ZapIcon} variant="outline" onPress={ignorePress} />
		</HoverCard>
	);
}
