import UserIcon from "lucide-react-native/icons/user";
import { Button } from "@workspace/ui-native/components/button";
import { Icon } from "@workspace/ui-native/components/icon";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { useFileUpload } from "@workspace/ui-native/lib/use-file-upload";
import { Image } from "expo-image";

import { useSimulatedUploads } from "./file-upload-simulation";

const MAX_SIZE = 2 * 1024 * 1024;

export function FileUpload2Example(): React.JSX.Element {
	const upload = useFileUpload({ source: "images", maxFiles: 1, maxSize: MAX_SIZE });
	useSimulatedUploads(upload);
	const choose = React.useCallback((): void => {
		upload.openPicker().catch((): void => {
			// The picker could not open: nothing was picked.
		});
	}, [upload]);
	const avatar = upload.files.at(0);
	return (
		<View className="items-center gap-2">
			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Change the profile picture"
				onPress={choose}
				className="size-24 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-input bg-muted">
				{avatar === undefined ? (
					<Icon icon={UserIcon} size="xl" colorClassName="accent-icon" />
				) : (
					<Image source={avatar.uri} accessibilityLabel="Profile picture" contentFit="cover" className="size-full" />
				)}
			</Pressable>
			{avatar === undefined ? null : <Button label="Remove" variant="ghost" size="xs" onPress={upload.clearFiles} />}
			<Text className="text-caption font-sans text-muted-foreground">Square, up to 2 MB.</Text>
			{upload.errors.map((error: string): React.JSX.Element => (
				<Text key={error} className="text-body font-sans text-destructive-foreground">
					{error}
				</Text>
			))}
		</View>
	);
}
