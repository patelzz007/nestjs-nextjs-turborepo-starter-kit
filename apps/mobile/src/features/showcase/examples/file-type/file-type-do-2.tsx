import { FileType } from "@workspace/ui-native/components/file-type";
import * as React from "react";
import { Text, View } from "react-native";

export function FileTypeDo2Example(): React.JSX.Element {
	return (
		<View className="flex-row items-center gap-3">
			<FileType type="xlsx" />
			<Text className="text-label font-sans text-foreground">Budget 2027.xlsx</Text>
		</View>
	);
}
