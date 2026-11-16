import { CodeBlock } from "@workspace/ui-native/components/code-block";
import * as React from "react";
import { Card, CardContent } from "@workspace/ui-native/components/card";
import { ScrollView } from "react-native";

import { snippet } from "./code-block-sample";

const FILES: readonly { readonly name: string; readonly snippet: ReturnType<typeof snippet> }[] = [
	{ name: "config.ts", snippet: snippet("files-a") },
	{ name: "retry.ts", snippet: snippet("files-b") },
	{ name: "retry.test.ts", snippet: snippet("files-c") },
];

// A card of three changed files that size to their content, scrolled together inside a fixed height.
export function CodeBlock26Example(): React.JSX.Element {
	return (
		<Card className="w-full">
			<CardContent className="px-0 pt-4">
				<ScrollView className="max-h-72" nestedScrollEnabled contentContainerClassName="gap-3 px-4">
					{FILES.map((file): React.JSX.Element => (
						<CodeBlock key={file.name} code={file.snippet.code} lines={file.snippet.lines} caption={file.name} size="sm" />
					))}
				</ScrollView>
			</CardContent>
		</Card>
	);
}
