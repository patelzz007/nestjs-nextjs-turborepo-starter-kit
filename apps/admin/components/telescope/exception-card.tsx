"use client";

// ============================================
// components/telescope/exception-card.tsx
// Exception card: name + message + status + path, with a <details> disclosure
// for the stack trace. `occurrences` is shown when it's a grouped count rather
// than a single 1-off entry. Dumb: the exception arrives via props.
// ============================================

import { Badge } from "@workspace/ui/components/feedback/badge";
import { TriangleAlert } from "lucide-react";

import type { ExceptionLogEntry } from "@workspace/shared";

import { CodeBlock } from "@/components/docs/code-block";
import { formatTime, statusTone } from "@/lib/telescope";

export interface ExceptionCardProps {
	readonly exception: ExceptionLogEntry;
	/** When set, clicking the card navigates (e.g. a drill-down). */
	readonly href?: string;
}

/** ExceptionCard — a compact error row that expands into the full stack. */
export function ExceptionCard({ exception, href }: ExceptionCardProps): React.JSX.Element {
	const tone = statusTone(exception.statusCode);
	const grouped: boolean = exception.occurrences > 1;

	const header: React.JSX.Element = (
		<div className="flex items-center gap-3">
			<div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
				<TriangleAlert className="size-4" />
			</div>
			<div className="min-w-0 flex-1">
				<p className="truncate font-mono text-xs font-medium text-foreground">
					{exception.name}
					<span className="ml-2 text-muted-foreground">{exception.message}</span>
				</p>
				<p className="mt-0.5 flex items-center gap-2 truncate text-[11px] text-muted-foreground">
					<span className="inline-flex items-center gap-1 rounded-full border px-1.5 py-px font-mono tabular-nums">
						<span className={`size-1.5 rounded-full ${tone.dotClass}`} />
						{tone.label}
					</span>
					{exception.path !== null ? (
						<span className="truncate font-mono">
							{exception.method} {exception.path}
						</span>
					) : null}
					<span className="hidden shrink-0 sm:inline">{formatTime(exception.createdAt)}</span>
				</p>
			</div>
			{grouped ? (
				<Badge variant="outline" className="shrink-0" title="Grouped occurrences across requests">
					×{exception.occurrences}
				</Badge>
			) : null}
		</div>
	);

	if (exception.stack !== null) {
		return (
			<details className="group rounded-lg border bg-card text-card-foreground shadow-xs">
				<summary className="cursor-pointer list-none p-3 transition-colors hover:bg-accent/40 [&::-webkit-details-marker]:hidden">{header}</summary>
				<div className="border-t">
					<CodeBlock code={exception.stack} language="plaintext" fileName="stack-trace.txt" />
				</div>
			</details>
		);
	}

	if (href !== undefined) {
		return (
			<a href={href} className="block rounded-lg border bg-card text-card-foreground shadow-xs transition-colors hover:border-destructive/40 hover:bg-accent/40">
				<div className="p-3">{header}</div>
			</a>
		);
	}

	return <div className="rounded-lg border bg-card text-card-foreground shadow-xs">{header}</div>;
}
