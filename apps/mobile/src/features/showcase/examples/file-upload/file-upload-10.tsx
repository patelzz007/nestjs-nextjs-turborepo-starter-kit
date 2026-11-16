import ImageIcon from "lucide-react-native/icons/image";
import { Button } from "@workspace/ui-native/components/button";
import { CoverImage } from "@workspace/ui-native/components/cover-image";
import * as React from "react";
import { Text, View } from "react-native";
import { useFileUpload } from "@workspace/ui-native/lib/use-file-upload";

import { useSimulatedUploads } from "./file-upload-simulation";

const PERCENT = 100;

export function FileUpload10Example(): React.JSX.Element {
	const upload = useFileUpload({ source: "images", maxFiles: 1 });
	useSimulatedUploads(upload);
	const choose = React.useCallback((): void => {
		upload.openPicker().catch((): void => {
			// The picker could not open: nothing was picked.
		});
	}, [upload]);
	const cover = upload.files.at(0);
	return (
		<View className="gap-2">
			<CoverImage uri={cover?.uri ?? null} alt="Cover image" ratio="video" />
			<View className="flex-row gap-2">
				<Button label={cover === undefined ? "Add cover" : "Change cover"} icon={ImageIcon} variant="outline" size="sm" onPress={choose} />
				{cover === undefined ? null : <Button label="Remove" variant="ghost" size="sm" onPress={upload.clearFiles} />}
				{cover === undefined || cover.status === "done" ? null : (
					<Text className="text-caption self-center font-sans text-muted-foreground tabular-nums">{`${String(Math.round((cover.progress ?? 0) * PERCENT))}%`}</Text>
				)}
			</View>
		</View>
	);
}
