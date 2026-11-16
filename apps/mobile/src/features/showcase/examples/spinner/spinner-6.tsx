import { Button } from "@workspace/ui-native/components/button";
import { Spinner } from "@workspace/ui-native/components/spinner";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

const PLAIN = <Spinner />;
const ON_PRIMARY = <Spinner colorClassName="accent-primary-foreground" />;

export function Spinner6Example(): React.JSX.Element {
	return (
		<View className="flex-row flex-wrap items-center justify-center gap-3">
			<Button label="Saving…" size="sm" leading={ON_PRIMARY} disabled onPress={ignorePress} />
			<Button label="Loading" size="sm" variant="outline" leading={PLAIN} disabled onPress={ignorePress} />
			<Button label="Processing" size="sm" variant="secondary" leading={PLAIN} disabled onPress={ignorePress} />
		</View>
	);
}
