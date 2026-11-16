import { FileType, type FileTypeVariant } from "@workspace/ui-native/components/file-type";
import * as React from "react";
import { Text, View } from "react-native";

const VARIANTS: readonly FileTypeVariant[] = ["outline", "solid", "light", "mono"];
const TYPES: readonly string[] = ["pdf", "docx", "xlsx", "jpg", "zip"];

export function FileType2Example(): React.JSX.Element {
	return (
		<View className="gap-5 self-center">
			{VARIANTS.map((variant: FileTypeVariant): React.JSX.Element => (
				<View key={variant} className="gap-2.5">
					<Text className="text-caption font-sans text-muted-foreground capitalize">{variant}</Text>
					<View className="flex-row gap-4">
						{TYPES.map((type: string): React.JSX.Element => (
							<FileType key={type} type={type} variant={variant} />
						))}
					</View>
				</View>
			))}
		</View>
	);
}
