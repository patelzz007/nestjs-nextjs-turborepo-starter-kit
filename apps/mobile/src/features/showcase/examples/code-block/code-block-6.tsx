import { CodeBlock } from "@workspace/ui-native/components/code-block";
import * as React from "react";
import type { CodeBlockLineMark } from "@workspace/ui-native/components/code-block";

import { snippet } from "./code-block-sample";

const DIFF = snippet("diff-total");
const MARKS: readonly CodeBlockLineMark[] = [
	{ line: 2, kind: "removed" },
	{ line: 3, kind: "removed" },
	{ line: 5, kind: "added" },
];

// Lines tagged as removed and added by the caller (the web does it with a Shiki transformer; the phone takes marks).
export function CodeBlock6Example(): React.JSX.Element {
	return <CodeBlock code={DIFF.code} lines={DIFF.lines} language="TypeScript" lineMarks={MARKS} />;
}
