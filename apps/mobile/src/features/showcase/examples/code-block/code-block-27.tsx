import { CodeBlock } from "@workspace/ui-native/components/code-block";
import * as React from "react";
import { Badge } from "@workspace/ui-native/components/badge";
import { ansiToCodeLines } from "@workspace/ui-native/lib/code-block";

const ESC = "\u001b[";
const STDOUT = [
	`${ESC}32m ✓${ESC}0m cart.test.ts ${ESC}2m(12 tests) 38ms${ESC}22m`,
	`${ESC}31m ✗${ESC}0m checkout.test.ts ${ESC}31m(1 failed)${ESC}0m`,
	"",
	`${ESC}1m Tests ${ESC}22m ${ESC}31m1 failed${ESC}39m | ${ESC}32m16 passed${ESC}39m`,
].join("\n");
const LINES = ansiToCodeLines(STDOUT);
/** What is copied: the text without its escapes. */
const PLAIN = LINES.map((line) => line.map((token) => token.text).join("")).join("\n");

// Test output with raw colour escapes, turned into coloured tokens by ansiToCodeLines.
export function CodeBlock27Example(): React.JSX.Element {
	return <CodeBlock code={PLAIN} lines={LINES} header={<Badge label="stdout" variant="light" size="sm" />} size="sm" />;
}
