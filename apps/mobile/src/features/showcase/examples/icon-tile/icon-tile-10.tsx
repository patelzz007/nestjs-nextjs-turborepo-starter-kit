import { IconTile } from "@workspace/ui-native/components/icon-tile";
import FileTextIcon from "lucide-react-native/icons/file-text";
import * as React from "react";
import { Text, View } from "react-native";

export function IconTile10Example(): React.JSX.Element {
	return (
		<View className="rounded-card flex-row items-center gap-3 border border-border p-3">
			<IconTile icon={FileTextIcon} variant="elevated" tone="brand" size="sm" />
			<View className="flex-1 gap-0.5">
				<Text className="text-label font-sans-medium text-foreground">Quarterly report</Text>
				<Text className="text-caption font-sans text-muted-foreground">Updated 2 hours ago by Anna</Text>
			</View>
		</View>
	);
}
