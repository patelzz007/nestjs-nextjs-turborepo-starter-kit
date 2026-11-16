import type * as React from "react";

import { CodeBlock, CodeBlockCopyButton, CodeBlockHeader, CodeBlockTitle, type CodeBlockDiffSpec } from "@workspace/ui/components/code-block";

const CODE = `export function getCacheKey(request: Request) {
  const url = new URL(request.url)
  return url.href
  url.searchParams.delete("utm_source")
  url.searchParams.delete("utm_medium")
  url.searchParams.sort()
  return url.toString()
}`;

/** Source line numbers the change adds and removes. */
const DIFF: CodeBlockDiffSpec = { added: [4, 5, 6, 7], removed: [3] };

export function CodeBlock5Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-2xl">
			<CodeBlock code={CODE} language="typescript" showLineNumbers diff={DIFF}>
				<CodeBlockHeader>
					<CodeBlockTitle>lib/cache-key.ts</CodeBlockTitle>
					<CodeBlockCopyButton className="ml-auto" />
				</CodeBlockHeader>
			</CodeBlock>
		</div>
	);
}
