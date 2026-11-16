import { Attachment } from "@workspace/ui-native/components/attachment";
import { Icon } from "@workspace/ui-native/components/icon";
import { getDocumentAsync } from "expo-document-picker";
import UploadIcon from "lucide-react-native/icons/upload";
import * as React from "react";
import { Pressable, Text, View } from "react-native";

import { fileIcon, formatBytes } from "./attachment-sample";

interface Picked {
	readonly name: string;
	readonly size: number;
	readonly uri: string;
	readonly image: boolean;
}

// A dashed card that opens the system file picker, then lists the picks with image previews and a remove on each.
export function Attachment6Example(): React.JSX.Element {
	const [files, setFiles] = React.useState<readonly Picked[]>([]);
	const pick = React.useCallback((): void => {
		getDocumentAsync({ multiple: true, copyToCacheDirectory: false })
			.then((result): void => {
				if (result.canceled) {
					return;
				}
				setFiles((current) => [
					...current,
					...result.assets.map((asset): Picked => ({ name: asset.name, size: asset.size ?? 0, uri: asset.uri, image: asset.mimeType?.startsWith("image/") === true })),
				]);
			})
			// A picker that fails to open leaves the tray as it was.
			.catch((): void => undefined);
	}, []);
	return (
		<View className="w-full gap-2">
			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Choose files"
				onPress={pick}
				className="items-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-6 active:bg-muted">
				<Icon icon={UploadIcon} size="md" colorClassName="accent-muted-foreground" />
				<Text className="text-label font-sans-medium text-foreground">Choose files</Text>
				<Text className="text-caption font-sans text-muted-foreground">PDF, images or spreadsheets</Text>
			</Pressable>
			{files.map((file: Picked): React.JSX.Element => (
				<PickedRow key={file.uri} file={file} onRemove={setFiles} />
			))}
		</View>
	);
}

function PickedRow({ file, onRemove }: { readonly file: Picked; readonly onRemove: React.Dispatch<React.SetStateAction<readonly Picked[]>> }): React.JSX.Element {
	const remove = React.useCallback((): void => {
		onRemove((current) => current.filter((item: Picked): boolean => item.uri !== file.uri));
	}, [file.uri, onRemove]);
	return (
		<Attachment
			name={file.name}
			description={formatBytes(file.size)}
			icon={fileIcon(file.name)}
			imageUri={file.image ? file.uri : undefined}
			size="sm"
			onRemove={remove}
			className="w-full"
		/>
	);
}
