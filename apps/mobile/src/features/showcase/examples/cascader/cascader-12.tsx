import { Button } from "@workspace/ui-native/components/button";
import { Cascader } from "@workspace/ui-native/components/cascader";
import { Textarea } from "@workspace/ui-native/components/textarea";
import type { CascaderNode } from "@workspace/ui-native/lib/cascader";
import * as React from "react";
import { Text, View } from "react-native";

const TOPICS: readonly CascaderNode[] = [
	{
		value: "account",
		label: "Account",
		children: [
			{ value: "account.login", label: "Can't sign in" },
			{ value: "account.delete", label: "Delete my account" },
		],
	},
	{
		value: "billing",
		label: "Billing",
		children: [
			{ value: "billing.refund", label: "Refund" },
			{ value: "billing.invoice", label: "Invoice copy" },
		],
	},
	{ value: "bug", label: "Report a bug" },
];

interface Submitted {
	readonly topic: string;
	readonly message: string;
}

export function Cascader12Example(): React.JSX.Element {
	const [topic, setTopic] = React.useState<string | null>(null);
	const [message, setMessage] = React.useState("");
	const [tried, setTried] = React.useState(false);
	const [submitted, setSubmitted] = React.useState<Submitted | null>(null);
	const submit = React.useCallback((): void => {
		setTried(true);
		if (topic !== null) {
			setSubmitted({ topic, message });
		}
	}, [message, topic]);
	return (
		<View className="gap-3">
			<Cascader
				label="Topic"
				items={TOPICS}
				value={topic}
				onChange={setTopic}
				placeholder="Pick a topic"
				error={tried && topic === null ? "Pick a topic so we can route your request." : undefined}
			/>
			<Textarea value={message} onChange={setMessage} placeholder="Tell us more" accessibilityLabel="Message" />
			<Button label="Submit" onPress={submit} />
			<Text className="text-body font-mono text-muted-foreground">{submitted === null ? "Not submitted." : JSON.stringify(submitted)}</Text>
		</View>
	);
}
