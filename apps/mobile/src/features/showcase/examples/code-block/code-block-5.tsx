import { CodeBlock } from "@workspace/ui-native/components/code-block";
import * as React from "react";
import { Badge } from "@workspace/ui-native/components/badge";
import type { CodeBlockLineMark } from "@workspace/ui-native/components/code-block";
import { View } from "react-native";

import { snippet } from "./code-block-sample";

const DIFF = snippet("diff-total");
const MARKS: readonly CodeBlockLineMark[] = [
	{ line: 2, kind: "removed" },
	{ line: 3, kind: "removed" },
	{ line: 4, kind: "removed" },
	{ line: 5, kind: "added" },
];

// A diff: removed and added lines marked by number, with the change summed up in the header.
export function CodeBlock5Example(): React.JSX.Element {
	const summary = (
		<View className="flex-row gap-1">
			<Badge label="+1" tone="success" variant="light" size="sm" />
			<Badge label="−3" tone="destructive" variant="light" size="sm" />
		</View>
	);
	return <CodeBlock code={DIFF.code} lines={DIFF.lines} caption="total.ts" headerEnd={summary} showLineNumbers lineMarks={MARKS} />;
}
