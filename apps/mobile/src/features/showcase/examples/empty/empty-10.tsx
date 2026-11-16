import { Button } from "@workspace/ui-native/components/button";
import { EmptyState } from "@workspace/ui-native/components/empty";
import ChartColumnIcon from "lucide-react-native/icons/chart-column";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

export function Empty10Example(): React.JSX.Element {
	return (
		<EmptyState
			variant="outline"
			align="center"
			icon={ChartColumnIcon}
			title="No data yet"
			message="Once your project starts receiving traffic, analytics will appear here."
			className="py-12">
			<View className="flex-row flex-wrap justify-center gap-2">
				<Button label="Connect Data Source" size="sm" onPress={ignorePress} />
				<Button label="View Docs" variant="outline" size="sm" onPress={ignorePress} />
			</View>
		</EmptyState>
	);
}
