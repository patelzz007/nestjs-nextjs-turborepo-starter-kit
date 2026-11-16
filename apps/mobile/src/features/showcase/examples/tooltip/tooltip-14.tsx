import FileTextIcon from "lucide-react-native/icons/file-text";
import { Badge } from "@workspace/ui-native/components/badge";
import { Icon } from "@workspace/ui-native/components/icon";
import { Tooltip } from "@workspace/ui-native/components/tooltip";
import * as React from "react";
import { Text, View } from "react-native";

const RICH = (
	<View className="flex-row gap-2">
		<Icon icon={FileTextIcon} size="sm" colorClassName="accent-background" />
		<View className="gap-1">
			<Text className="text-caption font-sans text-background">2.4 MB · uploaded 3 days ago</Text>
			<View className="flex-row gap-1">
				<Badge label="PDF" size="sm" />
				<Badge label="Verified" tone="success" size="sm" />
			</View>
		</View>
	</View>
);

export function Tooltip14Example(): React.JSX.Element {
	return (
		<View className="flex-row items-center gap-1">
			<Text className="text-body font-sans text-foreground">Attached:</Text>
			<Tooltip content="2.4 MB PDF, uploaded 3 days ago, verified" richContent={RICH} accessibilityLabel="contract-2026.pdf">
				<Text className="text-body font-sans text-muted-foreground">contract-2026.pdf</Text>
			</Tooltip>
		</View>
	);
}
