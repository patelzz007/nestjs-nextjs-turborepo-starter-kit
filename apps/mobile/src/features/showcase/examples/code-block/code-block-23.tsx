import { CodeBlock } from "@workspace/ui-native/components/code-block";
import * as React from "react";
import type { CodeFold } from "@workspace/ui-native/lib/code-block";

import { snippet } from "./code-block-sample";

const SYNC = snippet("sync");
const FOLDS: readonly CodeFold[] = [
	{ start: 1, end: 13 },
	{ start: 2, end: 12 },
	{ start: 3, end: 5 },
	{ start: 5, end: 11 },
	{ start: 8, end: 10 },
];

// Nested folding: five regions fold from their first line's number; the inner branch opens folded.
export function CodeBlock23Example(): React.JSX.Element {
	const [folded, setFolded] = React.useState<readonly number[]>([8]);
	const toggle = React.useCallback((start: number): void => {
		setFolded((current) => (current.includes(start) ? current.filter((line: number): boolean => line !== start) : [...current, start]));
	}, []);
	return <CodeBlock code={SYNC.code} lines={SYNC.lines} caption="sync.ts" showLineNumbers folds={FOLDS} folded={folded} onFoldToggle={toggle} />;
}
