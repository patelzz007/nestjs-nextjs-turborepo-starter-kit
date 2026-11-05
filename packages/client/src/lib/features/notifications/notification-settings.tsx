"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
	MARKETING_CONSENT_WORDING_VERSION,
	NotificationDigestFrequencySchema,
	isKindSwitchable,
	kindChannelChangesOf,
	kindCheckStateOf,
	preferenceCellStateOf,
	shownPreferenceCellsOf,
	type NotificationCategory,
	type NotificationChannel,
	type NotificationDigestFrequency,
	type NotificationPreferenceCell,
	type NotificationPreferenceRow,
	type NotificationPreferencesResponse,
	type NotificationSchedule,
	type NotificationTenantSetting,
	type PushDeviceResponse,
} from "@workspace/shared";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@workspace/ui/components/alert-dialog";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { IconTile } from "@workspace/ui/components/icon-tile";
import { Label } from "@workspace/ui/components/label";
import { Select, SelectContent, SelectItem, type SelectOption, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Switch } from "@workspace/ui/components/switch";
import { TimePicker } from "@workspace/ui/components/time-picker";
import { toastMessage } from "@workspace/ui/components/toast";
import { TreeBranch, TreeNodeText } from "@workspace/ui/components/tree-branch";
import { cn } from "@workspace/ui/lib/core/utils";
import { useCallback, useMemo, useState, type JSX } from "react";

import { apiRouter } from "../../api/endpoints";
import { useAuth } from "../../contexts/identity";
import { NOTIFICATION_CHANNEL_ICONS, NOTIFICATION_KIND_LOOKS } from "./notification-kinds";
import { NOTIFICATION_SETTINGS_LABELS, type NotificationSettingsLabels } from "./notification-settings-labels";
import { channelNoteOf } from "./notification-settings-model";

const MINUTES_PER_HOUR = 60;
const TIME_PART_WIDTH = 2;

/** A minute of the day as `HH:mm`. */
export function minuteToTime(minute: number): string {
	return `${String(Math.floor(minute / MINUTES_PER_HOUR)).padStart(TIME_PART_WIDTH, "0")}:${String(minute % MINUTES_PER_HOUR).padStart(TIME_PART_WIDTH, "0")}`;
}

/** `HH:mm` (or `HH:mm:ss`) as a minute of the day, or null when it is not a time. */
export function timeToMinute(time: string): number | null {
	const parts = /^(?<hour>\d{2}):(?<minute>\d{2})/u.exec(time)?.groups;
	if (parts === undefined) {
		return null;
	}
	return Number(parts.hour) * MINUTES_PER_HOUR + Number(parts.minute);
}

/** The device's own zone, offered as the quiet-hours zone. */
function deviceTimeZone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export interface NotificationSettingsProps {
	readonly labels?: NotificationSettingsLabels;
}

/**
 * The signed-in person's notification settings (ADR 070, 073): what reaches them on which channel, quiet
 * hours and the digest, marketing consent per sender, and their phones. Shared by every app; each cell's
 * lock and availability come from the API, which enforces them again on save.
 *
 * Layout: one column on narrow screens. From `lg`, the tree of kinds fills the main column (two kinds side
 * by side from `2xl`) and the smaller settings stack in a side column that stays in view while the tree scrolls,
 * so a wide screen has no empty band beside short rows.
 */
export function NotificationSettings({ labels = NOTIFICATION_SETTINGS_LABELS }: NotificationSettingsProps): JSX.Element {
	const { api } = useAuth();
	const preferences = api.notifications.preferences.useQuery({});
	const devices = api.notifications.pushDevices.useQuery(undefined);
	const data = preferences.data?.data;

	return (
		<div className="space-y-6">
			<header className="space-y-1">
				<h1 className="text-2xl font-semibold tracking-tight">{labels.title}</h1>
				<p className="max-w-prose text-sm text-muted-foreground">{labels.description}</p>
			</header>
			{preferences.isError ? <p className="text-sm text-destructive">{labels.loadError}</p> : null}
			<div data-testid="notification-settings-layout" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:items-start">
				{data === undefined ? <Skeleton className="h-96 w-full rounded-xl" /> : <KindsCard preferences={data} labels={labels} />}
				<div data-testid="notification-settings-side" className="space-y-6 lg:sticky lg:top-6">
					{data === undefined ? (
						<Skeleton className="h-48 w-full rounded-xl" />
					) : (
						<>
							<ScheduleCard schedule={data.schedule} labels={labels} />
							<ConsentCard preferences={data} labels={labels} />
						</>
					)}
					<DevicesCard devices={devices.data?.data} labels={labels} />
				</div>
			</div>
		</div>
	);
}

