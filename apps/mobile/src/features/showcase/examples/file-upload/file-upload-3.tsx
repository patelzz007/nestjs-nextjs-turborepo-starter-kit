import UploadIcon from "lucide-react-native/icons/upload";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";
import { ScrollView, Text, View } from "react-native";
import { useFileUpload, type UploadFile } from "@workspace/ui-native/lib/use-file-upload";
import { Image } from "expo-image";

import { useSimulatedUploads } from "./file-upload-simulation";

export function FileUpload3Example(): React.JSX.Element {
	const upload = useFileUpload({ source: "images", maxFiles: 8 });
	useSimulatedUploads(upload);
	const choose = React.useCallback((): void => {
		upload.openPicker().catch((): void => {
			// The picker could not open: nothing was picked.
		});
	}, [upload]);
	return (
		<View className="gap-2">
			<View className="rounded-card flex-row items-center gap-2 border border-dashed border-input p-2">
				<Button label="Add files" icon={UploadIcon} variant="outline" size="sm" onPress={choose} />
				<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
					{upload.files.map((file: UploadFile): React.JSX.Element => (
						<Image key={file.id} source={file.uri} accessibilityLabel={file.name} contentFit="cover" className="size-12 rounded-md" />
					))}
				</ScrollView>
			</View>
			{upload.errors.map((error: string): React.JSX.Element => (
				<Text key={error} className="text-body font-sans text-destructive-foreground">
					{error}
				</Text>
			))}
		</View>
	);
}
