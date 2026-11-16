import { CodeBlock } from "@workspace/ui-native/components/code-block";
import { Trace, TraceLine } from "@workspace/ui-native/components/trace";
import TerminalIcon from "lucide-react-native/icons/terminal";
import * as React from "react";

const OUTPUT = "✓ middleware/csp.test.ts (12 tests)\nTests  12 passed";

// The output always on show: a long run becomes a wall of logs between its steps.
export function TraceDont2Example(): React.JSX.Element {
	return (
		<Trace>
			<TraceLine icon={TerminalIcon} title="Ran pnpm vitest run csp" description="12 passed" />
			<CodeBlock code={OUTPUT} language="bash" caption="Test output" />
		</Trace>
	);
}
