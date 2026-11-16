import SendIcon from "lucide-react-native/icons/send";
import { Bubble } from "@workspace/ui-native/components/bubble";
import { EmojiPicker } from "@workspace/ui-native/components/emoji-picker";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { Input } from "@workspace/ui-native/components/input";
import type { EmojiPickerSelection } from "@workspace/ui-native/lib/emoji-picker";
import * as React from "react";
import { ScrollView, type ScrollViewInstance, View } from "react-native";

import { ENGLISH_EMOJI } from "./emoji-data";

interface ChatMessage {
	readonly id: string;
	readonly text: string;
	readonly mine: boolean;
}

const THREAD: readonly ChatMessage[] = [
	{ id: "m1", text: "Lunch at the new ramen place? 🍜", mine: false },
	{ id: "m2", text: "Yes! 12:30?", mine: true },
];

export function EmojiPicker2Example(): React.JSX.Element {
	const [messages, setMessages] = React.useState<readonly ChatMessage[]>(THREAD);
	const [draft, setDraft] = React.useState("");
	const scrollRef = React.useRef<ScrollViewInstance>(null);
	const addEmoji = React.useCallback((selection: EmojiPickerSelection): void => {
		setDraft((text: string): string => text + selection.value);
	}, []);
	const send = React.useCallback((): void => {
		const text = draft.trim();
		if (text.length === 0) {
			return;
		}
		setMessages((current: readonly ChatMessage[]): readonly ChatMessage[] => [...current, { id: `m${String(current.length + 1)}`, text, mine: true }]);
		setDraft("");
	}, [draft]);
	const scrollToEnd = React.useCallback((): void => {
		scrollRef.current?.scrollToEnd({ animated: true });
	}, []);
	return (
		<View className="rounded-card h-96 gap-3 border border-border bg-card p-3">
			<ScrollView ref={scrollRef} onContentSizeChange={scrollToEnd} contentContainerClassName="gap-1.5">
				{messages.map((message: ChatMessage): React.JSX.Element => (
					<Bubble key={message.id} text={message.text} variant={message.mine ? "sent" : "received"} />
				))}
			</ScrollView>
			<View className="flex-row items-center gap-2">
				<EmojiPicker label="Emoji" data={ENGLISH_EMOJI} value={null} onSelect={addEmoji} keepOpen triggerVariant="ghost" />
				<Input value={draft} onChange={setDraft} placeholder="Message" accessibilityLabel="Message" returnKeyType="send" onSubmitEditing={send} className="flex-1" />
				<IconButton icon={SendIcon} label="Send" onPress={send} disabled={draft.trim().length === 0} />
			</View>
		</View>
	);
}
