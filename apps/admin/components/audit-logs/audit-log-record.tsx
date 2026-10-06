import type { AuditLogUser, HttpAuditLogDetail, JsonValue } from "@workspace/shared";
import { cn } from "@workspace/ui/lib/core/utils";
import Link from "next/link";
import type * as React from "react";

import { formatDateTimeWithSeconds } from "@/lib/format/dates";
import { countryFlag, countryName } from "@/lib/format/country";
import { auditLogListHref } from "@/lib/url-state/audit-logs";

import { AuditActorCell, AuditAuthMethodBadge, AuditDeviceBadge, AuditIpScopeBadge, AuditMethodBadge, AuditOutcomeBadge, describeClientSoftware } from "./audit-log-badges";

/** Indentation of the pretty-printed payloads. */
const JSON_INDENT_SPACES = 2;
/** What an absent value renders as. */
const NOT_RECORDED = "—";

/** `page`: the full-width detail page; `drawer`: the narrower side panel of the table. */
export type AuditLogRecordLayout = "page" | "drawer";

const GRID_BY_LAYOUT: Readonly<Record<AuditLogRecordLayout, string>> = {
	page: "sm:grid-cols-2 lg:grid-cols-3",
	drawer: "sm:grid-cols-2",
};

/** One labelled value; `mono` for ids, addresses and raw header values. */
function Field({ label, children, mono = false }: { readonly label: string; readonly children: React.ReactNode; readonly mono?: boolean }): React.JSX.Element {
	return (
		<div className="min-w-0 space-y-1">
			<dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
			<dd className={cn("text-sm break-all", mono && "font-mono")}>{children}</dd>
		</div>
	);
}

/** A value, or the "not recorded" dash. */
function orDash(value: string | number | null): string {
	return value === null ? NOT_RECORDED : String(value);
}

function Section({
	title,
	description,
	layout,
	children,
}: {
	readonly title: string;
	readonly description: string;
	readonly layout: AuditLogRecordLayout;
	readonly children: React.ReactNode;
}): React.JSX.Element {
	return (
		<section className="space-y-3 rounded-lg border bg-card p-4">
			<div>
				<h3 className="text-sm font-semibold">{title}</h3>
				<p className="text-xs text-muted-foreground">{description}</p>
			</div>
			<dl className={cn("grid gap-4", GRID_BY_LAYOUT[layout])}>{children}</dl>
		</section>
	);
}

/** A redacted JSON payload, pretty-printed; `null` = nothing was stored. */
function Payload({ title, value }: { readonly title: string; readonly value: JsonValue | null }): React.JSX.Element {
	return (
		<section className="min-w-0 space-y-2 rounded-lg border bg-card p-4">
			<h3 className="text-sm font-semibold">{title}</h3>
			{value === null ? (
				<p className="text-sm text-muted-foreground">Nothing recorded.</p>
			) : (
				<pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">{JSON.stringify(value, null, JSON_INDENT_SPACES)}</pre>
			)}
		</section>
	);
}

/** A user named by the record, with a link to everything they did. */
function UserField({ label, user }: { readonly label: string; readonly user: AuditLogUser | null }): React.JSX.Element {
	return (
		<Field label={label}>
			{user === null ? (
				NOT_RECORDED
			) : (
				<span className="space-y-0.5">
					<span className="block font-medium">{user.fullName ?? "Unknown user"}</span>
					{user.email === null ? null : <span className="block text-muted-foreground">{user.email}</span>}
					<Link href={auditLogListHref({ actorUserId: user.id })} className="block font-mono text-xs text-primary hover:underline">
						{user.id}
					</Link>
				</span>
			)}
		</Field>
	);
}

/** `🇲🇾 Malaysia · Kuala Lumpur, Kuala Lumpur`, or the dash when the CDN gave nothing. */
function describeLocation(record: Pick<HttpAuditLogDetail, "geoCountry" | "geoRegion" | "geoCity">): string {
	const place: string = [record.geoCity, record.geoRegion].filter((part): part is string => part !== null).join(", ");
	if (record.geoCountry === null) {
		return place.length === 0 ? NOT_RECORDED : place;
	}
	const country = `${countryFlag(record.geoCountry) ?? ""} ${countryName(record.geoCountry)}`.trim();
	return place.length === 0 ? country : `${country} · ${place}`;
}

/**
 * One complete audit record — presentational: the caller fetched it. Who acted
 * (and who was really acting, under impersonation), when, from which device
 * and where, with which credential, what was sent and what came back. Ids link
 * back to the table filtered by that actor / organization / correlation id.
 */
