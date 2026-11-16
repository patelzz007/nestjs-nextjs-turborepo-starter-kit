import { CodeIcon, DatabaseIcon, GlobeIcon, ServerIcon } from "lucide-react";
import type * as React from "react";

import { Badge } from "@workspace/ui/components/badge";
import { Trace, TraceCollapsible, TraceCollapsibleContent, TraceCollapsibleTrigger, TraceDescription, TraceIcon, TraceLine, TraceTitle } from "@workspace/ui/components/trace";

interface Span {
	readonly id: string;
	readonly name: string;
	// Picks the row's glyph only; the OpenTelemetry span kind is not shown.
	readonly icon: "server" | "database" | "http" | "code";
	readonly ms: number;
	readonly error?: boolean;
	readonly attributes?: Readonly<Record<string, string>>;
	readonly children?: readonly Span[];
}

interface SelfTime {
	readonly span: Span;
	readonly self: number;
}

/** Turns a fraction of the request into a percentage. */
const PERCENT = 100;

// Attribute keys follow the current OpenTelemetry semantic conventions.
const ROOT: Span = {
	id: "root",
	name: "POST /api/checkout",
	icon: "server",
	ms: 842,
	children: [
		{
			id: "cart",
			name: "SELECT cart_items",
			icon: "database",
			ms: 96,
			attributes: {
				"db.system.name": "postgresql",
				"db.response.returned_rows": "7",
			},
		},
		{
			id: "reserve-1",
			name: "POST /inventory/reserve",
			icon: "http",
			ms: 34,
			error: true,
			attributes: {
				"http.response.status_code": "409",
				"error.type": "409",
			},
		},
		{
			id: "reserve-2",
			name: "POST /inventory/reserve",
			icon: "http",
			ms: 30,
			attributes: {
				"http.response.status_code": "200",
				"http.request.resend_count": "1",
			},
		},
		{
			id: "payment",
			name: "payments.createIntent",
			icon: "code",
			ms: 610,
			children: [
				{
					id: "payment-http",
					name: "POST /v1/payment_intents",
					icon: "http",
					ms: 598,
					attributes: {
						"server.address": "api.payments.example",
						"http.response.status_code": "200",
					},
				},
			],
		},
	],
};

// Self time is a span's duration minus its children's: the span that spent
// the time itself, not a parent that only waited on it.
function slowest(span: Span): SelfTime {
	const children = span.children ?? [];
	const own: SelfTime = {
		span,
		self: span.ms - children.reduce((sum: number, child: Span): number => sum + child.ms, 0),
	};
	return children.map(slowest).reduce((best: SelfTime, next: SelfTime): SelfTime => (next.self > best.self ? next : best), own);
}

const HOT = slowest(ROOT).span;

// Child spans nest inside their parent's row, and the path to the slowest span
// starts open.
export function Trace10Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-md text-sm">
			<Trace>
				<SpanRow span={ROOT} />
			</Trace>
		</div>
	);
}

function contains(span: Span, id: string): boolean {
	return span.id === id || (span.children ?? []).some((child: Span): boolean => contains(child, id));
}

interface SpanRowProps {
	readonly span: Span;
}

function SpanRow({ span }: SpanRowProps): React.JSX.Element {
	const share = Math.round((span.ms / ROOT.ms) * PERCENT);
	const failed = span.error === true;

	return (
		<TraceCollapsible defaultOpen={span.children === undefined ? false : contains(span, HOT.id)}>
			<TraceCollapsibleTrigger>
				<TraceLine status={failed ? "error" : undefined}>
					<TraceIcon>
						<SpanGlyph icon={span.icon} />
					</TraceIcon>
					<TraceTitle>
						<code className="text-xs">{span.name}</code>
						{failed ? " failed" : null}
					</TraceTitle>
					<TraceDescription>{span.ms} ms</TraceDescription>
					{span.id === HOT.id ? (
						<Badge variant="warning-light">
							{share}%<span className="sr-only"> of the request time</span>
						</Badge>
					) : null}
				</TraceLine>
			</TraceCollapsibleTrigger>
			<TraceCollapsibleContent keepMounted>
				{span.children === undefined ? (
					<dl className="flex flex-col gap-1 font-mono text-xs">
						{Object.entries(span.attributes ?? {}).map(([key, value]: [string, string]): React.JSX.Element => (
							<div key={key} className="flex gap-3">
								<dt className="min-w-0 truncate">{key}</dt>
								<dd className="ml-auto shrink-0 text-foreground">{value}</dd>
							</div>
						))}
					</dl>
				) : (
					<Trace>
						{span.children.map((child: Span): React.JSX.Element => (
							<SpanRow key={child.id} span={child} />
						))}
					</Trace>
				)}
			</TraceCollapsibleContent>
		</TraceCollapsible>
	);
}

interface SpanGlyphProps {
	readonly icon: Span["icon"];
}

function SpanGlyph({ icon }: SpanGlyphProps): React.JSX.Element {
	switch (icon) {
		case "server":
			return <ServerIcon />;
		case "database":
			return <DatabaseIcon />;
		case "http":
			return <GlobeIcon />;
		case "code":
			return <CodeIcon />;
	}
}
