import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";
import { Text, View } from "react-native";
import { useFileUpload } from "@workspace/ui-native/lib/use-file-upload";

export function FileUploadDo1Example(): React.JSX.Element {
	const upload = useFileUpload({ accept: ["application/pdf"] });
	const choose = React.useCallback((): void => {
		upload.openPicker().catch((): void => {
			// Nothing was picked.
		});
	}, [upload]);
	return (
		<View className="gap-1">
			<Button label="Choose file" variant="outline" onPress={choose} />
			<Text className="text-caption font-sans text-muted-foreground">PDF, up to 10 MB.</Text>
		</View>
	);
}
