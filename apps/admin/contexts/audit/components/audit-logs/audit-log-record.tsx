import type { AuditErrorDetail, AuditErrorLink, AuditLogUser, AuditRequestHeaders, HttpAuditLogDetail } from "@workspace/shared";
import { cn } from "@workspace/ui/lib/core/utils";
import Link from "next/link";
import type * as React from "react";

import { formatDateTimeWithSeconds } from "@/lib/format/dates";
import { countryFlag, countryName } from "@/lib/format/country";
import { auditLogListHref } from "@/contexts/audit/url-state/audit-logs";

import { AuditActorCell, AuditAuthMethodBadge, AuditDeviceBadge, AuditIpScopeBadge, AuditMethodBadge, AuditOutcomeBadge, describeClientSoftware } from "./audit-log-badges";
import { NOT_RECORDED, orDash, RecordField, RecordPayload, RecordSection, type AuditRecordLayout } from "./record-layout";

/** The three payload panels' grid, per layout. */
export const AUDIT_LOG_RECORD_PAYLOAD_GRID_BY_LAYOUT: Readonly<Record<AuditRecordLayout, string>> = {
	page: "lg:grid-cols-3",
	drawer: "",
};

/** A user named by the record, with a link to everything they did. */
function UserField({ label, user }: { readonly label: string; readonly user: AuditLogUser | null }): React.JSX.Element {
	return (
		<RecordField label={label}>
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
		</RecordField>
	);
}

/** What a claimed id says against the verified one: `matches`, `differs from the verified …`, or `not verified`. */
export function describeClaim(claimed: string | null, verified: string | null, noun: string): string | null {
	if (claimed === null) {
		return null;
	}
	if (verified === null) {
		return `not verified: the API resolved no ${noun}`;
	}
	return claimed === verified ? `matches the verified ${noun}` : `differs from the verified ${noun}`;
}

/** A header the client sent to name its scope, with how it compares to what the API verified. */
function ClaimField({
	label,
	claimed,
	verified,
	noun,
}: {
	readonly label: string;
	readonly claimed: string | null;
	readonly verified: string | null;
	readonly noun: string;
}): React.JSX.Element {
	const comparison: string | null = describeClaim(claimed, verified, noun);
	return (
		<RecordField label={label}>
			{claimed === null ? (
				"Not sent"
			) : (
				<span className="space-y-0.5">
					<span className="block font-mono">{claimed}</span>
					<span className={cn("block text-xs", claimed === verified ? "text-muted-foreground" : "text-destructive")}>{comparison}</span>
				</span>
			)}
		</RecordField>
	);
}

/** `PrismaClientKnownRequestError [P2025]` — an error's class and the code it carried. */
function errorHeading(link: AuditErrorLink): string {
	return link.code === null ? link.type : `${link.type} [${link.code}]`;
}

/**
 * Why the request failed, as the server saw it: the exception behind the
 * error code the caller was shown, its causes and — for a server fault —
 * where it was thrown.
 */
function FailureReason({ errorCode, detail }: { readonly errorCode: string | null; readonly detail: AuditErrorDetail | null }): React.JSX.Element {
	return (
		<section aria-labelledby="audit-failure-reason" className="space-y-3 rounded-lg border border-destructive/40 bg-card p-4">
			<div>
				<h3 id="audit-failure-reason" className="text-sm font-semibold">
					Why it failed
				</h3>
				<p className="text-xs text-muted-foreground">
					What the server knew. The caller was only told {errorCode === null ? "that it failed" : <span className="font-mono">{errorCode}</span>}.
				</p>
			</div>
			{detail === null ? (
				<p className="text-sm text-muted-foreground">Not recorded: this record was written before failure reasons were kept.</p>
			) : (
				<div className="space-y-3">
					<div className="space-y-1">
						<p className="font-mono text-xs font-semibold break-all">{errorHeading(detail)}</p>
						<p className="text-sm break-words whitespace-pre-wrap">{detail.message.length === 0 ? "No message." : detail.message}</p>
					</div>
					{detail.causes.length === 0 ? null : (
						<ol className="space-y-2 border-l-2 pl-3">
							{detail.causes.map((cause: AuditErrorLink, index: number) => (
								<li key={`${String(index)}-${cause.type}`} className="space-y-0.5">
									<p className="text-xs text-muted-foreground">
										Caused by <span className="font-mono font-semibold text-foreground">{errorHeading(cause)}</span>
									</p>
									<p className="text-sm break-words whitespace-pre-wrap">{cause.message}</p>
								</li>
							))}
						</ol>
					)}
					{detail.stack.length === 0 ? null : (
						<div className="space-y-1">
							<p className="text-xs font-medium text-muted-foreground">Where it was thrown</p>
							<pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">{detail.stack.join("\n")}</pre>
						</div>
					)}
				</div>
			)}
		</section>
	);
}

