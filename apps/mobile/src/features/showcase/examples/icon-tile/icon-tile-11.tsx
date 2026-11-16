import { IconTile } from "@workspace/ui-native/components/icon-tile";
import LayoutDashboardIcon from "lucide-react-native/icons/layout-dashboard";
import * as React from "react";
import { Text, View } from "react-native";

export function IconTile11Example(): React.JSX.Element {
	return (
		<View className="rounded-card gap-3 border border-border bg-card p-4">
			<IconTile icon={LayoutDashboardIcon} variant="elevated" tone="brand" size="lg" />
			<View className="gap-1">
				<Text className="text-label font-sans-medium text-foreground">Unified dashboard</Text>
				<Text className="text-caption font-sans text-muted-foreground">Track every project, deployment and metric from a single workspace.</Text>
			</View>
		</View>
	);
}
