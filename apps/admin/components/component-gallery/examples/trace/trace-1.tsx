import { PencilIcon, SearchIcon, TerminalIcon } from "lucide-react";
import type * as React from "react";

import { CodeBlock, type CodeBlockDiffSpec, type CodeBlockLevelSpec } from "@workspace/ui/components/code-block";
import { Trace, TraceCollapsible, TraceCollapsibleContent, TraceCollapsibleTrigger, TraceDescription, TraceIcon, TraceLine, TraceTitle } from "@workspace/ui/components/trace";

const patch = `export const csp = {
  frameSrc: ["'self'"],
  frameSrc: ["'self'", "*.stripe.com"],
  connectSrc: ["'self'", "*.stripe.com"],
}`;

/** Source lines the patch adds and removes. */
const PATCH_DIFF: CodeBlockDiffSpec = { added: [3, 4], removed: [2] };

const testOutput = `✓ middleware/csp.test.ts (12 tests)
Tests  12 passed`;

const lintOutput = `middleware/csp.ts
  14:7  error  'nonce' is unused`;

/** The lint error, by output line. */
const LINT_LEVELS: CodeBlockLevelSpec = { error: [2] };

// Each title says what happened, because TraceIcon is hidden from assistive
// tech and the title is all a screen reader gets.
export function Trace1Example(): React.JSX.Element {
	return (
		// Trace sizes its rows; the root sets the size of what they expand to.
		<div className="w-full max-w-md text-sm">
			<Trace>
				<TraceLine>
					<TraceIcon>
						<SearchIcon />
					</TraceIcon>
					<TraceTitle>Searched the codebase for frameSrc</TraceTitle>
					<TraceDescription>3 results</TraceDescription>
				</TraceLine>
				<TraceCollapsible defaultOpen>
					<TraceCollapsibleTrigger>
						<TraceLine>
							<TraceIcon>
								<PencilIcon />
							</TraceIcon>
							<TraceTitle>Edited middleware/csp.ts</TraceTitle>
							<TraceDescription>+2 -1</TraceDescription>
						</TraceLine>
					</TraceCollapsibleTrigger>
					<TraceCollapsibleContent>
						<CodeBlock code={patch} language="typescript" diff={PATCH_DIFF} label="Patch for middleware/csp.ts" />
					</TraceCollapsibleContent>
				</TraceCollapsible>
				<TraceCollapsible>
					<TraceCollapsibleTrigger>
						<TraceLine>
							<TraceIcon>
								<TerminalIcon />
							</TraceIcon>
							<TraceTitle>Ran pnpm vitest run csp</TraceTitle>
							<TraceDescription>12 passed</TraceDescription>
						</TraceLine>
					</TraceCollapsibleTrigger>
					<TraceCollapsibleContent>
						<CodeBlock code={testOutput} language="bash" highlight={false} label="Test output" />
					</TraceCollapsibleContent>
				</TraceCollapsible>
				<TraceCollapsible>
					<TraceCollapsibleTrigger>
						<TraceLine status="error">
							<TraceIcon>
								<TerminalIcon />
							</TraceIcon>
							<TraceTitle>pnpm lint failed with 1 error</TraceTitle>
						</TraceLine>
					</TraceCollapsibleTrigger>
					<TraceCollapsibleContent>
						<CodeBlock code={lintOutput} language="bash" lineLevels={LINT_LEVELS} label="Lint output" />
					</TraceCollapsibleContent>
				</TraceCollapsible>
				<TraceLine status="running">
					<TraceIcon>
						<PencilIcon />
					</TraceIcon>
					<TraceTitle>Removing the unused nonce</TraceTitle>
				</TraceLine>
			</Trace>
		</div>
	);
}
