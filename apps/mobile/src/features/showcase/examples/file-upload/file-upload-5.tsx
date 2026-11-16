import UploadIcon from "lucide-react-native/icons/upload";
import { Alert } from "@workspace/ui-native/components/alert";
import { Button } from "@workspace/ui-native/components/button";
import { Progress } from "@workspace/ui-native/components/progress";
import * as React from "react";
import { Text, View } from "react-native";
import { formatFileSize, useFileUpload, type UploadFile } from "@workspace/ui-native/lib/use-file-upload";

import { useSimulatedUploads } from "./file-upload-simulation";

const PERCENT = 100;

export function FileUpload5Example(): React.JSX.Element {
	const upload = useFileUpload({ maxFiles: 5 });
	useSimulatedUploads(upload);
	const choose = React.useCallback((): void => {
		upload.openPicker().catch((): void => {
			// The picker could not open: nothing was picked.
		});
	}, [upload]);
	return (
		<View className="gap-3">
			<Button label="Choose files" icon={UploadIcon} variant="outline" onPress={choose} />
			{upload.files.map((file: UploadFile): React.JSX.Element => (
				<View key={file.id} className="rounded-card gap-2 border border-border bg-card p-3">
					<View className="flex-row items-center gap-2">
						<Text numberOfLines={1} className="text-body font-sans-medium flex-1 text-foreground">
							{file.name}
						</Text>
						<Text className="text-caption font-sans text-muted-foreground">{file.size === null ? "" : formatFileSize(file.size)}</Text>
					</View>
					{file.status === "uploading" ? <Progress value={(file.progress ?? 0) * PERCENT} accessibilityLabel={`Uploading ${file.name}`} size="sm" /> : null}
					{file.status === "error" ? <Alert tone="error" message={file.error ?? "The upload failed."} /> : null}
					{file.status === "done" ? <Text className="text-caption font-sans text-success-foreground">Uploaded</Text> : null}
				</View>
			))}
		</View>
	);
}
