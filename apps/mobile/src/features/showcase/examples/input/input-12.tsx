import { Button } from "@workspace/ui-native/components/button";
import { Field } from "@workspace/ui-native/components/field";
import * as React from "react";
import { useFileUpload } from "@workspace/ui-native/lib/use-file-upload";
import { Text, View } from "react-native";

/** The largest attachment, in bytes. */
const MAX_SIZE = 10 * 1024 * 1024;

export function Input12Example(): React.JSX.Element {
	const upload = useFileUpload({ maxFiles: 1, maxSize: MAX_SIZE });
	const choose = React.useCallback((): void => {
		upload.openPicker().catch((): void => {
			// The picker could not open: nothing was chosen.
		});
	}, [upload]);
	return (
		<Field label="Attachment" hint="One file, up to 10 MB.">
			<View className="rounded-button min-h-12 flex-row items-center gap-3 border border-input pr-3 pl-1">
				<Button label="Choose file" variant="secondary" size="sm" onPress={choose} />
				<Text numberOfLines={1} className="text-body flex-1 font-sans text-muted-foreground">
					{upload.files.at(0)?.name ?? "No file chosen"}
				</Text>
			</View>
		</Field>
	);
}
