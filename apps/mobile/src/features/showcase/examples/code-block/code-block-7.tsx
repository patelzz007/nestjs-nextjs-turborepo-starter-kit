import { CodeBlock } from "@workspace/ui-native/components/code-block";
import * as React from "react";
import type { CodeBlockLineMark } from "@workspace/ui-native/components/code-block";
import type { CodeHighlight } from "@workspace/ui-native/lib/code-block";

import { snippet } from "./code-block-sample";

const CONFIG = snippet("config");
const MARKS: readonly CodeBlockLineMark[] = [2, 3, 4].map((line: number): CodeBlockLineMark => ({ line, kind: "highlight" }));
const WORDS: readonly CodeHighlight[] = [{ text: "process.env" }, { text: "ssl", caseSensitive: true }];

// Lines 2 to 4 tinted, and two words marked wherever they appear.
export function CodeBlock7Example(): React.JSX.Element {
	return <CodeBlock code={CONFIG.code} lines={CONFIG.lines} caption="database.ts" showLineNumbers lineMarks={MARKS} highlights={WORDS} />;
}
