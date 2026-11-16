import { CodeBlock } from "@workspace/ui-native/components/code-block";
import * as React from "react";
import { Button } from "@workspace/ui-native/components/button";
import { Card, CardContent } from "@workspace/ui-native/components/card";
import { Text } from "react-native";

import { snippet } from "./code-block-sample";

const FIX = snippet("fix");

// An agent's fix in a card, with Reject and Accept in the block's footer.
export function CodeBlock22Example(): React.JSX.Element {
	const [decision, setDecision] = React.useState<"pending" | "accepted" | "rejected">("pending");
	const accept = React.useCallback((): void => {
		setDecision("accepted");
	}, []);
	const reject = React.useCallback((): void => {
		setDecision("rejected");
	}, []);
	const footer =
		decision === "pending" ? (
			<>
				<Button label="Reject" variant="ghost" size="sm" onPress={reject} />
				<Button label="Accept" size="sm" onPress={accept} />
			</>
		) : (
			<Text className="text-label font-sans text-muted-foreground">{decision === "accepted" ? "Fix applied" : "Fix rejected"}</Text>
		);
	return (
		<Card className="w-full">
			<CardContent className="gap-2 pt-4">
				<Text className="text-label font-sans text-foreground">Guard against an empty list before dividing.</Text>
				<CodeBlock code={FIX.code} lines={FIX.lines} caption="average.ts" lineMarks={[{ line: 2, kind: "added" }]} footer={footer} variant="card" />
			</CardContent>
		</Card>
	);
}
