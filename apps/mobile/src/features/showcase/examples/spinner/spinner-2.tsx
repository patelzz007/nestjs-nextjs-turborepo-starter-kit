import { Button } from "@workspace/ui-native/components/button";
import { Spinner } from "@workspace/ui-native/components/spinner";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

// A pending button leads with a spinner; an icon-only one is named for screen readers.
const SPINNER = <Spinner />;
const SPINNER_ON_PRIMARY = <Spinner colorClassName="accent-primary-foreground" />;

export function Spinner2Example(): React.JSX.Element {
	return (
		<View className="flex-row flex-wrap items-center justify-center gap-4">
			<Button label="Processing…" leading={SPINNER_ON_PRIMARY} onPress={ignorePress} />
			<Button label="Loading…" variant="outline" leading={SPINNER} disabled onPress={ignorePress} />
			<Button label="" variant="outline" leading={SPINNER} accessibilityLabel="Loading" disabled onPress={ignorePress} />
		</View>
	);
}
