import { Icon } from "@workspace/ui-native/components/icon";
import { IconStack } from "@workspace/ui-native/components/icon-stack";
import PackageIcon from "lucide-react-native/icons/package";
import * as React from "react";
import { Text, View } from "react-native";

// The smallest stack, as the media of an outlined row.
export function IconStack6Example(): React.JSX.Element {
	return (
		<View className="rounded-card flex-row items-center gap-3 border border-border p-3">
			<IconStack tone="primary" size="xs">
				<Icon icon={PackageIcon} size="xs" colorClassName="accent-primary" />
			</IconStack>
			<View className="flex-1 gap-0.5">
				<Text className="text-label font-sans-medium text-foreground">Registry package ready</Text>
				<Text className="text-caption font-sans text-muted-foreground">Use IconStack as rich media inside compact rows.</Text>
			</View>
		</View>
	);
}
