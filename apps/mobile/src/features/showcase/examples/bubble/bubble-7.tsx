import { Bubble } from "@workspace/ui-native/components/bubble";
import { CodeBlock } from "@workspace/ui-native/components/code-block";
import * as React from "react";
import { Text, View } from "react-native";

const STEPS: readonly string[] = [
	"Create an API key under Settings › Developers.",
	"Store it as STRIPE_KEY in your environment.",
	"Restart the worker so it reads the new key.",
];

// An assistant answer across the row as real elements (a heading, a list, code), with no markdown parser.
export function Bubble7Example(): React.JSX.Element {
	return (
		<Bubble tone="ghost" className="max-w-full">
			<Text className="text-body-lg font-sans-semibold text-foreground">Connecting payments</Text>
			<View className="gap-1">
				{STEPS.map((step: string, index: number): React.JSX.Element => (
					<Text key={step} className="text-body font-sans text-foreground">{`${String(index + 1)}. ${step}`}</Text>
				))}
			</View>
			<CodeBlock code={"STRIPE_KEY=sk_live_…"} language="bash" />
		</Bubble>
	);
}
