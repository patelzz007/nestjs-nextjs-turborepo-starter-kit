import ImagePlusIcon from "lucide-react-native/icons/image-plus";
import { Button } from "@workspace/ui-native/components/button";
import { Tooltip } from "@workspace/ui-native/components/tooltip";
import * as React from "react";
import { Text, View } from "react-native";
import { useFileUpload, type UploadFile } from "@workspace/ui-native/lib/use-file-upload";
import { Image } from "expo-image";

import { useSimulatedUploads } from "./file-upload-simulation";

const PERCENT = 100;

export function FileUpload9Example(): React.JSX.Element {
	const upload = useFileUpload({ source: "images", maxFiles: 6 });
	useSimulatedUploads(upload);
	const choose = React.useCallback((): void => {
		upload.openPicker().catch((): void => {
			// The picker could not open: nothing was picked.
		});
	}, [upload]);
	return (
		<View className="gap-3">
			<View className="flex-row flex-wrap gap-2">
				{upload.files.map((file: UploadFile): React.JSX.Element => (
					<Tooltip key={file.id} content={file.name} accessibilityLabel={file.name}>
						<View className="rounded-card size-24 overflow-hidden border border-border">
							<Image source={file.uri} accessibilityLabel={file.name} contentFit="cover" className="size-full" />
							{file.status === "done" ? null : (
								<View className="absolute inset-0 items-center justify-center bg-background/60">
									<Text className="text-label font-sans-semibold text-foreground tabular-nums">{`${String(Math.round((file.progress ?? 0) * PERCENT))}%`}</Text>
								</View>
							)}
						</View>
					</Tooltip>
				))}
			</View>
			<Button label="Add images" icon={ImagePlusIcon} variant="outline" onPress={choose} />
		</View>
	);
}
