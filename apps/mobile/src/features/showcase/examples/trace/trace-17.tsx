import { Button } from "@workspace/ui-native/components/button";
import { CodeBlock, type CodeBlockLineMark } from "@workspace/ui-native/components/code-block";
import type { LucideIcon } from "@workspace/ui-native/components/icon";
import { Sheet } from "@workspace/ui-native/components/sheet";
import { Trace, TraceLine, TraceStep } from "@workspace/ui-native/components/trace";
import BugIcon from "lucide-react-native/icons/bug";
import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import GitPullRequestArrowIcon from "lucide-react-native/icons/git-pull-request-arrow";
import LockIcon from "lucide-react-native/icons/lock";
import MessageSquareTextIcon from "lucide-react-native/icons/message-square-text";
import * as React from "react";
import { Text, View } from "react-native";

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
	/** The line within `code` the comment is about, 1-based. */
	readonly focus: number;
	readonly suggestion: string;
	readonly diff: readonly CodeBlockLineMark[];
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
		code: "const user = await getUser(userId)\nreturn user.invoices.find((i) => i.id === id)",
		focus: 2,
		suggestion: 'const user = await getUser(userId)\nif (!user) throw new NotFoundError("user")\nreturn user.invoices.find((i) => i.id === id)',
		diff: [{ line: 2, kind: "added" }],
	},
	{
		id: "password-log",
		kind: "security",
		title: "Password in the error log",
		fixed: "Dropped the password from the log",
		file: "lib/auth/login.ts",
		line: 17,
		explanation: "Log lines are shipped to a third party and kept for 30 days.",
		code: 'logger.error("login failed", { email, password })',
		focus: 1,
		suggestion: 'logger.error("login failed", { email, password })\nlogger.error("login failed", { email })',
		diff: [
			{ line: 1, kind: "removed" },
			{ line: 2, kind: "added" },
		],
	},
];

const KIND_GLYPHS: Readonly<Record<Kind, LucideIcon>> = { bug: BugIcon, security: LockIcon };

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

interface FindingRowProps {
	readonly finding: Finding;
	readonly resolution: Resolution | undefined;
	readonly isOpen: boolean;
	readonly onOpenChange: (id: string, open: boolean) => void;
	readonly onResolve: (id: string, resolution: Resolution) => void;
}

function FindingRow({ finding, resolution, isOpen, onOpenChange, onResolve }: FindingRowProps): React.JSX.Element {
	const openSheet = React.useCallback((): void => {
		onOpenChange(finding.id, true);
	}, [finding.id, onOpenChange]);
	const changeOpen = React.useCallback(
		(open: boolean): void => {
			onOpenChange(finding.id, open);
		},
		[finding.id, onOpenChange],
	);
	const apply = React.useCallback((): void => {
		onResolve(finding.id, "applied");
	}, [finding.id, onResolve]);
	const dismiss = React.useCallback((): void => {
		onResolve(finding.id, "dismissed");
	}, [finding.id, onResolve]);
	const focusMarks = React.useMemo((): readonly CodeBlockLineMark[] => [{ line: finding.line, kind: "highlight" }], [finding.line]);
	const footer = (
		<View className="flex-row gap-2">
			<Button label="Apply suggestion" onPress={apply} className="flex-1" />
			<Button label="Dismiss" variant="outline" onPress={dismiss} className="flex-1" />
		</View>
	);
	return (
		<>
			<TraceLine
				icon={resolution === "applied" ? CircleCheckIcon : KIND_GLYPHS[finding.kind]}
				title={rowTitle(finding, resolution)}
				description={shortLocation(finding.file, finding.line)}
				onPress={openSheet}
			/>
			<Sheet open={isOpen} onOpenChange={changeOpen} side="bottom" title={finding.title} description={finding.explanation} footer={footer} showCloseButton>
				<View className="gap-3">
					<CodeBlock
						code={finding.code}
						language="typescript"
						showLineNumbers
						startLine={finding.line - finding.focus + 1}
						lineMarks={focusMarks}
						caption={`${finding.file} at line ${String(finding.line)}`}
					/>
					<Text className="text-label font-sans text-muted-foreground">Suggested change</Text>
					<CodeBlock code={finding.suggestion} language="typescript" lineMarks={finding.diff} wrap caption="Suggested change" />
				</View>
			</Sheet>
		</>
	);
}

// The sheet closes back onto the row it opened from, which then says what happened to the comment.
export function Trace17Example(): React.JSX.Element {
	const [openId, setOpenId] = React.useState<string | null>(null);
	const [resolved, setResolved] = React.useState<Resolutions>({});
	const remaining = FINDINGS.filter((finding: Finding): boolean => resolved[finding.id] === undefined).length;
	const changeOpen = React.useCallback((id: string, open: boolean): void => {
		setOpenId(open ? id : null);
	}, []);
	const resolve = React.useCallback((id: string, resolution: Resolution): void => {
		setResolved((current: Resolutions): Resolutions => ({ ...current, [id]: resolution }));
		setOpenId(null);
	}, []);
	return (
		<Trace accessibilityLabel="Review">
			<TraceLine icon={GitPullRequestArrowIcon} title="Reviewed 6 changed files" description="+214 -38" />
			<TraceStep icon={MessageSquareTextIcon} title={`Left ${String(FINDINGS.length)} comments`} description={`${String(remaining)} open`} defaultOpen>
				<Trace>
					{FINDINGS.map((finding: Finding): React.JSX.Element => (
						<FindingRow key={finding.id} finding={finding} resolution={resolved[finding.id]} isOpen={openId === finding.id} onOpenChange={changeOpen} onResolve={resolve} />
					))}
				</Trace>
			</TraceStep>
		</Trace>
	);
}
