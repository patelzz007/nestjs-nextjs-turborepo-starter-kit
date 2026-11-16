import { Badge } from "@workspace/ui-native/components/badge";
import type { LucideIcon } from "@workspace/ui-native/components/icon";
import { Trace, TraceStep } from "@workspace/ui-native/components/trace";
import CodeIcon from "lucide-react-native/icons/code";
import DatabaseIcon from "lucide-react-native/icons/database";
import GlobeIcon from "lucide-react-native/icons/globe";
import ServerIcon from "lucide-react-native/icons/server";
import * as React from "react";
import { Text, View } from "react-native";

interface Span {
	readonly id: string;
	readonly name: string;
	/** Picks the row's glyph only; the OpenTelemetry span kind is not shown. */
	readonly icon: LucideIcon;
	readonly ms: number;
	readonly error?: boolean | undefined;
	readonly attributes?: Readonly<Record<string, string>> | undefined;
	readonly children?: readonly Span[] | undefined;
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
	icon: ServerIcon,
	ms: 842,
	children: [
		{ id: "cart", name: "SELECT cart_items", icon: DatabaseIcon, ms: 96, attributes: { "db.system.name": "postgresql", "db.response.returned_rows": "7" } },
		{ id: "reserve-1", name: "POST /inventory/reserve", icon: GlobeIcon, ms: 34, error: true, attributes: { "http.response.status_code": "409", "error.type": "409" } },
		{ id: "reserve-2", name: "POST /inventory/reserve", icon: GlobeIcon, ms: 30, attributes: { "http.response.status_code": "200", "http.request.resend_count": "1" } },
		{
			id: "payment",
			name: "payments.createIntent",
			icon: CodeIcon,
			ms: 610,
			children: [
				{
					id: "payment-http",
					name: "POST /v1/payment_intents",
					icon: GlobeIcon,
					ms: 598,
					attributes: { "server.address": "api.payments.example", "http.response.status_code": "200" },
				},
			],
		},
	],
};

/** Self time is a span's duration minus its children's: the span that spent the time itself, not a parent that only waited. */
function slowest(span: Span): SelfTime {
	const children = span.children ?? [];
	const own: SelfTime = { span, self: span.ms - children.reduce((sum: number, child: Span): number => sum + child.ms, 0) };
	return children.map(slowest).reduce((best: SelfTime, next: SelfTime): SelfTime => (next.self > best.self ? next : best), own);
}

const HOT = slowest(ROOT).span;

function contains(span: Span, id: string): boolean {
	return span.id === id || (span.children ?? []).some((child: Span): boolean => contains(child, id));
}

function Attributes({ attributes }: { readonly attributes: Readonly<Record<string, string>> }): React.JSX.Element {
	return (
		<View className="gap-1">
			{Object.entries(attributes).map(([key, value]: readonly [string, string]): React.JSX.Element => (
				<View key={key} className="flex-row gap-3">
					<Text numberOfLines={1} className="text-caption font-code flex-1 text-muted-foreground">
						{key}
					</Text>
					<Text className="text-caption font-code text-foreground">{value}</Text>
				</View>
			))}
		</View>
	);
}

function SpanRow({ span }: { readonly span: Span }): React.JSX.Element {
	const share = Math.round((span.ms / ROOT.ms) * PERCENT);
	const failed = span.error === true;
	const hot = span.id === HOT.id;
	const badge = hot ? <Badge label={`${String(share)}%`} tone="warning" variant="light" size="sm" /> : undefined;
	return (
		<TraceStep
			icon={span.icon}
			title={failed ? `${span.name} failed` : span.name}
			description={`${String(span.ms)} ms`}
			trailing={badge}
			accessibilityLabel={`${failed ? `${span.name} failed` : span.name}, ${String(span.ms)} ms${hot ? `, ${String(share)}% of the request time` : ""}`}
			status={failed ? "error" : undefined}
			defaultOpen={span.children === undefined ? false : contains(span, HOT.id)}>
			{span.children === undefined ? (
				<Attributes attributes={span.attributes ?? {}} />
			) : (
				<Trace>
					{span.children.map((child: Span): React.JSX.Element => (
						<SpanRow key={child.id} span={child} />
					))}
				</Trace>
			)}
		</TraceStep>
	);
}

// Child spans nest inside their parent's row, and the path to the slowest span starts open.
export function Trace10Example(): React.JSX.Element {
	return (
		<Trace accessibilityLabel="Request spans">
			<SpanRow span={ROOT} />
		</Trace>
	);
}
