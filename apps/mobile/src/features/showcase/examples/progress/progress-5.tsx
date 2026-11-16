import { Progress } from "@workspace/ui-native/components/progress";
import { Icon } from "@workspace/ui-native/components/icon";
import FileIcon from "lucide-react-native/icons/file";
import * as React from "react";
import { Text, View } from "react-native";

interface UploadingFile {
	readonly name: string;
	readonly progress: number;
	readonly status: string;
}

const FILES: readonly UploadingFile[] = [
	{ name: "document.pdf", progress: 45, status: "2m 30s" },
	{ name: "presentation.pptx", progress: 78, status: "45s" },
	{ name: "spreadsheet.xlsx", progress: 12, status: "5m 12s" },
	{ name: "image.jpg", progress: 100, status: "Complete" },
];

export function Progress5Example(): React.JSX.Element {
	return (
		<View className="gap-3">
			{FILES.map((file: UploadingFile): React.JSX.Element => (
				<View key={file.name} className="flex-row items-center gap-3">
					<Icon icon={FileIcon} size="sm" colorClassName="accent-muted-foreground" />
					<Text numberOfLines={1} className="text-label font-sans-medium flex-1 text-foreground">
						{file.name}
					</Text>
					<Progress value={file.progress} size="sm" accessibilityLabel={`Uploading ${file.name}`} valueText={file.status} className="w-24" />
					<Text className="text-caption w-16 text-right font-sans text-foreground tabular-nums">{file.status}</Text>
				</View>
			))}
		</View>
	);
}
