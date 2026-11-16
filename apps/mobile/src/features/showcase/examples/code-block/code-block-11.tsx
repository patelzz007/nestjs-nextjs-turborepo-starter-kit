import { CodeBlock } from "@workspace/ui-native/components/code-block";
import * as React from "react";
import { Badge } from "@workspace/ui-native/components/badge";
import type { CodeBlockLineMark } from "@workspace/ui-native/components/code-block";
import type { CodeNote } from "@workspace/ui-native/lib/code-block";
import { View } from "react-native";

import { snippet, useCopy } from "./code-block-sample";

const VALIDATE = snippet("validate");
const MARKS: readonly CodeBlockLineMark[] = [
	{ line: 2, kind: "error" },
	{ line: 4, kind: "warning" },
];
const NOTES: readonly CodeNote[] = [
	{ line: 2, kind: "error", text: "reduce has no initial value: an empty order throws" },
	{ line: 4, kind: "warning", text: "applyCoupon returns a promise that is never awaited" },
];

// An error line and a warning line, each with its note, tallied in the header.
export function CodeBlock11Example(): React.JSX.Element {
	const { copied, copy } = useCopy(VALIDATE.code);
	const tally = (
		<View className="flex-row gap-1">
			<Badge label="1 error" tone="destructive" variant="light" size="sm" />
			<Badge label="1 warning" tone="warning" variant="light" size="sm" />
		</View>
	);
	return (
		<CodeBlock
			code={VALIDATE.code}
			lines={VALIDATE.lines}
			caption="order.ts"
			headerEnd={tally}
			showLineNumbers
			lineMarks={MARKS}
			notes={NOTES}
			onCopy={copy}
			copied={copied}
		/>
	);
}
