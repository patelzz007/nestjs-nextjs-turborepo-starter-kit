import { CodeBlock } from "@workspace/ui-native/components/code-block";
import * as React from "react";
import { Badge } from "@workspace/ui-native/components/badge";
import { Button } from "@workspace/ui-native/components/button";
import { View } from "react-native";

import { characterCount, revealLines, snippet } from "./code-block-sample";

const ROUTE = snippet("route");
const TOTAL = characterCount(ROUTE.lines);
const STEP = 3;
const TICK_MS = 28;

// An agent typing a route handler out three characters per tick under a Generating badge, then a Done one.
export function CodeBlock3Example(): React.JSX.Element {
	const [shown, setShown] = React.useState(0);
	const [run, setRun] = React.useState(0);
	React.useEffect((): (() => void) => {
		const timer = setInterval((): void => {
			setShown((current: number): number => Math.min(TOTAL, current + STEP));
		}, TICK_MS);
		return (): void => {
			clearInterval(timer);
		};
	}, [run]);
	const replay = React.useCallback((): void => {
		setShown(0);
		setRun((current: number): number => current + 1);
	}, []);
	const done = shown >= TOTAL;
	const badge = done ? <Badge label="Done" tone="success" variant="light" size="sm" /> : <Badge label="Generating" tone="info" variant="light" size="sm" />;
	return (
		<View className="w-full gap-2">
			<CodeBlock code={ROUTE.code} lines={revealLines(ROUTE.lines, shown)} caption="app/api/orders/route.ts" headerEnd={badge} />
			<Button label="Replay" variant="outline" size="xs" onPress={replay} disabled={!done} className="self-start" />
		</View>
	);
}
