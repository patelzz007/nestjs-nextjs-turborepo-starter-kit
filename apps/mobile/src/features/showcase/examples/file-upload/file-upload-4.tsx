import ImagePlusIcon from "lucide-react-native/icons/image-plus";
import { Dialog } from "@workspace/ui-native/components/dialog";
import { Icon } from "@workspace/ui-native/components/icon";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { useFileUpload, type UploadFile } from "@workspace/ui-native/lib/use-file-upload";
import { Image } from "expo-image";

import { useSimulatedUploads } from "./file-upload-simulation";

interface ThumbnailProps {
	readonly file: UploadFile;
	readonly onOpen: (file: UploadFile) => void;
}

/** One photo of the gallery: tapping it opens it full size. */
function Thumbnail({ file, onOpen }: ThumbnailProps): React.JSX.Element {
	const open = React.useCallback((): void => {
		onOpen(file);
	}, [file, onOpen]);
	return (
		<Pressable accessibilityRole="imagebutton" accessibilityLabel={`Open ${file.name}`} onPress={open} className="size-20 overflow-hidden rounded-lg">
			<Image source={file.uri} accessibilityLabel={file.name} contentFit="cover" className="size-full" />
		</Pressable>
	);
}

export function FileUpload4Example(): React.JSX.Element {
	const upload = useFileUpload({ source: "images", maxFiles: 12 });
	useSimulatedUploads(upload);
	const [open, setOpen] = React.useState<UploadFile | null>(null);
	const choose = React.useCallback((): void => {
		upload.openPicker().catch((): void => {
			// The picker could not open: nothing was picked.
		});
	}, [upload]);
	const close = React.useCallback((): void => {
		setOpen(null);
	}, []);
	return (
		<View className="gap-3">
			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Add photos"
				onPress={choose}
				className="rounded-card h-28 items-center justify-center gap-1 border-2 border-dashed border-input bg-muted">
				<Icon icon={ImagePlusIcon} size="lg" colorClassName="accent-icon" />
				<Text className="text-body font-sans text-muted-foreground">Add photos</Text>
			</Pressable>
			<View className="flex-row flex-wrap gap-2">
				{upload.files.map((file: UploadFile): React.JSX.Element => (
					<Thumbnail key={file.id} file={file} onOpen={setOpen} />
				))}
			</View>
			<Dialog open={open !== null} onOpenChange={close}>
				{open === null ? null : <Image source={open.uri} accessibilityLabel={open.name} contentFit="contain" className="aspect-square w-full" />}
			</Dialog>
		</View>
	);
}
