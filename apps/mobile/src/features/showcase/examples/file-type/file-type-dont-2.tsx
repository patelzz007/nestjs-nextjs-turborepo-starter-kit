import { FileType } from "@workspace/ui-native/components/file-type";
import * as React from "react";
import { Text, View } from "react-native";

// A spreadsheet recoloured red: the tone now says "PDF" or "problem", not "spreadsheet".
export function FileTypeDont2Example(): React.JSX.Element {
	return (
		<View className="flex-row items-center gap-3">
			<FileType type="xlsx" tone="red" />
			<Text className="text-label font-sans text-foreground">Budget 2027.xlsx</Text>
		</View>
	);
}
