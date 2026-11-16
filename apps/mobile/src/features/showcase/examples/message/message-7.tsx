import { Bubble } from "@workspace/ui-native/components/bubble";
import { Button } from "@workspace/ui-native/components/button";
import { Message } from "@workspace/ui-native/components/message";
import { Spinner } from "@workspace/ui-native/components/spinner";
import * as React from "react";
import { Text, View } from "react-native";

const ANSWER = "Your trial ends on Friday. Upgrade before then to keep your projects and invites; nothing is deleted if you wait, but editing pauses.";
/** Characters revealed per tick, and the tick, as on the web. */
const STEP = 4;
const TICK_MS = 28;
const PENDING_MS = 900;

// A streaming reply: a spinner line while pending, then text revealed four characters at a time behind a caret.
export function Message7Example(): React.JSX.Element {
	const [shown, setShown] = React.useState(-1);
	const [run, setRun] = React.useState(0);
	React.useEffect((): (() => void) => {
		const start = setTimeout((): void => {
			setShown(0);
		}, PENDING_MS);
		const timer = setInterval((): void => {
			setShown((current: number): number => (current < 0 ? current : Math.min(ANSWER.length, current + STEP)));
		}, TICK_MS);
		return (): void => {
			clearTimeout(start);
			clearInterval(timer);
		};
	}, [run]);
	const replay = React.useCallback((): void => {
		setShown(-1);
		setRun((current: number): number => current + 1);
	}, []);
	const done = shown >= ANSWER.length;
	return (
		<View className="w-full gap-2">
			<Message>
				{shown < 0 ? (
					<View accessibilityLiveRegion="polite" className="flex-row items-center gap-2 px-1">
						<Spinner size="sm" accessibilityLabel="Writing a reply" />
						<Text className="text-label font-sans text-muted-foreground">Writing…</Text>
					</View>
				) : (
					<Bubble tone="ghost" text={`${ANSWER.slice(0, shown)}${done ? "" : "▍"}`} accessibilityLabel={done ? ANSWER : "Writing a reply"} />
				)}
			</Message>
			<Button label="Replay" variant="outline" size="xs" onPress={replay} disabled={!done} className="self-start" />
		</View>
	);
}
