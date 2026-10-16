"use client";

import { WebhookIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@workspace/ui/components/button";
import { CodeBlock } from "@workspace/ui/components/code-block";
import { Trace, TraceCollapsible, TraceCollapsibleContent, TraceCollapsibleTrigger, TraceDescription, TraceIcon, TraceLine, TraceTitle } from "@workspace/ui/components/trace";

interface Attempt {
	readonly number: number;
	readonly at: string;
	readonly ok: boolean;
	readonly title: string;
	readonly body: string;
	readonly language: "json" | "bash";
}

/** How long the demo resend takes to come back. */
const RESEND_DELAY_MS = 1400;

/** Delivery times print as 24-hour clock times, like the history above. */
const CLOCK_LOCALE = "en-GB";

const PAYLOAD = `{
  "id": "evt_3Q9xLm2",
  "type": "invoice.paid",
  "invoice": "in_1Q9xKt",
  "amount_paid": 18400
}`;

const HISTORY: readonly Attempt[] = [
	{
		number: 1,
		at: "14:02:11",
		ok: false,
		title: "Attempt 1 timed out after 30s",
		body: "No response from hooks.northwind.dev within 30000 ms",
		language: "bash",
	},
	{
		number: 2,
		at: "14:03:12",
		ok: false,
		title: "Attempt 2 failed with 500",
		body: `{ "error": "database is in recovery mode" }`,
		language: "json",
	},
	{
		number: 3,
		at: "14:07:40",
		ok: true,
		title: "Attempt 3 delivered, 200 in 214 ms",
		body: PAYLOAD,
		language: "json",
	},
];

function deliveredAttempt(number: number, at: string): Attempt {
	return {
		number,
		at,
		ok: true,
		title: `Attempt ${String(number)} delivered, 200 in 188 ms`,
		body: PAYLOAD,
		language: "json",
	};
}

// Resend appends an attempt instead of replacing the last one.
export function Trace14Example(): React.JSX.Element {
	const [attempts, setAttempts] = React.useState<readonly Attempt[]>(HISTORY);
	const [sending, setSending] = React.useState(false);
	const statusRef = React.useRef<HTMLParagraphElement>(null);

	React.useEffect((): (() => void) | undefined => {
		if (!sending) {
			return undefined;
		}
		const timer = window.setTimeout((): void => {
			// The clock is read in the timer, never during render.
			const at = new Date().toLocaleTimeString(CLOCK_LOCALE);
			setAttempts((current: readonly Attempt[]): readonly Attempt[] => [...current, deliveredAttempt(current.length + 1, at)]);
			setSending(false);
		}, RESEND_DELAY_MS);
		return (): void => {
			window.clearTimeout(timer);
		};
	}, [sending]);

	const handleResend = React.useCallback((): void => {
		setSending(true);
		// The button disables itself, so focus moves to the status line.
		statusRef.current?.focus();
	}, []);

	return (
		<div className="flex w-full max-w-md flex-col gap-4 text-sm">
			<Trace>
				{/* The newest attempt starts open. defaultOpen applies on mount, so a
				    resend opens its own row without closing the previous one. */}
				{attempts.map((attempt: Attempt, index: number): React.JSX.Element => (
					<TraceCollapsible key={attempt.number} defaultOpen={index === attempts.length - 1}>
						<TraceCollapsibleTrigger>
							<TraceLine status={attempt.ok ? undefined : "error"}>
								<TraceIcon>
									<WebhookIcon />
								</TraceIcon>
								<TraceTitle>{attempt.title}</TraceTitle>
								<TraceDescription>{attempt.at}</TraceDescription>
							</TraceLine>
						</TraceCollapsibleTrigger>
						<TraceCollapsibleContent>
							<CodeBlock code={attempt.body} language={attempt.language} highlight={attempt.language === "json"} label={attempt.ok ? "Request payload" : "Response"} wrap />
						</TraceCollapsibleContent>
					</TraceCollapsible>
				))}
				{sending ? (
					<TraceLine status="running">
						<TraceIcon>
							<WebhookIcon />
						</TraceIcon>
						<TraceTitle>Sending attempt {attempts.length + 1}</TraceTitle>
					</TraceLine>
				) : null}
			</Trace>
			<div className="flex items-center gap-3">
				<Button size="sm" variant="outline" disabled={sending} onClick={handleResend}>
					Resend event
				</Button>
				<p ref={statusRef} role="status" tabIndex={-1} className="text-xs text-muted-foreground outline-none">
					{sending ? "Sending" : `${String(attempts.length)} attempts`}
				</p>
			</div>
		</div>
	);
}