/** Every header the request carried, by name, credentials already redacted by the API. */
function RequestHeaderList({ headers }: { readonly headers: AuditRequestHeaders | null }): React.JSX.Element {
	const entries: [string, string][] = headers === null ? [] : Object.entries(headers);
	return (
		<section className="min-w-0 space-y-2 rounded-lg border bg-card p-4">
			<div>
				<h3 className="text-sm font-semibold">All request headers</h3>
				<p className="text-xs text-muted-foreground">As sent. Credentials read [REDACTED]; a cookie header lists the cookie names only.</p>
			</div>
			{entries.length === 0 ? (
				<p className="text-sm text-muted-foreground">{headers === null ? "Not recorded: this record was written before headers were kept." : "No headers."}</p>
			) : (
				<dl className="grid gap-x-4 gap-y-1 rounded-md bg-muted p-3 font-mono text-xs sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
					{entries.map(([name, value]) => (
						<div key={name} className="contents">
							<dt className="font-semibold break-all">{name}</dt>
							<dd className="break-all">{value}</dd>
						</div>
					))}
				</dl>
			)}
		</section>
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
 * back to the table filtered by that actor / tenant / correlation id.
 */
export function AuditLogRecord({ record, layout }: { readonly record: HttpAuditLogDetail; readonly layout: AuditRecordLayout }): React.JSX.Element {
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

			{record.outcome === "FAILED" ? <FailureReason errorCode={record.errorCode} detail={record.errorDetail} /> : null}

			<RecordSection
				title="Who"
				description="The verified principal and tenant. The X-Tenant-Id and X-Location-Id headers are what the client claimed, shown against what the API verified."
				layout={layout}>
				<UserField label="Actor" user={record.actor} />
				<UserField label="Impersonated by" user={record.impersonator} />
				<RecordField label="Device session" mono>
					{orDash(record.sessionId)}
				</RecordField>
				<RecordField label="Impersonation session" mono>
					{orDash(record.impersonationSessionId)}
				</RecordField>
				<RecordField label="Support grant" mono>
					{orDash(record.supportAccessGrantId)}
				</RecordField>
				<RecordField label="Credential">
					<AuditAuthMethodBadge authMethod={record.authMethod} />
				</RecordField>
				<RecordField label="API key" mono>
					{orDash(record.apiKeyId)}
				</RecordField>
				<RecordField label="POS terminal" mono>
					{orDash(record.terminalId)}
				</RecordField>
				<RecordField label="Tenant">
					{record.tenant === null ? (
						NOT_RECORDED
					) : (
						<Link href={auditLogListHref({ tenantId: record.tenant.id })} className="text-primary hover:underline">
							{record.tenant.name ?? record.tenant.id}
						</Link>
					)}
				</RecordField>
				<RecordField label="Location" mono>
					{orDash(record.locationId)}
				</RecordField>
				<ClaimField label="X-Tenant-Id (claimed)" claimed={record.claimedTenantId} verified={record.tenant?.id ?? null} noun="tenant" />
				<ClaimField label="X-Location-Id (claimed)" claimed={record.claimedLocationId} verified={record.locationId} noun="location" />
			</RecordSection>

			<RecordSection title="When" description="Server clock, shown in your time zone." layout={layout}>
				<RecordField label="Received">{formatDateTimeWithSeconds(record.occurredAt)}</RecordField>
				<RecordField label="Completed">{formatDateTimeWithSeconds(record.completedAt)}</RecordField>
				<RecordField label="Duration">{record.durationMs} ms</RecordField>
				<RecordField label="Recorded">{formatDateTimeWithSeconds(record.createdAt)}</RecordField>
			</RecordSection>

			<RecordSection
				title="Device & location"
				description="Parsed from the User-Agent (what the client claimed) and the address; the location comes from the CDN edge, so it is empty when the API is not behind one."
				layout={layout}>
				<RecordField label="Device">{record.deviceType === null ? NOT_RECORDED : <AuditDeviceBadge deviceType={record.deviceType} />}</RecordField>
				<RecordField label="Browser / client · OS">{software ?? NOT_RECORDED}</RecordField>
				<RecordField label="Device model">{orDash(record.deviceModel)}</RecordField>
				<RecordField label="IP address" mono>
					{record.ipAddress === null ? (
						NOT_RECORDED
					) : (
						<span className="inline-flex flex-wrap items-center gap-1.5">
							{record.ipAddress}
							{record.ipVersion === null ? null : <span className="text-xs text-muted-foreground">IPv{record.ipVersion}</span>}
						</span>
					)}
				</RecordField>
				<RecordField label="Address class">{record.ipScope === null ? NOT_RECORDED : <AuditIpScopeBadge scope={record.ipScope} />}</RecordField>
				<RecordField label="Location">{describeLocation(record)}</RecordField>
				<RecordField label="Client time zone" mono>
					{orDash(record.geoTimeZone)}
				</RecordField>
				<RecordField label="User agent" mono>
					{orDash(record.userAgent)}
				</RecordField>
			</RecordSection>

			<RecordSection title="Request headers" description="As sent (unverified) — the IP honours trusted proxies only." layout={layout}>
				<RecordField label="Client app">{orDash(record.clientType)}</RecordField>
				<RecordField label="Origin" mono>
					{orDash(record.origin)}
				</RecordField>
				<RecordField label="Referer" mono>
					{orDash(record.referer)}
				</RecordField>
				<RecordField label="Accept-Language" mono>
					{orDash(record.acceptLanguage)}
				</RecordField>
				<RecordField label="Host" mono>
					{orDash(record.host)}
				</RecordField>
				<RecordField label="HTTP version" mono>
					{orDash(record.httpVersion)}
				</RecordField>
				<RecordField label="Content type" mono>
					{orDash(record.requestContentType)}
				</RecordField>
				<RecordField label="Request size">{record.requestBytes === null ? NOT_RECORDED : `${String(record.requestBytes)} bytes`}</RecordField>
				<RecordField label="Idempotency key" mono>
					{orDash(record.idempotencyKey)}
				</RecordField>
			</RecordSection>

			<RequestHeaderList headers={record.requestHeaders} />

			<RecordSection title="Tracing" description="How to find this request in logs, traces and the domain audit tables." layout={layout}>
				<RecordField label="Correlation id" mono>
					<Link href={auditLogListHref({ correlationId: record.correlationId })} className="text-primary hover:underline">
						{record.correlationId}
					</Link>
				</RecordField>
				<RecordField label="Trace id" mono>
					{orDash(record.traceId)}
				</RecordField>
				<RecordField label="Error code" mono>
					{orDash(record.errorCode)}
				</RecordField>
				<RecordField label="RLS bypasses (system operations)" mono>
					{record.systemOperations.length === 0 ? "None" : record.systemOperations.join(", ")}
				</RecordField>
				<RecordField label="Audit record id" mono>
					{record.id}
				</RecordField>
			</RecordSection>

			<div className={cn("grid gap-4", AUDIT_LOG_RECORD_PAYLOAD_GRID_BY_LAYOUT[layout])}>
				<RecordPayload title="Route params & query" value={record.requestParams} />
				<RecordPayload title="Request body" value={record.requestBody} />
				<RecordPayload title="Response body" value={record.responseBody} />
			</div>
			<p className="text-xs text-muted-foreground">
				Payloads were redacted before they were stored: secrets read [REDACTED], personal data is masked, non-JSON bodies are omitted and anything over 16 KiB is replaced by a
				truncation marker.
			</p>
		</div>
	);
}
