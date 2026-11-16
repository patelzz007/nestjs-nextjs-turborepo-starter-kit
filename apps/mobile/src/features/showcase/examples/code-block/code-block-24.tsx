import { CodeBlock } from "@workspace/ui-native/components/code-block";
import * as React from "react";

import { snippet } from "./code-block-sample";

const REDUCE = snippet("reduce");
const FIXED = snippet("reduce-fixed");

// A failing line flagged with its reason; the ✦ in the gutter asks for a fix and the block takes it.
export function CodeBlock24Example(): React.JSX.Element {
	const [fixed, setFixed] = React.useState(false);
	const fix = React.useCallback((): void => {
		setFixed(true);
	}, []);
	const shown = fixed ? FIXED : REDUCE;
	return (
		<CodeBlock
			code={shown.code}
			lines={shown.lines}
			caption="total.ts"
			showLineNumbers
			lineMarks={fixed ? [{ line: 3, kind: "added" }] : [{ line: 3, kind: "error" }]}
			notes={fixed ? [{ line: 3, kind: "info", text: "Fixed: reduce starts from 0" }] : [{ line: 3, kind: "error", text: "Reduce of empty array with no initial value" }]}
			lineAction={fixed ? undefined : { sign: "✦", label: (line: number): string => `Fix line ${String(line)} with AI`, onPress: fix, lines: [3] }}
		/>
	);
}
