import { Attachment } from "@workspace/ui-native/components/attachment";
import { Bubble } from "@workspace/ui-native/components/bubble";
import { Message } from "@workspace/ui-native/components/message";
import DownloadIcon from "lucide-react-native/icons/download";
import FileSpreadsheetIcon from "lucide-react-native/icons/file-spreadsheet";
import * as React from "react";
import { Image, View } from "react-native";

import { ignorePress } from "../example-support";

const PHOTO = { uri: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&h=400&q=80" };
const CSV = "q3-signups.csv";
const ACTIONS = [{ key: "download", label: `Download ${CSV}`, icon: DownloadIcon, onPress: ignorePress }];

// Files in a thread: a sent image above its caption, and a received spreadsheet under its text with a named download.
export function Message5Example(): React.JSX.Element {
	return (
		<View className="w-full gap-3">
			<Message variant="sent">
				<Image source={PHOTO} accessibilityLabel="The new hero background: soft blue waves" resizeMode="cover" className="h-36 w-56 rounded-2xl" />
				<Bubble variant="sent" text="New hero background — thoughts?" />
			</Message>
			<Message>
				<Bubble text="Love it. Here are the sign-ups you asked for." />
				<Attachment name={CSV} description="CSV · 88 KB" icon={FileSpreadsheetIcon} actions={ACTIONS} variant="muted" size="sm" />
			</Message>
		</View>
	);
}
