"use client";

import { CornerDownRightIcon, PackageIcon, ShieldAlertIcon, ShieldCheckIcon } from "lucide-react";
import * as React from "react";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Trace, TraceCollapsible, TraceCollapsibleContent, TraceCollapsibleTrigger, TraceDescription, TraceIcon, TraceLine, TraceTitle } from "@workspace/ui/components/trace";

interface AdvisoryFix {
	readonly action: string;
	readonly done: string;
	readonly why: string;
}

interface Advisory {
	readonly id: string;
	readonly pkg: string;
	readonly version: string;
	readonly severity: "high" | "moderate";
	readonly kind: string;
	readonly issue: string;
	// From apps/web down to the vulnerable package, before and after the fix.
	readonly path: readonly string[];
	readonly fixedPath: readonly string[];
	readonly fix: AdvisoryFix;
}

const ADVISORIES: readonly Advisory[] = [
	{
		id: "CVE-2024-45296",
		pkg: "path-to-regexp",
		version: "0.1.7",
		severity: "high",
		kind: "ReDoS",
		issue: "Backtracking regex in route parsing, fixed in 0.1.10",
		path: ["express 4.19.2", "path-to-regexp 0.1.7"],
		fixedPath: ["express 4.20.0", "path-to-regexp 0.1.10"],
		fix: {
			action: "Upgrade express to 4.20.0",
			done: "Upgraded express to 4.20.0",
			why: "express 4.19.2 pins 0.1.7, so express itself has to move.",
		},
	},
	{
		id: "CVE-2024-4068",
		pkg: "braces",
		version: "3.0.2",
		severity: "high",
		kind: "Memory exhaustion",
		issue: "No limit on input length, fixed in 3.0.3",
		path: ["lint-staged 15.2.2", "micromatch 4.0.5", "braces 3.0.2"],
		fixedPath: ["lint-staged 15.2.2", "micromatch 4.0.5", "braces 3.0.3"],
		fix: {
			action: "Update the lockfile",
			done: "Updated braces to 3.0.3",
			why: "micromatch asks for ^3.0.2, which already allows 3.0.3.",
		},
	},
	{
		id: "CVE-2024-55565",
		pkg: "nanoid",
		version: "3.3.7",
		severity: "moderate",
		kind: "Predictable IDs",
		issue: "Non-integer sizes weaken the output, fixed in 3.3.8",
		path: ["postcss 8.4.38", "nanoid 3.3.7"],
		fixedPath: ["postcss 8.4.38", "nanoid 3.3.8"],
		fix: {
			action: "Update the lockfile",
			done: "Updated nanoid to 3.3.8",
			why: "postcss asks for ^3.3.7, which already allows 3.3.8.",
		},
	},
];

// The chain decides the fix: a parent that pins the version needs an upgrade,
// a caret range only a lockfile update.
export function Trace16Example(): React.JSX.Element {
	const [fixed, setFixed] = React.useState<readonly string[]>([]);
	const [announcement, setAnnouncement] = React.useState("");
	const triggers = React.useRef(new Map<string, HTMLButtonElement>());
	const open = ADVISORIES.filter((advisory: Advisory): boolean => !fixed.includes(advisory.id));
	const high = open.filter((advisory: Advisory): boolean => advisory.severity === "high").length;

	const fix = React.useCallback((advisory: Advisory): void => {
		setFixed((current: readonly string[]): readonly string[] => [...current, advisory.id]);
		setAnnouncement(advisory.fix.done);
		// The button lives in the panel it changes, so focus returns to the row,
		// and the status line says what changed.
		triggers.current.get(advisory.id)?.focus();
	}, []);

	const registerTrigger = React.useCallback((id: string, node: HTMLButtonElement | null): void => {
		if (node === null) {
			triggers.current.delete(id);
			return;
		}
		triggers.current.set(id, node);
	}, []);

	return (
		<div className="flex w-full max-w-md flex-col gap-4 text-sm">
			<Trace>
				<TraceLine>
					<TraceIcon>
						<PackageIcon />
					</TraceIcon>
					<TraceTitle>Audited 1,284 dependencies</TraceTitle>
					<TraceDescription>{open.length > 0 ? `${String(open.length)} open, ${String(high)} high` : "all fixed"}</TraceDescription>
				</TraceLine>
				{ADVISORIES.map((advisory: Advisory): React.JSX.Element => (
					<AdvisoryRow key={advisory.id} advisory={advisory} done={fixed.includes(advisory.id)} onFix={fix} onRegisterTrigger={registerTrigger} />
				))}
			</Trace>
			<p role="status" className="sr-only">
				{announcement}
			</p>
		</div>
	);
}

interface AdvisoryRowProps {
	readonly advisory: Advisory;
	readonly done: boolean;
	readonly onFix: (advisory: Advisory) => void;
	readonly onRegisterTrigger: (id: string, node: HTMLButtonElement | null) => void;
}

function AdvisoryRow({ advisory, done, onFix, onRegisterTrigger }: AdvisoryRowProps): React.JSX.Element {
	const { id } = advisory;
	const triggerRef = React.useCallback(
		(node: HTMLButtonElement | null): void => {
			onRegisterTrigger(id, node);
		},
		[id, onRegisterTrigger],
	);
	const handleFix = React.useCallback((): void => {
		onFix(advisory);
	}, [advisory, onFix]);

	return (
		<TraceCollapsible>
			<TraceCollapsibleTrigger ref={triggerRef}>
				<TraceLine>
					<TraceIcon>{done ? <ShieldCheckIcon /> : <ShieldAlertIcon />}</TraceIcon>
					<TraceTitle>{done ? advisory.fix.done : `${advisory.kind} in ${advisory.pkg} ${advisory.version}`}</TraceTitle>
					{done ? null : <Badge variant={advisory.severity === "high" ? "destructive-light" : "warning-light"}>{advisory.severity}</Badge>}
				</TraceLine>
			</TraceCollapsibleTrigger>
			<TraceCollapsibleContent>
				<div className="flex flex-col gap-3">
					<p>{advisory.issue}.</p>
					<Trace>
						<TraceLine>
							<TraceTitle>apps/web</TraceTitle>
						</TraceLine>
						{(done ? advisory.fixedPath : advisory.path).map((step: string): React.JSX.Element => (
							<TraceLine key={step}>
								<TraceIcon>
									<CornerDownRightIcon />
								</TraceIcon>
								<TraceTitle>
									<code className="text-xs">{step}</code>
								</TraceTitle>
							</TraceLine>
						))}
					</Trace>
					{done ? (
						<p>{advisory.fix.why}</p>
					) : (
						<div className="flex items-center gap-3">
							<Button size="xs" variant="outline" onClick={handleFix}>
								{advisory.fix.action}
							</Button>
							<code className="text-xs">{advisory.id}</code>
						</div>
					)}
				</div>
			</TraceCollapsibleContent>
		</TraceCollapsible>
	);
}
