"use client";

import type { DeviceType, DisplayRegion, Session } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { RelativeTime } from "@workspace/ui/components/relative-time";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";
import { Bot, CircleHelp, Monitor, Smartphone, Tablet, type LucideIcon } from "lucide-react";
import { useCallback, type JSX } from "react";

import type { SignedInDevicesLabels } from "./signed-in-devices-labels";

/** The icon of a device class (a session stored before device classes were recorded has none). */
const DEVICE_TYPE_ICON: Readonly<Record<DeviceType, LucideIcon>> = {
	DESKTOP: Monitor,
	MOBILE: Smartphone,
	TABLET: Tablet,
	BOT: Bot,
	UNKNOWN: CircleHelp,
};

/** `14.2` → `14.2`; a browser name with its major version: `Chrome 141`. */
function withMajorVersion(name: string | null, version: string | null): string | null {
	if (name === null) {
		return null;
	}
	const major: string | undefined = version?.split(".").at(0);
	return major === undefined || major.length === 0 ? name : `${name} ${major}`;
}

/** `Kuala Lumpur, Kuala Lumpur, MY` without the parts the provider did not know. */
function locationText(location: NonNullable<Session["location"]>): string {
	return [location.city, location.region, location.country].filter((part): part is string => part !== null).join(", ");
}

export interface DeviceSessionRowProps {
	readonly session: Session;
	readonly labels: SignedInDevicesLabels;
	readonly region: DisplayRegion;
	/** Asks to revoke this session; absent for the current session (it signs out through "Sign out" instead). */
	readonly onRevokeRequest?: ((session: Session) => void) | undefined;
	readonly isRevoking?: boolean | undefined;
}

/**
 * One signed-in device (docs/technical/mobile/mobile-app.md §8.8): its label,
 * app, platform (browser and OS, or model and app version for the mobile app),
 * sign-in method, first and last IP, location when known, and when it signed
 * in, was last active and expires. Presentational: the data and the revoke
 * action come from the caller. Every value is rendered as text.
 */
export function DeviceSessionRow({ session, labels, region, onRevokeRequest, isRevoking = false }: DeviceSessionRowProps): JSX.Element {
	const Icon: LucideIcon = DEVICE_TYPE_ICON[session.deviceType ?? "UNKNOWN"];
	const isMobileApp: boolean = session.clientType === "mobile";
	const platform: string = isMobileApp
		? labels.platform(session.deviceModel, session.osName)
		: labels.platform(withMajorVersion(session.browserName, session.browserVersion), withMajorVersion(session.osName, session.osVersion));
	const handleRevoke = useCallback((): void => {
		onRevokeRequest?.(session);
	}, [onRevokeRequest, session]);

	return (
		<li className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between" aria-current={session.isCurrent ? "true" : undefined}>
			<div className="flex min-w-0 gap-3">
				<span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
					<Icon className="size-5" aria-hidden="true" />
				</span>
				<div className="min-w-0 space-y-2">
					<div className="flex flex-wrap items-center gap-2">
						<p className="truncate font-medium">{session.label}</p>
						<Badge variant="outline">{session.clientType === null ? labels.unknownClientType : labels.clientTypes[session.clientType]}</Badge>
						{session.isCurrent ? <StatusBadge tone="success">{labels.thisDevice}</StatusBadge> : null}
					</div>
					{platform.length > 0 ? <p className="text-sm text-muted-foreground">{platform}</p> : null}
					<dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
						{session.appVersion === null ? null : (
							<div className="flex gap-1">
								<dt className="text-muted-foreground">{labels.fields.app}:</dt>
								<dd>{labels.appVersion(session.appVersion)}</dd>
							</div>
						)}
						{session.signInMethod === null ? null : (
							<div className="flex gap-1">
								<dt className="text-muted-foreground">{labels.fields.signInMethod}:</dt>
								<dd>{labels.signInMethods[session.signInMethod]}</dd>
							</div>
						)}
						{session.ipAddress === null ? null : (
							<div className="flex gap-1">
								<dt className="text-muted-foreground">{labels.fields.ipAddress}:</dt>
								<dd className="font-mono">{session.ipAddress}</dd>
							</div>
						)}
						{session.lastIpAddress === null ? null : (
							<div className="flex gap-1">
								<dt className="text-muted-foreground">{labels.fields.lastIpAddress}:</dt>
								<dd className="font-mono">{session.lastIpAddress}</dd>
							</div>
						)}
						{session.location === null ? null : (
							<div className="flex gap-1">
								<dt className="text-muted-foreground">{labels.fields.location}:</dt>
								<dd>{locationText(session.location)}</dd>
							</div>
						)}
						<div className="flex gap-1">
							<dt className="text-muted-foreground">{labels.fields.signedIn}:</dt>
							<dd>{formatEpochMs(session.createdAt, "dateTime", region)}</dd>
						</div>
						<div className="flex gap-1">
							<dt className="text-muted-foreground">{labels.fields.lastActive}:</dt>
							<dd>
								<RelativeTime epochMs={session.lastActiveAt} region={region} />
							</dd>
						</div>
						<div className="flex gap-1">
							<dt className="text-muted-foreground">{labels.fields.expires}:</dt>
							<dd>
								<RelativeTime epochMs={session.expiresAt} region={region} />
							</dd>
						</div>
					</dl>
				</div>
			</div>
			{session.isCurrent || onRevokeRequest === undefined ? null : (
				<Button type="button" variant="outline" size="sm" className="self-start" onClick={handleRevoke} loading={isRevoking} aria-label={labels.revokeDevice(session.label)}>
					{labels.revoke}
				</Button>
			)}
		</li>
	);
}
