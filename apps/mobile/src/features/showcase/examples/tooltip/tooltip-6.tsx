import ActivityIcon from "lucide-react-native/icons/activity";
import { Badge } from "@workspace/ui-native/components/badge";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { Tooltip } from "@workspace/ui-native/components/tooltip";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

function StatusRow({ name, ok }: { readonly name: string; readonly ok: boolean }): React.JSX.Element {
	return (
		<View className="flex-row items-center justify-between gap-3">
			<Text className="text-caption font-sans text-background">{name}</Text>
			<Badge label={ok ? "Operational" : "Degraded"} tone={ok ? "success" : "warning"} size="sm" />
		</View>
	);
}

const RICH = (
	<View className="gap-1.5">
		<StatusRow name="API" ok />
		<StatusRow name="Dashboard" ok />
		<StatusRow name="Webhooks" ok={false} />
		<Text className="text-overline font-sans text-background">Updated 2 minutes ago</Text>
	</View>
);

export function Tooltip6Example(): React.JSX.Element {
	return (
		<Tooltip content="API operational, Dashboard operational, Webhooks degraded. Updated 2 minutes ago." richContent={RICH} accessibilityLabel="System status" asChild>
			<IconButton icon={ActivityIcon} label="System status" variant="secondary" onPress={ignorePress} />
		</Tooltip>
	);
}
