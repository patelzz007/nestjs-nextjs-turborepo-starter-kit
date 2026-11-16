import { Attachment } from "@workspace/ui-native/components/attachment";
import { Bubble } from "@workspace/ui-native/components/bubble";
import DownloadIcon from "lucide-react-native/icons/download";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";
import { fileIcon } from "./attachment-sample";

const NAME = "dispute-evidence.pdf";
const ACTIONS = [{ key: "download", label: `Download ${NAME}`, icon: DownloadIcon, onPress: ignorePress }];

// An assistant reply with the report it made: a full-width card with the file's type and size and a download.
export function Attachment1Example(): React.JSX.Element {
	return (
		<View className="w-full gap-2">
			<Bubble tone="ghost" text="I gathered the order, the delivery scan and the chat history into one evidence pack for the dispute." />
			<Attachment
				name={NAME}
				description="PDF · 2.4 MB · 6 pages"
				icon={fileIcon(NAME)}
				actions={ACTIONS}
				onPress={ignorePress}
				accessibilityHint="Opens the file"
				className="w-full"
			/>
			<Text className="text-caption font-sans text-muted-foreground">Generated just now</Text>
		</View>
	);
}
