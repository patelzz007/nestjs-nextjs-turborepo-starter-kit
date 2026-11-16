import ImagePlusIcon from "lucide-react-native/icons/image-plus";
import { Button } from "@workspace/ui-native/components/button";
import { Progress } from "@workspace/ui-native/components/progress";
import * as React from "react";
import { View } from "react-native";
import { useFileUpload, type UploadFile } from "@workspace/ui-native/lib/use-file-upload";
import { Image } from "expo-image";

import { useSimulatedUploads } from "./file-upload-simulation";

const PERCENT = 100;

export function FileUpload7Example(): React.JSX.Element {
	const upload = useFileUpload({ source: "images", maxFiles: 8 });
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
					<View key={file.id} className="w-1/5 gap-1">
						<Image source={file.uri} accessibilityLabel={file.name} contentFit="cover" className="aspect-square w-full rounded-lg" />
						{file.status === "done" ? null : <Progress value={(file.progress ?? 0) * PERCENT} accessibilityLabel={`Uploading ${file.name}`} size="sm" />}
					</View>
				))}
			</View>
			<Button label="Add product images" icon={ImagePlusIcon} variant="outline" onPress={choose} />
		</View>
	);
}
