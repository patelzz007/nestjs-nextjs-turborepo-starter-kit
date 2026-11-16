import { CodeBlock } from "@workspace/ui-native/components/code-block";
import * as React from "react";
import type { CodeBlockLine } from "@workspace/ui-native/components/code-block";

const CODE = "for item in cart:\n    if item.free:\n        continue\n    yield item";
const LINES: readonly CodeBlockLine[] = [
	[{ text: "for", role: "keyword" }, { text: " item " }, { text: "in", role: "keyword" }, { text: " cart:" }],
	[{ text: "    " }, { text: "if", role: "keyword" }, { text: " item.free:" }],
	[{ text: "        " }, { text: "continue", role: "keyword" }],
	[{ text: "    " }, { text: "yield", role: "keyword" }, { text: " item" }],
];

// Hand-built tokens: four Python keywords coloured by the caller, passed as lines.
export function CodeBlock15Example(): React.JSX.Element {
	return <CodeBlock code={CODE} lines={LINES} language="Python" />;
}
