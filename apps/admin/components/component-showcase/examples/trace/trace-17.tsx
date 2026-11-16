"use client";

import { BugIcon, CircleCheckIcon, GitPullRequestArrowIcon, LockIcon, MessageSquareTextIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@workspace/ui/components/button";
import { CodeBlock, type CodeBlockDiffSpec } from "@workspace/ui/components/code-block";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@workspace/ui/components/sheet";
import { Trace, TraceCollapsible, TraceCollapsibleContent, TraceCollapsibleTrigger, TraceDescription, TraceIcon, TraceLine, TraceTitle } from "@workspace/ui/components/trace";

type Kind = "bug" | "security";

interface Finding {
	readonly id: string;
	readonly kind: Kind;
	readonly title: string;
	readonly fixed: string;
	readonly file: string;
	readonly line: number;
	readonly explanation: string;
	readonly code: string;
	// The line within `code` the comment is about, 1-based.
	readonly focus: number;
	readonly suggestion: string;
	readonly diff: CodeBlockDiffSpec;
}

const FINDINGS: readonly Finding[] = [
	{
		id: "null-user",
		kind: "bug",
		title: "Null user in getInvoice",
		fixed: "Guarded the null user",
		file: "lib/billing/invoice.ts",
		line: 42,
		explanation: "getUser returns null for a deleted account, and the export job runs for those too.",
		code: `const user = await getUser(userId)
return user.invoices.find((i) => i.id === id)`,
		focus: 2,
		suggestion: `const user = await getUser(userId)
if (!user) throw new NotFoundError("user")
return user.invoices.find((i) => i.id === id)`,
		diff: { added: [2], removed: [] },
	},
	{
		id: "password-log",
		kind: "security",
		title: "Password in the error log",
		fixed: "Dropped the password from the log",
		file: "lib/auth/login.ts",
		line: 17,
		explanation: "Log lines are shipped to a third party and kept for 30 days.",
		code: `logger.error("login failed", { email, password })`,
		focus: 1,
		suggestion: `logger.error("login failed", { email, password })
logger.error("login failed", { email })`,
		diff: { added: [2], removed: [1] },
	},
];

type Resolution = "applied" | "dismissed";

type Resolutions = Readonly<Partial<Record<string, Resolution>>>;

/** `lib/billing/invoice.ts` and line 42 read `invoice.ts:42`. */
function shortLocation(file: string, line: number): string {
	const basename = file.split("/").pop() ?? file;
	return `${basename}:${String(line)}`;
}

function rowTitle(finding: Finding, resolution: Resolution | undefined): string {
	if (resolution === "applied") {
		return finding.fixed;
	}
	return resolution === "dismissed" ? `Dismissed: ${finding.title}` : finding.title;
}

// The Sheet returns focus to the row it opened from, which then says what
// happened to the comment.
export function Trace17Example(): React.JSX.Element {
	const [openId, setOpenId] = React.useState<string | null>(null);
	const [resolved, setResolved] = React.useState<Resolutions>({});

	const remaining = FINDINGS.filter((finding: Finding): boolean => resolved[finding.id] === undefined).length;

	const handleOpenChange = React.useCallback((id: string, open: boolean): void => {
		setOpenId(open ? id : null);
	}, []);

	const handleResolve = React.useCallback((id: string, resolution: Resolution): void => {
		setResolved((current: Resolutions): Resolutions => ({ ...current, [id]: resolution }));
		setOpenId(null);
	}, []);

	return (
		<div className="flex w-full max-w-md flex-col gap-4 text-sm">
			<Trace>
				<TraceLine>
					<TraceIcon>
						<GitPullRequestArrowIcon />
					</TraceIcon>
					<TraceTitle>Reviewed 6 changed files</TraceTitle>
					<TraceDescription>+214 -38</TraceDescription>
				</TraceLine>
				<TraceCollapsible defaultOpen>
					<TraceCollapsibleTrigger>
						<TraceLine>
							<TraceIcon>
								<MessageSquareTextIcon />
							</TraceIcon>
							<TraceTitle>Left {FINDINGS.length} comments</TraceTitle>
							<TraceDescription>{remaining} open</TraceDescription>
						</TraceLine>
					</TraceCollapsibleTrigger>
					<TraceCollapsibleContent>
						<Trace>
							{FINDINGS.map((finding: Finding): React.JSX.Element => (
								<FindingRow
									key={finding.id}
									finding={finding}
									resolution={resolved[finding.id]}
									isOpen={openId === finding.id}
									onOpenChange={handleOpenChange}
									onResolve={handleResolve}
								/>
							))}
						</Trace>
					</TraceCollapsibleContent>
				</TraceCollapsible>
			</Trace>
		</div>
	);
}

interface FindingRowProps {
	readonly finding: Finding;
	readonly resolution: Resolution | undefined;
	readonly isOpen: boolean;
	readonly onOpenChange: (id: string, open: boolean) => void;
	readonly onResolve: (id: string, resolution: Resolution) => void;
}

function FindingRow({ finding, resolution, isOpen, onOpenChange, onResolve }: FindingRowProps): React.JSX.Element {
	const handleOpenChange = React.useCallback(
		(open: boolean): void => {
			onOpenChange(finding.id, open);
		},
		[finding.id, onOpenChange],
	);
	const handleApply = React.useCallback((): void => {
		onResolve(finding.id, "applied");
	}, [finding.id, onResolve]);
	const handleDismiss = React.useCallback((): void => {
		onResolve(finding.id, "dismissed");
	}, [finding.id, onResolve]);

	const highlightedLines = React.useMemo((): number[] => [finding.focus], [finding.focus]);

	return (
		<Sheet open={isOpen} onOpenChange={handleOpenChange}>
			<SheetTrigger>
				<TraceLine>
					<TraceIcon>{resolution === "applied" ? <CircleCheckIcon /> : <KindGlyph kind={finding.kind} />}</TraceIcon>
					<TraceTitle>{rowTitle(finding, resolution)}</TraceTitle>
					<TraceDescription>{shortLocation(finding.file, finding.line)}</TraceDescription>
				</TraceLine>
			</SheetTrigger>
			<SheetContent className="sm:max-w-lg">
				<SheetHeader>
					<SheetTitle>{finding.title}</SheetTitle>
					<SheetDescription>{finding.explanation}</SheetDescription>
				</SheetHeader>
				<div className="flex flex-col gap-3 px-4">
					<CodeBlock
						code={finding.code}
						language="typescript"
						showLineNumbers
						startLine={finding.line - finding.focus + 1}
						highlightedLines={highlightedLines}
						label={`${finding.file} at line ${String(finding.line)}`}
					/>
					<p className="text-sm text-muted-foreground">Suggested change</p>
					<CodeBlock code={finding.suggestion} language="typescript" diff={finding.diff} wrap label="Suggested change" />
				</div>
				<SheetFooter className="flex-row">
					<Button onClick={handleApply}>Apply suggestion</Button>
					<Button variant="outline" onClick={handleDismiss}>
						Dismiss
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}

interface KindGlyphProps {
	readonly kind: Kind;
}

function KindGlyph({ kind }: KindGlyphProps): React.JSX.Element {
	if (kind === "bug") {
		return <BugIcon />;
	}
	return <LockIcon />;
}
