import BadgeCheckIcon from "lucide-react-native/icons/badge-check";
import { Icon } from "@workspace/ui-native/components/icon";
import { Tooltip } from "@workspace/ui-native/components/tooltip";
import * as React from "react";
import { Text, View } from "react-native";

const RICH = (
	<View className="gap-1">
		<Text className="text-caption font-sans-semibold text-background">Verified</Text>
		<Text className="text-caption font-sans text-background">We checked that acme.com belongs to this team.</Text>
	</View>
);

export function Tooltip7Example(): React.JSX.Element {
	return (
		<View className="flex-row items-center gap-1.5">
			<Text className="text-body font-sans text-foreground">acme.com, verified domain</Text>
			<Tooltip content="Verified: we checked that acme.com belongs to this team." richContent={RICH} accessibilityLabel="Verified">
				<Icon icon={BadgeCheckIcon} size="sm" colorClassName="accent-success" />
			</Tooltip>
		</View>
	);
}
