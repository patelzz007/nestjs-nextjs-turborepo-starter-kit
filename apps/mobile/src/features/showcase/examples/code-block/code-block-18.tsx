import { CodeBlock } from "@workspace/ui-native/components/code-block";
import * as React from "react";
import { Badge } from "@workspace/ui-native/components/badge";
import type { CodeBlockLineMark } from "@workspace/ui-native/components/code-block";
import { View } from "react-native";

import { snippet } from "./code-block-sample";

const FILES: readonly { readonly name: string; readonly snippet: ReturnType<typeof snippet>; readonly marks: readonly CodeBlockLineMark[] }[] = [
	{
		name: "format.ts",
		snippet: snippet("patch-a"),
		marks: [
			{ line: 2, kind: "removed" },
			{ line: 3, kind: "added" },
		],
	},
	{
		name: "label.ts",
		snippet: snippet("patch-b"),
		marks: [
			{ line: 2, kind: "removed" },
			{ line: 3, kind: "added" },
		],
	},
];

// A two-file patch: one block per file, each with its added and removed counts.
export function CodeBlock18Example(): React.JSX.Element {
	return (
		<View className="w-full gap-3">
			{FILES.map((file): React.JSX.Element => (
				<CodeBlock
					key={file.name}
					code={file.snippet.code}
					lines={file.snippet.lines}
					caption={file.name}
					headerEnd={
						<View className="flex-row gap-1">
							<Badge label="+1" tone="success" variant="light" size="sm" />
							<Badge label="−1" tone="destructive" variant="light" size="sm" />
						</View>
					}
					showLineNumbers
					lineMarks={file.marks}
					size="sm"
				/>
			))}
		</View>
	);
}
