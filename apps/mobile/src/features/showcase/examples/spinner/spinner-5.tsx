import { Button } from "@workspace/ui-native/components/button";
import { EmptyState } from "@workspace/ui-native/components/empty";
import { Spinner } from "@workspace/ui-native/components/spinner";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

// A loading view: the spinner in a muted tile, what is loading, and a way out.
const TILE = (
	<View className="size-10 items-center justify-center rounded-lg bg-muted">
		<Spinner accessibilityLabel="Loading projects" />
	</View>
);

export function Spinner5Example(): React.JSX.Element {
	return (
		<EmptyState
			variant="outline"
			align="center"
			illustration={TILE}
			title="Loading projects"
			message="Please wait while we fetch your project data. This should only take a moment.">
			<Button label="Cancel" variant="outline" size="sm" disabled onPress={ignorePress} />
		</EmptyState>
	);
}
