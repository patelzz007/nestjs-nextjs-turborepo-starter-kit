import { Bubble } from "@workspace/ui-native/components/bubble";
import * as React from "react";
import { View } from "react-native";

const CHOICES: readonly { readonly key: string; readonly label: string; readonly reply: string }[] = [
	{ key: "track", label: "Track my order", reply: "Your order is out for delivery and arrives by 6 pm." },
	{ key: "return", label: "Start a return", reply: "I've opened a return. A prepaid label is in your email." },
	{ key: "agent", label: "Talk to a person", reply: "Connecting you with Mia. Typical wait: 2 minutes." },
];

// Quick replies: the choices swap for the echoed pick and an answer written for it.
export function Bubble6Example(): React.JSX.Element {
	const [picked, setPicked] = React.useState<string | null>(null);
	const choice = CHOICES.find((candidate): boolean => candidate.key === picked);
	const reset = React.useCallback((): void => {
		setPicked(null);
	}, []);
	return (
		<View className="w-full gap-2">
			<Bubble text="Hi! What can I help with?" />
			{choice === undefined ? (
				<View className="flex-row flex-wrap justify-end gap-2">
					{CHOICES.map((option): React.JSX.Element => (
						<QuickReply key={option.key} value={option.key} label={option.label} onPick={setPicked} />
					))}
				</View>
			) : (
				<>
					<Bubble text={choice.label} variant="sent" />
					<Bubble text={choice.reply} />
					<Bubble text="Start over" tone="outline" variant="sent" onPress={reset} />
				</>
			)}
		</View>
	);
}

function QuickReply({ value, label, onPick }: { readonly value: string; readonly label: string; readonly onPick: (value: string) => void }): React.JSX.Element {
	const pick = React.useCallback((): void => {
		onPick(value);
	}, [onPick, value]);
	return <Bubble text={label} tone="outline" variant="sent" size="sm" onPress={pick} />;
}
