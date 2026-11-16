import { CodeBlock } from "@workspace/ui-native/components/code-block";
import * as React from "react";
import { Badge } from "@workspace/ui-native/components/badge";
import type { CodeBlockLine } from "@workspace/ui-native/components/code-block";

const LINES: readonly CodeBlockLine[] = [
	[{ text: " ✓ ", role: "green" }, { text: "cart.test.ts " }, { text: "(12 tests) 38ms", role: "dim" }],
	[{ text: " ✓ ", role: "green" }, { text: "price.test.ts " }, { text: "(4 tests) 9ms", role: "dim" }],
	[{ text: " ✗ ", role: "red" }, { text: "checkout.test.ts " }, { text: "(1 failed)", role: "red" }],
	[],
	[{ text: " Tests  ", role: "dim" }, { text: "1 failed", role: "red" }, { text: " | " }, { text: "16 passed", role: "green" }],
];
const CODE = LINES.map((line) => line.map((token) => token.text).join("")).join("\n");

// A test log built token by token: passes in green, a failure in red, timings dimmed.
export function CodeBlock21Example(): React.JSX.Element {
	return <CodeBlock code={CODE} lines={LINES} header={<Badge label="vitest" variant="light" size="sm" />} size="sm" />;
}
