import { Button } from "@workspace/ui-native/components/button";
import { EmptyState } from "@workspace/ui-native/components/empty";
import { Icon } from "@workspace/ui-native/components/icon";
import { IconStack } from "@workspace/ui-native/components/icon-stack";
import DatabaseIcon from "lucide-react-native/icons/database";
import InboxIcon from "lucide-react-native/icons/inbox";
import UserPlusIcon from "lucide-react-native/icons/user-plus";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

const ILLUSTRATION = (
	<IconStack tone="primary" size="lg">
		<Icon icon={InboxIcon} size="md" colorClassName="accent-primary" />
	</IconStack>
);

export function IconStack5Example(): React.JSX.Element {
	return (
		<EmptyState
			variant="plain"
			align="center"
			illustration={ILLUSTRATION}
			title="Workspace is ready"
			message="Invite teammates or connect a data source to start filling this view."
			className="py-10">
			<View className="flex-row flex-wrap justify-center gap-2">
				<Button label="Invite team" size="sm" icon={UserPlusIcon} onPress={ignorePress} />
				<Button label="Connect source" variant="outline" size="sm" icon={DatabaseIcon} onPress={ignorePress} />
			</View>
		</EmptyState>
	);
}
