import * as React from "react";
import { CodeBlock } from "@workspace/ui/components/code-block";

const COMMAND = "pnpm install && pnpm dev";

export function CodeBlockDont1Example(): React.JSX.Element {
	return <CodeBlock code={COMMAND} language="bash" className="w-full max-w-md" />;
}
