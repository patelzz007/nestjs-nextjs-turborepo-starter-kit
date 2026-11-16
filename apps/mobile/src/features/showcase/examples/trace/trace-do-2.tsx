import { CodeBlock } from "@workspace/ui-native/components/code-block";
import { Trace, TraceStep } from "@workspace/ui-native/components/trace";
import TerminalIcon from "lucide-react-native/icons/terminal";
import * as React from "react";

const OUTPUT = "✓ middleware/csp.test.ts (12 tests)\nTests  12 passed";

export function TraceDo2Example(): React.JSX.Element {
	return (
		<Trace>
			<TraceStep icon={TerminalIcon} title="Ran pnpm vitest run csp" description="12 passed">
				<CodeBlock code={OUTPUT} language="bash" caption="Test output" />
			</TraceStep>
		</Trace>
	);
}
