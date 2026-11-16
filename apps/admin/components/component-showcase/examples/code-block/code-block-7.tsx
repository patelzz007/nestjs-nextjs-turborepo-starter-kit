import type * as React from "react";

import { CodeBlock, CodeBlockCopyButton, CodeBlockHeader, CodeBlockTitle, type CodeBlockWordSpec } from "@workspace/ui/components/code-block";

const CODE = `const client = createClient({
  url: process.env.DATABASE_URL,
  maxConnections: 20,
  idleTimeoutMillis: 30000,
})

await client.connect()`;

/** The pool options, by source line. */
const HIGHLIGHTED_LINES = "2-4";
const HIGHLIGHTED_WORDS: CodeBlockWordSpec[] = ["createClient", "maxConnections"];

export function CodeBlock7Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-2xl">
			<CodeBlock code={CODE} language="typescript" showLineNumbers highlightedLines={HIGHLIGHTED_LINES} highlightedWords={HIGHLIGHTED_WORDS}>
				<CodeBlockHeader>
					<CodeBlockTitle>db/client.ts</CodeBlockTitle>
					<CodeBlockCopyButton className="ml-auto" />
				</CodeBlockHeader>
			</CodeBlock>
		</div>
	);
}
