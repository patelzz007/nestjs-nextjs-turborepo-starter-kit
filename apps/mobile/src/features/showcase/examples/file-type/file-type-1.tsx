import { FileType } from "@workspace/ui-native/components/file-type";
import * as React from "react";
import { View } from "react-native";

const FORMATS: readonly string[] = ["pdf", "docx", "xlsx", "pptx", "jpg", "mp4", "mp3", "zip", "fig", "html"];

// Uncaptioned: each icon names itself for screen readers ("PDF file").
export function FileType1Example(): React.JSX.Element {
	return (
		<View className="flex-row flex-wrap justify-center gap-x-4 gap-y-6">
			{FORMATS.map((type: string): React.JSX.Element => (
				<FileType key={type} type={type} />
			))}
		</View>
	);
}
