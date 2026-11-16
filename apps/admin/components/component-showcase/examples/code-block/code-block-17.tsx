"use client";

import * as React from "react";
import { useState } from "react";
import { Badge } from "@workspace/ui/components/badge";
import { CodeBlock, CodeBlockCopyButton, CodeBlockHeader, CodeBlockTitle, CodeBlockWrapToggle } from "@workspace/ui/components/code-block";

import { Separator } from "@workspace/ui/components/separator";

const code = `export const contentSecurityPolicy = "default-src 'self'; script-src 'self' 'nonce-{NONCE}' https://cdn.example.com; style-src 'self' 'nonce-{NONCE}'; img-src 'self' data: https://images.example.com; font-src 'self' data:; connect-src 'self' https://api.example.com"`;

export function CodeBlock17Example(): React.JSX.Element {
	// Controlled wrap: `wrap` plus `onWrapChange` moves the state up to the page,
	// so the toggle and the status chip read one value. `defaultWrap` would keep
	// it inside the block, leaving the header nothing to render.
	const [wrap, setWrap] = useState(true);

	return (
		<div className="w-full max-w-2xl">
			<CodeBlock code={code} language="typescript" wrap={wrap} onWrapChange={setWrap}>
				<CodeBlockHeader>
					<CodeBlockTitle>security-headers.ts</CodeBlockTitle>
					<div className="ml-auto flex items-center gap-1.5">
						<Badge variant="info-light">{wrap ? "Wrapped" : "Scrolling"}</Badge>
						<CodeBlockWrapToggle size="xs" />
						<Separator orientation="vertical" className="h-4" />
						<CodeBlockCopyButton />
					</div>
				</CodeBlockHeader>
			</CodeBlock>
		</div>
	);
}
