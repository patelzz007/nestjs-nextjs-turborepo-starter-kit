import { FILE_TYPE_CATEGORIES } from "@workspace/ui-kit-logic";
import { FileType } from "@workspace/ui-native/components/file-type";
import * as React from "react";
import { Text, View } from "react-native";

type Family = (typeof FILE_TYPE_CATEGORIES)[number];

/** Every family, with the blank page last. */
const FAMILIES: readonly Family[] = [...FILE_TYPE_CATEGORIES.filter((family: Family): boolean => family !== "empty"), "empty"];

export function FileType4Example(): React.JSX.Element {
	return (
		<View className="flex-row flex-wrap justify-center gap-x-1 gap-y-5">
			{FAMILIES.map((family: Family): React.JSX.Element => (
				// The caption names the family, so the icon is not read twice.
				<View key={family} className="w-22 items-center gap-2" accessible accessibilityLabel={family}>
					<FileType type={family} />
					<Text className="text-caption font-sans text-muted-foreground capitalize">{family}</Text>
				</View>
			))}
		</View>
	);
}
