import { CodeBlock } from "@workspace/ui-native/components/code-block";
import * as React from "react";
import { Badge } from "@workspace/ui-native/components/badge";
import { Button } from "@workspace/ui-native/components/button";
import { View } from "react-native";

import { ignorePress } from "../example-support";
import { snippet } from "./code-block-sample";

const CHECKOUT = snippet("checkout");

// Line selection: tap numbers to pick lines, a badge counts them, and the pick can be sent with a question.
export function CodeBlock12Example(): React.JSX.Element {
	const [selected, setSelected] = React.useState<readonly number[]>([3, 4]);
	const toggle = React.useCallback((line: number): void => {
		setSelected((current) => (current.includes(line) ? current.filter((candidate: number): boolean => candidate !== line) : [...current, line].sort((a, b) => a - b)));
	}, []);
	const clear = React.useCallback((): void => {
		setSelected([]);
	}, []);
	const count = <Badge label={`${String(selected.length)} selected`} variant="light" tone="primary" size="sm" />;
	return (
		<View className="w-full gap-2">
			<CodeBlock code={CHECKOUT.code} lines={CHECKOUT.lines} caption="checkout.ts" headerEnd={count} showLineNumbers selectedLines={selected} onLinePress={toggle} />
			<View className="flex-row gap-2">
				<Button label="Ask about these lines" size="sm" onPress={ignorePress} disabled={selected.length === 0} />
				<Button label="Clear" variant="ghost" size="sm" onPress={clear} disabled={selected.length === 0} />
			</View>
		</View>
	);
}