export function AuditLogRecord({ record, layout }: { readonly record: HttpAuditLogDetail; readonly layout: AuditLogRecordLayout }): React.JSX.Element {
	const software: string | null = describeClientSoftware(record);
	return (
		<div className="space-y-4">
			<header className="space-y-2">
				<div className="flex flex-wrap items-center gap-2">
					<AuditMethodBadge method={record.method} />
					<h2 className="font-mono text-base font-semibold break-all text-foreground">{record.endpoint}</h2>
					<AuditOutcomeBadge outcome={record.outcome} status={record.responseStatus} />
				</div>
				<p className="font-mono text-xs break-all text-muted-foreground">{record.path}</p>
				<AuditActorCell entry={record} />
			</header>

			<Section title="Who" description="The verified principal — never what the client claimed." layout={layout}>
				<UserField label="Actor" user={record.actor} />
				<UserField label="Impersonated by" user={record.impersonator} />
				<Field label="Impersonation session" mono>
					{orDash(record.impersonationSessionId)}
				</Field>
				<Field label="Credential">
					<AuditAuthMethodBadge authMethod={record.authMethod} />
				</Field>
				<Field label="API key" mono>
					{orDash(record.apiKeyId)}
				</Field>
				<Field label="POS terminal" mono>
					{orDash(record.terminalId)}
				</Field>
				<Field label="Organization">
					{record.organization === null ? (
						NOT_RECORDED
					) : (
						<Link href={auditLogListHref({ organizationId: record.organization.id })} className="text-primary hover:underline">
							{record.organization.name ?? record.organization.id}
						</Link>
					)}
				</Field>
				<Field label="Store" mono>
					{orDash(record.storeId)}
				</Field>
				<Field label="Location" mono>
					{orDash(record.locationId)}
				</Field>
			</Section>

			<Section title="When" description="Server clock, shown in your time zone." layout={layout}>
				<Field label="Received">{formatDateTimeWithSeconds(record.occurredAt)}</Field>
				<Field label="Completed">{formatDateTimeWithSeconds(record.completedAt)}</Field>
				<Field label="Duration">{record.durationMs} ms</Field>
				<Field label="Recorded">{formatDateTimeWithSeconds(record.createdAt)}</Field>
			</Section>

			<Section
				title="Device & location"
				description="Parsed from the User-Agent (what the client claimed) and the address; the location comes from the CDN edge, so it is empty when the API is not behind one."
				layout={layout}>
				<Field label="Device">{record.deviceType === null ? NOT_RECORDED : <AuditDeviceBadge deviceType={record.deviceType} />}</Field>
				<Field label="Browser / client · OS">{software ?? NOT_RECORDED}</Field>
				<Field label="Device model">{orDash(record.deviceModel)}</Field>
				<Field label="IP address" mono>
					{record.ipAddress === null ? (
						NOT_RECORDED
					) : (
						<span className="inline-flex flex-wrap items-center gap-1.5">
							{record.ipAddress}
							{record.ipVersion === null ? null : <span className="text-xs text-muted-foreground">IPv{record.ipVersion}</span>}
						</span>
					)}
				</Field>
				<Field label="Address class">{record.ipScope === null ? NOT_RECORDED : <AuditIpScopeBadge scope={record.ipScope} />}</Field>
				<Field label="Location">{describeLocation(record)}</Field>
				<Field label="Client time zone" mono>
					{orDash(record.geoTimeZone)}
				</Field>
				<Field label="User agent" mono>
					{orDash(record.userAgent)}
				</Field>
			</Section>

			<Section title="Request headers" description="As sent (unverified) — the IP honours trusted proxies only." layout={layout}>
				<Field label="Client app">{orDash(record.clientType)}</Field>
				<Field label="Origin" mono>
					{orDash(record.origin)}
				</Field>
				<Field label="Referer" mono>
					{orDash(record.referer)}
				</Field>
				<Field label="Accept-Language" mono>
					{orDash(record.acceptLanguage)}
				</Field>
				<Field label="Host" mono>
					{orDash(record.host)}
				</Field>
				<Field label="HTTP version" mono>
					{orDash(record.httpVersion)}
				</Field>
				<Field label="Content type" mono>
					{orDash(record.requestContentType)}
				</Field>
				<Field label="Request size">{record.requestBytes === null ? NOT_RECORDED : `${String(record.requestBytes)} bytes`}</Field>
				<Field label="Idempotency key" mono>
					{orDash(record.idempotencyKey)}
				</Field>
			</Section>

			<Section title="Tracing" description="How to find this request in logs, traces and the domain audit tables." layout={layout}>
				<Field label="Correlation id" mono>
					<Link href={auditLogListHref({ correlationId: record.correlationId })} className="text-primary hover:underline">
						{record.correlationId}
					</Link>
				</Field>
				<Field label="Trace id" mono>
					{orDash(record.traceId)}
				</Field>
				<Field label="Error code" mono>
					{orDash(record.errorCode)}
				</Field>
				<Field label="RLS bypasses (system operations)" mono>
					{record.systemOperations.length === 0 ? "None" : record.systemOperations.join(", ")}
				</Field>
				<Field label="Audit record id" mono>
					{record.id}
				</Field>
			</Section>

			<div className={cn("grid gap-4", layout === "page" && "lg:grid-cols-3")}>
				<Payload title="Route params & query" value={record.requestParams} />
				<Payload title="Request body" value={record.requestBody} />
				<Payload title="Response body" value={record.responseBody} />
			</div>
			<p className="text-xs text-muted-foreground">
				Payloads were redacted before they were stored: secrets read [REDACTED], personal data is masked, non-JSON bodies are omitted and anything over 16 KiB is replaced by a
				truncation marker.
			</p>
		</div>
	);
}
