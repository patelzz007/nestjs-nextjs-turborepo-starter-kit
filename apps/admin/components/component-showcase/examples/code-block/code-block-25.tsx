"use client";

import { PlusIcon, XIcon } from "lucide-react";
import * as React from "react";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import { CodeBlock, CodeBlockHeader, CodeBlockLineActions, CodeBlockTitle, useCodeBlockSelection, type CodeBlockLineActionContext } from "@workspace/ui/components/code-block";

const FILE = "use-mobile.ts";
const PATH = "src/hooks/use-mobile.ts";

const CODE = `import { useEffect, useState } from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean>()

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)")
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}`;

function ascending(left: number, right: number): number {
	return left - right;
}

interface AddToChatProps {
	readonly line: number;
	readonly onAdd: (lines: readonly number[]) => void;
}

/*
 * The gutter button turns code into REFERENCES: press + on a line and the
 * composer below gains a file:line badge, or select a range first and one
 * press references every selected line. `useCodeBlockSelection` is what makes
 * the range case possible - the render prop alone only knows its own line.
 */
function AddToChat({ line, onAdd }: AddToChatProps): React.JSX.Element {
	const { selectedLines, clearSelection } = useCodeBlockSelection();
	const batch = React.useMemo((): readonly number[] => (selectedLines.length > 0 ? selectedLines : [line]), [selectedLines, line]);
	const isRange = batch.length > 1;
	const count = String(batch.length);
	const lineNumber = String(line);

	const handleClick = React.useCallback((): void => {
		onAdd(batch);
		clearSelection();
	}, [onAdd, batch, clearSelection]);

	return (
		<Button
			type="button"
			size="icon-xs"
			aria-label={isRange ? `Reference ${count} selected lines in the chat` : `Reference line ${lineNumber} in the chat`}
			title={isRange ? `Reference ${count} lines` : `Reference line ${lineNumber}`}
			onClick={handleClick}
			/* Trimmed below the icon-xs rung: the control hangs over the line
			   numbers, so a full 24px chip covers the digits it floats above. */
			className="size-5">
			<PlusIcon />
		</Button>
	);
}

interface ReferenceChipProps {
	readonly line: number;
	readonly isHighlighted: boolean;
	readonly onToggleHighlight: (line: number) => void;
	readonly onRemove: (line: number) => void;
}

/* Two actions per chip, so two real buttons: the label highlights the
   referenced line in the block above through `highlightedLines`, the X
   removes the reference. */
function ReferenceChip({ line, isHighlighted, onToggleHighlight, onRemove }: ReferenceChipProps): React.JSX.Element {
	const lineNumber = String(line);

	const handleHighlight = React.useCallback((): void => {
		onToggleHighlight(line);
	}, [line, onToggleHighlight]);
	const handleRemove = React.useCallback((): void => {
		onRemove(line);
	}, [line, onRemove]);

	return (
		<Badge variant={isHighlighted ? "primary-light" : "outline"} title={`${PATH}:${lineNumber}`} className="gap-0.5 font-mono">
			<Button
				variant="ghost"
				size="xs"
				aria-pressed={isHighlighted}
				aria-label={`Highlight line ${lineNumber} in the code`}
				onClick={handleHighlight}
				className="h-auto p-0 font-mono hover:bg-transparent">
				{FILE}:{line}
			</Button>
			<Button
				variant="ghost"
				size="icon-xs"
				aria-label={`Remove the reference to line ${lineNumber}`}
				onClick={handleRemove}
				className="size-4 hover:bg-transparent [&_svg]:size-2.5">
				<XIcon />
			</Button>
		</Badge>
	);
}

function contextSummary(count: number): string {
	if (count === 0) {
		return "No context yet";
	}
	return `${String(count)} ${count === 1 ? "line" : "lines"} in context`;
}

export function CodeBlock25Example(): React.JSX.Element {
	const [refs, setRefs] = React.useState<readonly number[]>([]);
	const [highlighted, setHighlighted] = React.useState<number | null>(null);

	const addLines = React.useCallback((lines: readonly number[]): void => {
		setRefs((current: readonly number[]): readonly number[] => [...new Set([...current, ...lines])].sort(ascending));
	}, []);

	const toggleHighlight = React.useCallback((line: number): void => {
		setHighlighted((current: number | null): number | null => (current === line ? null : line));
	}, []);

	const removeRef = React.useCallback((line: number): void => {
		setRefs((current: readonly number[]): readonly number[] => current.filter((value: number): boolean => value !== line));
		setHighlighted((current: number | null): number | null => (current === line ? null : current));
	}, []);

	const highlightedLines = React.useMemo((): number[] | undefined => (highlighted === null ? undefined : [highlighted]), [highlighted]);

	const renderAddToChat = React.useCallback(({ line }: CodeBlockLineActionContext): React.ReactNode => <AddToChat line={line} onAdd={addLines} />, [addLines]);

	return (
		<div className="flex w-full max-w-2xl flex-col gap-3">
			<CodeBlock code={CODE} language="typescript" showLineNumbers selectable highlightedLines={highlightedLines}>
				<CodeBlockHeader>
					<CodeBlockTitle>{FILE}</CodeBlockTitle>
					<span className="ml-auto text-xs text-muted-foreground">Press + on a line to reference it</span>
				</CodeBlockHeader>

				<CodeBlockLineActions side="gutter">{renderAddToChat}</CodeBlockLineActions>
			</CodeBlock>

			{/* The composer the references land in. A Card, not a hand-rolled
			    bordered div, so its radius resolves per style. */}
			<Card size="sm" className="gap-2 p-3">
				<div className="flex flex-wrap items-center gap-1.5">
					{refs.length === 0 ? (
						<span className="px-1 text-sm text-muted-foreground">Ask about {FILE}...</span>
					) : (
						refs.map((line: number): React.JSX.Element => (
							<ReferenceChip key={line} line={line} isHighlighted={highlighted === line} onToggleHighlight={toggleHighlight} onRemove={removeRef} />
						))
					)}
				</div>
				<div className="flex items-center gap-2">
					<span className="text-xs text-muted-foreground">{contextSummary(refs.length)}</span>
					<Button size="xs" className="ml-auto" disabled={refs.length === 0}>
						Ask AI
					</Button>
				</div>
			</Card>
		</div>
	);
}
