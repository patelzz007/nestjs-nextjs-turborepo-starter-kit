import { Button } from "@workspace/ui-native/components/button";
import { CodeBlock } from "@workspace/ui-native/components/code-block";
import { Trace, TraceLine, TraceStep } from "@workspace/ui-native/components/trace";
import WebhookIcon from "lucide-react-native/icons/webhook";
import * as React from "react";
import { Text, View } from "react-native";

interface Attempt {
	readonly number: number;
	/** When it was attempted, in epoch milliseconds. */
	readonly atEpochMs: number;
	readonly ok: boolean;
	readonly title: string;
	readonly body: string;
	readonly language: "json" | "bash";
}

/** How long the demo resend takes to come back. */
const RESEND_DELAY_MS = 1_400;

/** Delivery times print as 24-hour UTC clock times. */
const CLOCK = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC" });

const PAYLOAD = `{
  "id": "evt_3Q9xLm2",
  "type": "invoice.paid",
  "invoice": "in_1Q9xKt",
  "amount_paid": 18400
}`;

const HISTORY: readonly Attempt[] = [
	{
		number: 1,
		atEpochMs: Date.UTC(2026, 9, 1, 14, 2, 11),
		ok: false,
		title: "Attempt 1 timed out after 30s",
		body: "No response from hooks.northwind.dev within 30000 ms",
		language: "bash",
	},
	{
		number: 2,
		atEpochMs: Date.UTC(2026, 9, 1, 14, 3, 12),
		ok: false,
		title: "Attempt 2 failed with 500",
		body: '{ "error": "database is in recovery mode" }',
		language: "json",
	},
	{ number: 3, atEpochMs: Date.UTC(2026, 9, 1, 14, 7, 40), ok: true, title: "Attempt 3 delivered, 200 in 214 ms", body: PAYLOAD, language: "json" },
];

function deliveredAttempt(number: number, atEpochMs: number): Attempt {
	return { number, atEpochMs, ok: true, title: `Attempt ${String(number)} delivered, 200 in 188 ms`, body: PAYLOAD, language: "json" };
}

// Resend appends an attempt instead of replacing the last one.
export function Trace14Example(): React.JSX.Element {
	const [attempts, setAttempts] = React.useState<readonly Attempt[]>(HISTORY);
	const [sending, setSending] = React.useState(false);

	React.useEffect((): (() => void) | undefined => {
		if (!sending) {
			return undefined;
		}
		const timer = setTimeout((): void => {
			// The clock is read in the timer, never during render.
			const atEpochMs = Date.now();
			setAttempts((current: readonly Attempt[]): readonly Attempt[] => [...current, deliveredAttempt(current.length + 1, atEpochMs)]);
			setSending(false);
		}, RESEND_DELAY_MS);
		return (): void => {
			clearTimeout(timer);
		};
	}, [sending]);

	const resend = React.useCallback((): void => {
		setSending(true);
	}, []);

	return (
		<View className="gap-4">
			<Trace accessibilityLabel="Delivery attempts">
				{/* The newest attempt starts open; defaultOpen applies when a row appears, so a resend opens its own row only. */}
				{attempts.map((attempt: Attempt, index: number): React.JSX.Element => (
					<TraceStep
						key={attempt.number}
						icon={WebhookIcon}
						title={attempt.title}
						description={CLOCK.format(attempt.atEpochMs)}
						status={attempt.ok ? undefined : "error"}
						defaultOpen={index === attempts.length - 1}>
						<CodeBlock code={attempt.body} language={attempt.language} caption={attempt.ok ? "Request payload" : "Response"} wrap />
					</TraceStep>
				))}
				{sending ? <TraceLine icon={WebhookIcon} title={`Sending attempt ${String(attempts.length + 1)}`} status="running" /> : null}
			</Trace>
			<View className="flex-row items-center gap-3">
				<Button label="Resend event" size="sm" variant="outline" disabled={sending} onPress={resend} />
				<Text accessibilityLiveRegion="polite" className="text-caption font-sans text-muted-foreground">
					{sending ? "Sending" : `${String(attempts.length)} attempts`}
				</Text>
			</View>
		</View>
	);
}
