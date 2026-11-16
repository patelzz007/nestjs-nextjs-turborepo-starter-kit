import { Bubble } from "@workspace/ui-native/components/bubble";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { Message } from "@workspace/ui-native/components/message";
import { Toggle } from "@workspace/ui-native/components/toggle";
import * as Clipboard from "expo-clipboard";
import CheckIcon from "lucide-react-native/icons/check";
import CopyIcon from "lucide-react-native/icons/copy";
import RefreshCwIcon from "lucide-react-native/icons/refresh-cw";
import ThumbsDownIcon from "lucide-react-native/icons/thumbs-down";
import ThumbsUpIcon from "lucide-react-native/icons/thumbs-up";
import * as React from "react";

const DRAFTS: readonly string[] = [
	"Your refund was approved and will reach your card in 3–5 working days.",
	"Good news: the refund is approved. Expect it on your card within 5 working days.",
];
type Vote = "up" | "down" | null;
/** How long Copy shows its check. */
const COPIED_MS = 1500;

// Reply actions in the footer: regenerate cycles stored drafts and clears the vote, Copy flips to a check, votes toggle.
export function Message4Example(): React.JSX.Element {
	const [draft, setDraft] = React.useState(0);
	const [vote, setVote] = React.useState<Vote>(null);
	const [copied, setCopied] = React.useState(false);
	const text = DRAFTS.at(draft) ?? "";
	const regenerate = React.useCallback((): void => {
		setDraft((current: number): number => (current + 1) % DRAFTS.length);
		setVote(null);
	}, []);
	const copy = React.useCallback((): void => {
		Clipboard.setStringAsync(text)
			.then((): void => {
				setCopied(true);
				setTimeout((): void => {
					setCopied(false);
				}, COPIED_MS);
			})
			// A refused copy leaves the button as it was.
			.catch((): void => undefined);
	}, [text]);
	const up = React.useCallback((pressed: boolean): void => {
		setVote(pressed ? "up" : null);
	}, []);
	const down = React.useCallback((pressed: boolean): void => {
		setVote(pressed ? "down" : null);
	}, []);
	const footer = (
		<>
			<IconButton icon={RefreshCwIcon} label="Regenerate" onPress={regenerate} variant="ghost" size="xs" />
			<IconButton icon={copied ? CheckIcon : CopyIcon} label={copied ? "Copied" : "Copy"} onPress={copy} variant="ghost" size="xs" />
			<Toggle label="Good answer" icon={ThumbsUpIcon} hideLabel pressed={vote === "up"} onChange={up} size="sm" />
			<Toggle label="Bad answer" icon={ThumbsDownIcon} hideLabel pressed={vote === "down"} onChange={down} size="sm" />
		</>
	);
	return (
		<Message footer={footer} className="w-full">
			<Bubble tone="ghost" text={text} />
		</Message>
	);
}
