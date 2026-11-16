import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

export function PdfViewerDo1Example(): React.JSX.Element {
	return (
		<View className="gap-2">
			<Text className="text-label font-sans-medium text-foreground">Invoice 3182 · PDF · 240 KB</Text>
			<Button label="Open invoice" size="sm" onPress={ignorePress} className="self-start" />
		</View>
	);
}
