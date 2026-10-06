import {
	AuditHttpMethodSchema,
	type AuditAuthMethod,
	type AuditHttpMethod,
	type AuditOutcome,
	type DeviceType,
	type HttpAuditLogSummary,
	type IpAddressScope,
} from "@workspace/shared";
import { Badge } from "@workspace/ui/components/badge";
import { Bot, CircleCheck, CircleHelp, CircleX, Monitor, ShieldAlert, Smartphone, Tablet, type LucideIcon } from "lucide-react";
import type * as React from "react";

import { AUDIT_AUTH_METHOD_LABELS, DEVICE_TYPE_LABELS, IP_ADDRESS_SCOPE_LABELS } from "@/lib/data-table/enum-filter-options";

/** A Badge variant — the tone palette (tokens.css) plus `outline` for "nothing to say". */
type BadgeVariant = NonNullable<React.ComponentProps<typeof Badge>["variant"]>;

/** One colour per method, so a page of requests reads at a glance: reads blue, creates green, deletes red. */
const METHOD_TONE: Readonly<Record<AuditHttpMethod, BadgeVariant>> = {
	GET: "blue",
	POST: "green",
	PUT: "orange",
	PATCH: "yellow",
	DELETE: "red",
	HEAD: "teal",
	OPTIONS: "violet",
};

const AUTH_METHOD_TONE: Readonly<Record<AuditAuthMethod, BadgeVariant>> = {
	SESSION_COOKIE: "blue",
	BEARER_TOKEN: "violet",
	REFRESH_COOKIE: "teal",
	API_KEY: "orange",
};

const DEVICE_TONE: Readonly<Record<DeviceType, { readonly tone: BadgeVariant; readonly icon: LucideIcon }>> = {
	DESKTOP: { tone: "blue", icon: Monitor },
	MOBILE: { tone: "green", icon: Smartphone },
	TABLET: { tone: "teal", icon: Tablet },
	BOT: { tone: "orange", icon: Bot },
	UNKNOWN: { tone: "outline", icon: CircleHelp },
};

const IP_SCOPE_TONE: Readonly<Record<IpAddressScope, BadgeVariant>> = {
	PUBLIC: "green",
	PRIVATE: "blue",
	LOOPBACK: "violet",
	LINK_LOCAL: "teal",
	SHARED: "yellow",
	DOCUMENTATION: "outline",
	MULTICAST: "orange",
	RESERVED: "orange",
};

/** HTTP status class → tone: 2xx green, 3xx teal, 4xx orange, 5xx red. */
const STATUS_CLASS_TONE: Readonly<Record<number, BadgeVariant>> = { 2: "green", 3: "teal", 4: "orange", 5: "red" };
const STATUS_CLASS_DIVISOR = 100;

/** The HTTP method of an audit record (any method a client sent; unknown ones are outlined). */
export function AuditMethodBadge({ method }: { readonly method: string }): React.JSX.Element {
	const known = AuditHttpMethodSchema.safeParse(method);
	return (
		<Badge variant={known.success ? METHOD_TONE[known.data] : "outline"} className="font-mono">
			{method}
		</Badge>
	);
}

/** Outcome + HTTP status (`Succeeded 201`, `Failed 403`), coloured by status class. */
export function AuditOutcomeBadge({ outcome, status }: { readonly outcome: AuditOutcome; readonly status: number }): React.JSX.Element {
	const isSuccess: boolean = outcome === "SUCCEEDED";
	return (
		<Badge variant={STATUS_CLASS_TONE[Math.floor(status / STATUS_CLASS_DIVISOR)] ?? "outline"} className="gap-1 tabular-nums">
			{isSuccess ? <CircleCheck className="size-3" aria-hidden /> : <CircleX className="size-3" aria-hidden />}
			{isSuccess ? "Succeeded" : "Failed"} {status}
		</Badge>
	);
}

/** How the caller authenticated; anonymous requests are outlined. */
export function AuditAuthMethodBadge({ authMethod }: { readonly authMethod: AuditAuthMethod | null }): React.JSX.Element {
	return authMethod === null ? <Badge variant="outline">Anonymous</Badge> : <Badge variant={AUTH_METHOD_TONE[authMethod]}>{AUDIT_AUTH_METHOD_LABELS[authMethod]}</Badge>;
}

/** The device class, with its icon. */
export function AuditDeviceBadge({ deviceType }: { readonly deviceType: DeviceType }): React.JSX.Element {
	const { tone, icon: Icon } = DEVICE_TONE[deviceType];
	return (
		<Badge variant={tone} className="gap-1">
			<Icon className="size-3" aria-hidden />
			{DEVICE_TYPE_LABELS[deviceType]}
		</Badge>
	);
}

/** The address class of the client IP (public, private, loopback…). */
export function AuditIpScopeBadge({ scope }: { readonly scope: IpAddressScope }): React.JSX.Element {
	return <Badge variant={IP_SCOPE_TONE[scope]}>{IP_ADDRESS_SCOPE_LABELS[scope]}</Badge>;
}

/** `Chrome 129 · macOS 10.15.7` — what the User-Agent says, or `null` when it says nothing. */
export function describeClientSoftware(entry: Pick<HttpAuditLogSummary, "browserName" | "browserVersion" | "osName" | "osVersion">): string | null {
	const browser: string | null = entry.browserName === null ? null : [entry.browserName, entry.browserVersion?.split(".")[0]].filter(Boolean).join(" ");
	const os: string | null = entry.osName === null ? null : [entry.osName, entry.osVersion].filter(Boolean).join(" ");
	const parts: string[] = [browser, os].filter((part): part is string => part !== null);
	return parts.length === 0 ? null : parts.join(" · ");
}

/**
 * Who made the request: the user (name + email), a machine API key, or
 * nobody (anonymous). An impersonated request also names the SuperAdmin who
 * was really acting — the most important fact on the row.
 */
export function AuditActorCell({ entry }: { readonly entry: Pick<HttpAuditLogSummary, "actor" | "impersonator" | "apiKeyId" | "terminalId"> }): React.JSX.Element {
	return (
		<div className="max-w-56 min-w-0 text-sm">
			{entry.actor !== null ? (
				<>
					<p className="truncate font-medium">{entry.actor.fullName ?? entry.actor.id}</p>
					{entry.actor.email === null ? null : <p className="truncate text-xs text-muted-foreground">{entry.actor.email}</p>}
				</>
			) : entry.apiKeyId !== null ? (
				<>
					<p className="font-medium">API key</p>
					<p className="truncate font-mono text-xs text-muted-foreground">{entry.terminalId ?? entry.apiKeyId}</p>
				</>
			) : (
				<p className="text-muted-foreground">Anonymous</p>
			)}
			{entry.impersonator === null ? null : (
				<Badge variant="yellow" className="mt-1 gap-1" title={entry.impersonator.email ?? entry.impersonator.id}>
					<ShieldAlert className="size-3" aria-hidden />
					Impersonated by {entry.impersonator.fullName ?? entry.impersonator.id}
				</Badge>
			)}
		</div>
	);
}
