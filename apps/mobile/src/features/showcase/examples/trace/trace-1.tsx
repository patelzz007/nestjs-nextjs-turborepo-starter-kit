import { CodeBlock, type CodeBlockLineMark } from "@workspace/ui-native/components/code-block";
import { Trace, TraceLine, TraceStep } from "@workspace/ui-native/components/trace";
import PencilIcon from "lucide-react-native/icons/pencil";
import SearchIcon from "lucide-react-native/icons/search";
import TerminalIcon from "lucide-react-native/icons/terminal";
import * as React from "react";

const PATCH = `export const csp = {
  frameSrc: ["'self'"],
  frameSrc: ["'self'", "*.stripe.com"],
  connectSrc: ["'self'", "*.stripe.com"],
}`;

/** Source lines the patch adds and removes. */
const PATCH_MARKS: readonly CodeBlockLineMark[] = [
	{ line: 2, kind: "removed" },
	{ line: 3, kind: "added" },
	{ line: 4, kind: "added" },
];

const TEST_OUTPUT = `✓ middleware/csp.test.ts (12 tests)
Tests  12 passed`;

const LINT_OUTPUT = `middleware/csp.ts
  14:7  error  'nonce' is unused`;

/** The lint error, by output line. */
const LINT_MARKS: readonly CodeBlockLineMark[] = [{ line: 2, kind: "error" }];

// Each title says what happened: the glyph is decorative, and the title is all a screen reader gets.
export function Trace1Example(): React.JSX.Element {
	return (
		<Trace accessibilityLabel="Agent steps">
			<TraceLine icon={SearchIcon} title="Searched the codebase for frameSrc" description="3 results" />
			<TraceStep icon={PencilIcon} title="Edited middleware/csp.ts" description="+2 -1" defaultOpen>
				<CodeBlock code={PATCH} language="typescript" lineMarks={PATCH_MARKS} caption="Patch for middleware/csp.ts" />
			</TraceStep>
			<TraceStep icon={TerminalIcon} title="Ran pnpm vitest run csp" description="12 passed">
				<CodeBlock code={TEST_OUTPUT} language="bash" caption="Test output" />
			</TraceStep>
			<TraceStep icon={TerminalIcon} title="pnpm lint failed with 1 error" status="error">
				<CodeBlock code={LINT_OUTPUT} language="bash" lineMarks={LINT_MARKS} caption="Lint output" />
			</TraceStep>
			<TraceLine icon={PencilIcon} title="Removing the unused nonce" status="running" />
		</Trace>
	);
}
