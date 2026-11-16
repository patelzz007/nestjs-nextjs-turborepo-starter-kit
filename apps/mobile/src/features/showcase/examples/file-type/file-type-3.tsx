import { FILE_TYPE_POINTS, FileType, type FileTypeSize } from "@workspace/ui-native/components/file-type";
import * as React from "react";
import { Text, View } from "react-native";

const SIZES: readonly FileTypeSize[] = ["mini", "xs", "sm", "md", "lg", "xl"];

export function FileType3Example(): React.JSX.Element {
	return (
		<View className="flex-row flex-wrap items-end justify-center gap-6">
			{SIZES.map((size: FileTypeSize): React.JSX.Element => (
				<View key={size} className="items-center gap-3">
					<FileType type="pdf" size={size} />
					<View className="items-center">
						<Text className="text-caption font-sans-medium text-foreground">{size}</Text>
						<Text className="text-caption font-sans text-muted-foreground tabular-nums">{`${String(FILE_TYPE_POINTS[size])}pt`}</Text>
					</View>
				</View>
			))}
		</View>
	);
}
