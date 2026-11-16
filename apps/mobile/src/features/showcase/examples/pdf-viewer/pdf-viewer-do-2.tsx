import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

export function PdfViewerDo2Example(): React.JSX.Element {
	return (
		<View className="gap-2">
			<Text className="text-label font-sans text-muted-foreground">This phone cannot show PDFs here.</Text>
			<Button label="Open in another app" variant="outline" size="sm" onPress={ignorePress} className="self-start" />
		</View>
	);
}