function usePreferencesRefresh(): () => void {
	const queryClient = useQueryClient();
	return useCallback((): void => {
		void queryClient.invalidateQueries({ queryKey: apiRouter.notifications.preferences.scopeKey(undefined) });
	}, [queryClient]);
}

function useSaved(labels: NotificationSettingsLabels): { readonly onSuccess: () => void; readonly onError: () => void } {
	const refresh = usePreferencesRefresh();
	return useMemo(
		() => ({
			onSuccess: (): void => {
				refresh();
				toastMessage.success({ title: labels.saved });
			},
			onError: (): void => {
				refresh();
				toastMessage.error({ title: labels.saveFailed });
			},
		}),
		[labels.saved, labels.saveFailed, refresh],
	);
}

/** Turns `channels` of one kind on or off, in one save. */
type ChangeChannels = (category: NotificationCategory, channels: readonly NotificationChannel[], enabled: boolean) => void;

/** What reaches the person, as a tree: each kind of message, then its channels hung under it. */
function KindsCard({ preferences, labels }: { readonly preferences: NotificationPreferencesResponse; readonly labels: NotificationSettingsLabels }): JSX.Element {
	const { api } = useAuth();
	const saved = useSaved(labels);
	const update = api.notifications.updatePreferences.useMutation(saved);
	const { mutate } = update;
	const handleChange = useCallback<ChangeChannels>(
		(category, channels, enabled): void => {
			if (channels.length > 0) {
				mutate({ tenantId: preferences.tenantId, changes: channels.map((channel) => ({ category, channel, enabled })) });
			}
		},
		[mutate, preferences.tenantId],
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{labels.kindsTitle}</CardTitle>
				<CardDescription>{labels.kindsDescription}</CardDescription>
			</CardHeader>
			<CardContent className="px-0">
				{/* One kind per row; two side by side from `2xl`, with the rule between them drawn by the left one. */}
				<ul className="grid border-t border-border 2xl:grid-cols-2">
					{preferences.categories.map((row): JSX.Element => (
						<li key={row.category} className="border-b border-border 2xl:odd:border-e">
							<KindNode row={row} labels={labels} onChange={handleChange} saving={update.isPending} />
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}

interface KindNodeProps {
	readonly row: NotificationPreferenceRow;
	readonly labels: NotificationSettingsLabels;
	readonly onChange: ChangeChannels;
	readonly saving: boolean;
}

/**
 * One kind of message as a node of the tree: its own checkbox (all of its channels, some, or none; kept
 * on when none can change), its symbol and what it is about, then its channels hung under it.
 */
function KindNode({ row, labels, onChange, saving }: KindNodeProps): JSX.Element {
	const look = NOTIFICATION_KIND_LOOKS[row.category];
	const KindIcon = look.icon;
	const checkState = kindCheckStateOf(row);
	const switchable = isKindSwitchable(row);
	// Nothing to change: kept on when every channel is on, faded otherwise.
	const kindLocked = !switchable && checkState === "all";
	const kindDisabled = !switchable && checkState !== "all";
	const title = labels.categories[row.category].title;
	const handleCheckedChange = useCallback(
		(checked: boolean): void => {
			onChange(row.category, kindChannelChangesOf(row, checked), checked);
		},
		[onChange, row],
	);
	const checkboxId = `notification-kind-${row.category}-checkbox`;
	return (
		<div className="px-6 py-5" data-testid={`notification-kind-${row.category}`}>
			<div className="flex items-center gap-3">
				<Checkbox
					id={checkboxId}
					checked={checkState === "all"}
					indeterminate={checkState === "some"}
					onCheckedChange={handleCheckedChange}
					locked={kindLocked}
					disabled={kindDisabled}
					loading={saving}
					aria-label={title}
				/>
				<IconTile tone={look.tone}>
					<KindIcon />
				</IconTile>
				<Label htmlFor={checkboxId} className="flex min-w-0 flex-1">
					<TreeNodeText title={title} description={labels.categories[row.category].description} />
				</Label>
			</div>
			<TreeBranch aria-label={title} className="ms-2 mt-3">
				{shownPreferenceCellsOf(row).map((cell): JSX.Element => (
					<ChannelNode key={cell.channel} category={row.category} cell={cell} labels={labels} onChange={onChange} saving={saving} />
				))}
			</TreeBranch>
		</div>
	);
}

interface ChannelNodeProps {
	readonly category: NotificationCategory;
	readonly cell: NotificationPreferenceCell;
	readonly labels: NotificationSettingsLabels;
	readonly onChange: ChangeChannels;
	readonly saving: boolean;
}

/** One channel of a kind, a leaf of the tree: its checkbox, its symbol, its name and, always, a subtitle (what it is, why it is kept on, or what to do to have it). */
function ChannelNode({ category, cell, labels, onChange, saving }: ChannelNodeProps): JSX.Element {
	const handleCheckedChange = useCallback(
		(checked: boolean): void => {
			onChange(category, [cell.channel], checked);
		},
		[category, cell.channel, onChange],
	);
	const state = preferenceCellStateOf(cell);
	const note = channelNoteOf(category, cell, labels);
	const ChannelIcon = NOTIFICATION_CHANNEL_ICONS[cell.channel];
	const checkboxId = `notification-${category}-${cell.channel}`;
	return (
		<div className="flex items-center gap-3 py-1.5">
			<Checkbox
				id={checkboxId}
				checked={state === "on" || state === "locked"}
				onCheckedChange={handleCheckedChange}
				locked={state === "locked"}
				disabled={state === "unavailable"}
				loading={saving}
				aria-label={`${labels.categories[category].title}: ${labels.channels[cell.channel]}`}
			/>
			<ChannelIcon className={cn("size-4 shrink-0", state === "unavailable" ? "text-muted-foreground" : "text-foreground")} aria-hidden="true" />
			<Label htmlFor={checkboxId} className="flex min-w-0 flex-1">
				<TreeNodeText title={labels.channels[cell.channel]} description={note} muted={state === "unavailable"} />
			</Label>
		</div>
	);
}

const DIGEST_OPTIONS_OF = (labels: NotificationSettingsLabels): readonly SelectOption<NotificationDigestFrequency>[] =>
	NotificationDigestFrequencySchema.options.map((value) => ({ value, label: labels.digest[value] }));

function ScheduleCard({ schedule, labels }: { readonly schedule: NotificationSchedule; readonly labels: NotificationSettingsLabels }): JSX.Element {
	const { api } = useAuth();
	const saved = useSaved(labels);
	const update = api.notifications.updateSchedule.useMutation(saved);
	const { mutate } = update;
	const save = useCallback(
		(change: Partial<NotificationSchedule>): void => {
			mutate({ ...schedule, ...change });
		},
		[mutate, schedule],
	);
	const handleQuiet = useCallback(
		(quietHoursEnabled: boolean): void => {
			save({ quietHoursEnabled });
		},
		[save],
	);
	const handleStart = useCallback(
		(value: string | null): void => {
			const minute = value === null ? null : timeToMinute(value);
			if (minute !== null) {
				save({ quietStartMinute: minute });
			}
		},
		[save],
	);
	const handleEnd = useCallback(
		(value: string | null): void => {
			const minute = value === null ? null : timeToMinute(value);
			if (minute !== null) {
				save({ quietEndMinute: minute });
			}
		},
		[save],
	);
	const handleDigest = useCallback(
		(value: string | null): void => {
			const parsed = NotificationDigestFrequencySchema.safeParse(value);
			if (parsed.success) {
				save({ digestFrequency: parsed.data });
			}
		},
		[save],
	);
	const handleUseDeviceZone = useCallback((): void => {
		save({ timeZone: deviceTimeZone() });
	}, [save]);
	const digestOptions = useMemo(() => DIGEST_OPTIONS_OF(labels), [labels]);
	const zone = deviceTimeZone();

	return (
		<Card>
			<CardHeader>
				<CardTitle>{labels.scheduleTitle}</CardTitle>
				<CardDescription>{labels.scheduleDescription}</CardDescription>
			</CardHeader>
			<CardContent className="space-y-5">
				<div className="flex items-center justify-between gap-4">
					<Label htmlFor="quiet-hours">{labels.quietHours}</Label>
					<Switch id="quiet-hours" checked={schedule.quietHoursEnabled} onCheckedChange={handleQuiet} disabled={update.isPending} />
				</div>
				{schedule.quietHoursEnabled ? (
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-1.5">
							<Label id="quiet-start-label">{labels.quietFrom}</Label>
							<TimePicker value={minuteToTime(schedule.quietStartMinute)} onValueChange={handleStart} hourCycle={24} minuteStep={15} aria-labelledby="quiet-start-label" />
						</div>
						<div className="space-y-1.5">
							<Label id="quiet-end-label">{labels.quietUntil}</Label>
							<TimePicker value={minuteToTime(schedule.quietEndMinute)} onValueChange={handleEnd} hourCycle={24} minuteStep={15} aria-labelledby="quiet-end-label" />
						</div>
					</div>
				) : null}
				<p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
					{labels.timeZone(schedule.timeZone)}
					{schedule.timeZone === zone ? null : (
						<Button type="button" variant="link" className="h-auto p-0" onClick={handleUseDeviceZone}>
							{labels.useDeviceZone(zone)}
						</Button>
					)}
				</p>
				<div className="space-y-1.5">
					<Label htmlFor="digest">{labels.digestLabel}</Label>
					<Select<NotificationDigestFrequency> items={digestOptions} value={schedule.digestFrequency} onValueChange={handleDigest} disabled={update.isPending}>
						<SelectTrigger id="digest" className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{digestOptions.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</CardContent>
		</Card>
	);
}

function ConsentCard({ preferences, labels }: { readonly preferences: NotificationPreferencesResponse; readonly labels: NotificationSettingsLabels }): JSX.Element {
	const { api } = useAuth();
	const saved = useSaved(labels);
	const consent = api.notifications.setConsent.useMutation(saved);
	const { mutate } = consent;
	const handlePlatform = useCallback(
		(granted: boolean): void => {
			mutate({ scope: "PLATFORM", tenantId: null, granted, wordingVersion: MARKETING_CONSENT_WORDING_VERSION, source: "SETTINGS" });
		},
		[mutate],
	);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{labels.consentTitle}</CardTitle>
				<CardDescription>{labels.consentDescription}</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex items-center justify-between gap-4">
					<Label htmlFor="platform-consent">{labels.platformConsent}</Label>
					<Switch id="platform-consent" checked={preferences.platformMarketingConsent} onCheckedChange={handlePlatform} disabled={consent.isPending} />
				</div>
				{preferences.tenants.length === 0 ? (
					<p className="text-sm text-muted-foreground">{labels.noTenants}</p>
				) : (
					<ul className="divide-y divide-border">
						{preferences.tenants.map((tenant): JSX.Element => (
							<li key={tenant.tenantId}>
								<TenantConsentRow tenant={tenant} labels={labels} />
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}

/** One store the person is a customer of: hear from it or not, or leave it (asked first). A store they left says so. */
function TenantConsentRow({ tenant, labels }: { readonly tenant: NotificationTenantSetting; readonly labels: NotificationSettingsLabels }): JSX.Element {
	const { api } = useAuth();
	const saved = useSaved(labels);
	const consent = api.notifications.setConsent.useMutation(saved);
	const leave = api.notifications.leaveTenant.useMutation(saved);
	const { mutate: consentMutate } = consent;
	const { mutate: leaveMutate } = leave;
	const [confirming, setConfirming] = useState(false);
	const handleConsent = useCallback(
		(granted: boolean): void => {
			consentMutate({ scope: "TENANT", tenantId: tenant.tenantId, granted, wordingVersion: MARKETING_CONSENT_WORDING_VERSION, source: "SETTINGS" });
		},
		[consentMutate, tenant.tenantId],
	);
	const handleAsk = useCallback((): void => {
		setConfirming(true);
	}, []);
	const handleOpenChange = useCallback(
		(open: boolean): void => {
			if (!leave.isPending) {
				setConfirming(open);
			}
		},
		[leave.isPending],
	);
	const handleLeave = useCallback((): void => {
		leaveMutate(
			{ tenantId: tenant.tenantId },
			{
				onSettled: (): void => {
					setConfirming(false);
				},
			},
		);
	}, [leaveMutate, tenant.tenantId]);
	const switchId = `tenant-consent-${tenant.tenantId}`;
	if (tenant.left) {
		return (
			<div className="flex flex-col gap-0.5 py-3">
				<span className="font-medium text-muted-foreground">{tenant.tenantName}</span>
				<span className="text-xs text-muted-foreground">{labels.leftTenant}</span>
			</div>
		);
	}
	return (
		<div className="flex flex-wrap items-center justify-between gap-3 py-3">
			<Label htmlFor={switchId} className="flex flex-col items-start gap-0.5">
				<span className="font-medium">{tenant.tenantName}</span>
				<span className="text-xs font-normal text-muted-foreground">{labels.tenantConsent}</span>
			</Label>
			<div className="flex items-center gap-3">
				<Button type="button" size="sm" variant="ghost" onClick={handleAsk} disabled={leave.isPending}>
					{labels.leave}
				</Button>
				<Switch id={switchId} checked={tenant.marketingConsent} onCheckedChange={handleConsent} loading={consent.isPending} />
			</div>
			<AlertDialog open={confirming} onOpenChange={handleOpenChange}>
				<AlertDialogContent
					severity="critical"
					align="start"
					actionOrder="cancel-first"
					labels={{ confirm: labels.leave, loading: labels.leaving }}
					confirmLoading={leave.isPending}
					onConfirm={handleLeave}>
					<AlertDialogTitle>{labels.leaveTitle(tenant.tenantName)}</AlertDialogTitle>
					<AlertDialogDescription>{labels.leaveDescription}</AlertDialogDescription>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

function DevicesCard({ devices, labels }: { readonly devices: readonly PushDeviceResponse[] | undefined; readonly labels: NotificationSettingsLabels }): JSX.Element {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{labels.devicesTitle}</CardTitle>
				<CardDescription>{labels.devicesDescription}</CardDescription>
			</CardHeader>
			<CardContent>
				{devices === undefined ? (
					<Skeleton className="h-16 w-full" />
				) : devices.length === 0 ? (
					<p className="text-sm text-muted-foreground">{labels.noDevices}</p>
				) : (
					<ul className="divide-y divide-border">
						{devices.map((device): JSX.Element => (
							<li key={device.id}>
								<DeviceRow device={device} labels={labels} />
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}

function DeviceRow({ device, labels }: { readonly device: PushDeviceResponse; readonly labels: NotificationSettingsLabels }): JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const remove = api.notifications.removePushDevice.useMutation({
		onSuccess: (): void => {
			void queryClient.invalidateQueries({ queryKey: apiRouter.notifications.pushDevices.scopeKey(undefined) });
			toastMessage.success({ title: labels.deviceRemoved });
		},
		onError: (): void => {
			toastMessage.error({ title: labels.saveFailed });
		},
	});
	const { mutate } = remove;
	const handleRemove = useCallback((): void => {
		mutate({ deviceId: device.id });
	}, [device.id, mutate]);
	return (
		<div className="flex flex-wrap items-center justify-between gap-3 py-3">
			<div className="flex flex-col">
				<span className="text-sm font-medium">
					{device.deviceLabel ?? labels.platforms[device.platform]}
					{device.isCurrentSession ? <span className="ms-2 text-xs text-muted-foreground">{labels.thisDevice}</span> : null}
				</span>
				<span className="text-xs text-muted-foreground">{labels.lastSeen(device.lastSeenAt)}</span>
			</div>
			<Button type="button" size="sm" variant="outline" onClick={handleRemove} disabled={remove.isPending}>
				{labels.removeDevice}
			</Button>
		</div>
	);
}
