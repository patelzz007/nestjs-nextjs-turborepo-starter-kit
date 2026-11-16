import { CodeBlock } from "@workspace/ui-native/components/code-block";
import * as React from "react";

import { snippet, useCopy } from "./code-block-sample";

const SESSION = snippet("session");

// A TypeScript snippet with line numbers, its language in the header and a copy button.
export function CodeBlock1Example(): React.JSX.Element {
	const { copied, copy } = useCopy(SESSION.code);
	return <CodeBlock code={SESSION.code} lines={SESSION.lines} language="TypeScript" caption="auth.ts" showLineNumbers onCopy={copy} copied={copied} />;
}
