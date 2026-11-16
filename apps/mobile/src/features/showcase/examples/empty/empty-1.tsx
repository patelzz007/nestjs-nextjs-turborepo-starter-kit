import { Button } from "@workspace/ui-native/components/button";
import { EmptyState } from "@workspace/ui-native/components/empty";
import ArrowUpRightIcon from "lucide-react-native/icons/arrow-up-right";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

export function Empty1Example(): React.JSX.Element {
	return (
		<EmptyState variant="plain" align="center" title="No projects yet" message="You haven't created any projects yet. Get started by creating your first project.">
			<View className="flex-row gap-2">
				<Button label="Create project" size="sm" onPress={ignorePress} />
				<Button label="Import project" variant="outline" size="sm" onPress={ignorePress} />
			</View>
			<Button label="Learn more" variant="link" size="sm" icon={ArrowUpRightIcon} iconPosition="end" onPress={ignorePress} />
		</EmptyState>
	);
}
