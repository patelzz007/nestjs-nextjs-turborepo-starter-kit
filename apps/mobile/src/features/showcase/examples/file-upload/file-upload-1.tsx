import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";
import { Text, View } from "react-native";
import { useFileUpload } from "@workspace/ui-native/lib/use-file-upload";
import { Image } from "expo-image";

import { useSimulatedUploads } from "./file-upload-simulation";

const MAX_SIZE = 2 * 1024 * 1024;

export function FileUpload1Example(): React.JSX.Element {
	const upload = useFileUpload({ source: "images", maxFiles: 1, maxSize: MAX_SIZE });
	useSimulatedUploads(upload);
	const choose = React.useCallback((): void => {
		upload.openPicker().catch((): void => {
			// The picker could not open: nothing was picked.
		});
	}, [upload]);
	const picked = upload.files.at(0);
	return (
		<View className="flex-row items-center gap-3">
			<View className="size-16 overflow-hidden rounded-lg border border-border bg-muted">
				{picked === undefined ? null : <Image source={picked.uri} accessibilityLabel={picked.name} contentFit="cover" className="size-full" />}
			</View>
			<View className="flex-1 gap-1">
				<Button label="Upload image" variant="outline" size="sm" onPress={choose} className="self-start" />
				<Text numberOfLines={1} className="text-caption font-sans text-muted-foreground">
					{picked?.name ?? "PNG or JPG, up to 2 MB."}
				</Text>
			</View>
		</View>
	);
}
