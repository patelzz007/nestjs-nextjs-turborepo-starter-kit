import { Attachment } from "@workspace/ui-native/components/attachment";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { Textarea } from "@workspace/ui-native/components/textarea";
import PaperclipIcon from "lucide-react-native/icons/paperclip";
import * as React from "react";
import { ScrollView, Text, View } from "react-native";

import { fileIcon } from "./attachment-sample";

const START: readonly string[] = ["churn-drivers.csv", "checkout-latency.png", "rate-limits.md"];
const MORE: readonly string[] = ["pricing-tiers-v4.xlsx", "session-replay.mp4", "invoice-3182.pdf"];

// A message box topped by small removable chips that scroll sideways; the paperclip adds a file and the count is announced.
export function Attachment2Example(): React.JSX.Element {
	const [files, setFiles] = React.useState<readonly string[]>(START);
	const [text, setText] = React.useState("");
	const add = React.useCallback((): void => {
		setFiles((current) => {
			const next = MORE.find((name: string): boolean => !current.includes(name));
			return next === undefined ? current : [...current, next];
		});
	}, []);
	return (
		<View className="w-full gap-2 rounded-xl border border-input p-2">
			<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
				{files.map((name: string): React.JSX.Element => (
					<Chip key={name} name={name} onRemove={setFiles} />
				))}
			</ScrollView>
			<Textarea value={text} onChange={setText} accessibilityLabel="Message" placeholder="Ask about these files" />
			<View className="flex-row items-center justify-between">
				<IconButton icon={PaperclipIcon} label="Attach a file" onPress={add} variant="ghost" size="sm" />
				<Text accessibilityLiveRegion="polite" className="text-caption font-sans text-muted-foreground">
					{files.length === 1 ? "1 file attached" : `${String(files.length)} files attached`}
				</Text>
			</View>
		</View>
	);
}

function Chip({ name, onRemove }: { readonly name: string; readonly onRemove: React.Dispatch<React.SetStateAction<readonly string[]>> }): React.JSX.Element {
	const remove = React.useCallback((): void => {
		onRemove((current) => current.filter((file: string): boolean => file !== name));
	}, [name, onRemove]);
	return <Attachment name={name} icon={fileIcon(name)} size="xs" variant="muted" onRemove={remove} />;
}
