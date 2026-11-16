import TagIcon from "lucide-react-native/icons/tag";
import { Badge } from "@workspace/ui-native/components/badge";
import { Icon } from "@workspace/ui-native/components/icon";
import { Tooltip } from "@workspace/ui-native/components/tooltip";
import * as React from "react";
import { Text, View } from "react-native";

const RICH = (
	<View className="gap-1.5">
		<Text className="text-caption font-sans-semibold text-background">Labels</Text>
		<View className="flex-row flex-wrap gap-1">
			<Badge label="bug" tone="destructive" size="sm" />
			<Badge label="design" tone="info" size="sm" />
			<Badge label="urgent" tone="warning" size="sm" />
		</View>
	</View>
);

export function Tooltip15Example(): React.JSX.Element {
	return (
		<Tooltip content="Labels: bug, design, urgent" richContent={RICH} accessibilityLabel="3 labels" className="self-start">
			<View className="flex-row items-center gap-1">
				<Icon icon={TagIcon} size="sm" colorClassName="accent-muted-foreground" />
				<Text className="text-body font-sans text-muted-foreground">3 labels</Text>
			</View>
		</Tooltip>
	);
}
