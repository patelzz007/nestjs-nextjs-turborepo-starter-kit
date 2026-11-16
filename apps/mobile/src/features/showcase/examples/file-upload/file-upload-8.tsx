import ArrowDownIcon from "lucide-react-native/icons/arrow-down";
import ArrowUpIcon from "lucide-react-native/icons/arrow-up";
import ImagePlusIcon from "lucide-react-native/icons/image-plus";
import { Button } from "@workspace/ui-native/components/button";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import * as React from "react";
import { Text, View } from "react-native";
import { useFileUpload, type UploadFile } from "@workspace/ui-native/lib/use-file-upload";
import { Image } from "expo-image";

import { useSimulatedUploads } from "./file-upload-simulation";

interface OrderedImageProps {
	readonly file: UploadFile;
	readonly index: number;
	readonly count: number;
	readonly onMove: (id: string, toIndex: number) => void;
}

/** One image with the buttons that move it up or down the order. */
function OrderedImage({ file, index, count, onMove }: OrderedImageProps): React.JSX.Element {
	const moveUp = React.useCallback((): void => {
		onMove(file.id, index - 1);
	}, [file.id, index, onMove]);
	const moveDown = React.useCallback((): void => {
		onMove(file.id, index + 1);
	}, [file.id, index, onMove]);
	return (
		<View className="flex-row items-center gap-3">
			<Image source={file.uri} accessibilityLabel={file.name} contentFit="cover" className="size-14 rounded-lg" />
			<Text numberOfLines={1} className="text-body flex-1 font-sans text-foreground">
				{file.name}
			</Text>
			<IconButton icon={ArrowUpIcon} label={`Move ${file.name} up`} variant="ghost" size="sm" disabled={index === 0} onPress={moveUp} />
			<IconButton icon={ArrowDownIcon} label={`Move ${file.name} down`} variant="ghost" size="sm" disabled={index === count - 1} onPress={moveDown} />
		</View>
	);
}

export function FileUpload8Example(): React.JSX.Element {
	const upload = useFileUpload({ source: "images", maxFiles: 5 });
	useSimulatedUploads(upload);
	const choose = React.useCallback((): void => {
		upload.openPicker().catch((): void => {
			// The picker could not open: nothing was picked.
		});
	}, [upload]);
	return (
		<View className="gap-3">
			{upload.files.map((file: UploadFile, index: number): React.JSX.Element => (
				<OrderedImage key={file.id} file={file} index={index} count={upload.files.length} onMove={upload.moveFile} />
			))}
			<Button label="Add images" icon={ImagePlusIcon} variant="outline" onPress={choose} />
		</View>
	);
}
