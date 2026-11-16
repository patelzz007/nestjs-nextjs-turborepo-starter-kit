import * as React from "react";
import { CodeBlock, CodeBlockCopyButton, CodeBlockHeader, CodeBlockTitle } from "@workspace/ui/components/code-block";

const COMMAND = "pnpm install && pnpm dev";

export function CodeBlockDo1Example(): React.JSX.Element {
	return (
		<CodeBlock code={COMMAND} language="bash" className="w-full max-w-md">
			<CodeBlockHeader>
				<CodeBlockTitle>Terminal</CodeBlockTitle>
				<CodeBlockCopyButton className="ml-auto" />
			</CodeBlockHeader>
		</CodeBlock>
	);
}
