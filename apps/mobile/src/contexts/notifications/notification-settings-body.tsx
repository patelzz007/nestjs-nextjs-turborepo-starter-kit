// The person's notification settings on the phone (ADR 070, 073). What reaches them is a tree: each
// kind of message is a checkbox (all of its channels, some, or none) with its channels hung under it
// on a guide line, one checkbox each. A channel kept on shows a lock and says why, one not available
// yet says what to do, and a channel a kind is never sent on is not shown. Then quiet hours and the
// digest, and offers per store. Every change is saved at once.

import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/api-client";
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
} from "@workspace/shared";
import { AlertDialog } from "@workspace/ui-native/components/alert-dialog";
import { Button } from "@workspace/ui-native/components/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@workspace/ui-native/components/card";
import { Checkbox } from "@workspace/ui-native/components/checkbox";
import { ErrorState, LoadingState } from "@workspace/ui-native/components/empty";
import { Icon } from "@workspace/ui-native/components/icon";
import { IconTile } from "@workspace/ui-native/components/icon-tile";
import { SegmentedControl, type SegmentedOption } from "@workspace/ui-native/components/segmented-control";
import { Separator } from "@workspace/ui-native/components/separator";
import { Switch } from "@workspace/ui-native/components/switch";
import { TreeBranch } from "@workspace/ui-native/components/tree-branch";
import * as React from "react";
import { Text, View } from "react-native";

import { useToast } from "../../features/toast/facade";
import { useApi } from "../../lib/api-context";
import { categoryKindOf } from "./feed-model";
import { CATEGORY_DESCRIPTIONS, CATEGORY_LABELS, CHANNEL_LABELS, DIGEST_LABELS, NOTIFICATION_SETTINGS_COPY } from "./labels";
import { PushPermissionPrimer } from "./push-permission-primer";
import { CHANNEL_ICONS, channelNoteOf } from "./settings-model";
import { usePushRegistration, type PushRegistration } from "./use-push-registration";

const MINUTES_PER_HOUR = 60;
const TIME_PART_WIDTH = 2;

/** A minute of the day as `HH:mm`. */
export function minuteToTime(minute: number): string {
	return `${String(Math.floor(minute / MINUTES_PER_HOUR)).padStart(TIME_PART_WIDTH, "0")}:${String(minute % MINUTES_PER_HOUR).padStart(TIME_PART_WIDTH, "0")}`;
}

const DIGEST_OPTIONS: readonly SegmentedOption<NotificationDigestFrequency>[] = NotificationDigestFrequencySchema.options.map((value) => ({
	value,
	label: DIGEST_LABELS[value],
}));

function useSaveFeedback(): { readonly onSuccess: () => void; readonly onError: () => void } {
	const queryClient = useQueryClient();
	const toast = useToast();
	return React.useMemo(
		() => ({
			onSuccess: (): void => {
				void queryClient.invalidateQueries({ queryKey: apiRouter.notifications.preferences.scopeKey(undefined) });
				toast.success(NOTIFICATION_SETTINGS_COPY.saved);
			},
			onError: (): void => {
				void queryClient.invalidateQueries({ queryKey: apiRouter.notifications.preferences.scopeKey(undefined) });
				toast.error(NOTIFICATION_SETTINGS_COPY.saveFailed);
			},
		}),
		[queryClient, toast],
	);
}

export function NotificationSettingsBody(): React.JSX.Element {
	const api = useApi();
	const preferences = api.notifications.preferences.useQuery({});
	const registration = usePushRegistration();
	const { refetch } = preferences;
	const retry = React.useCallback((): void => {
		void refetch();
	}, [refetch]);

	if (preferences.isError) {
		return <ErrorState message={NOTIFICATION_SETTINGS_COPY.loadError} retryLabel="Try again" onRetry={retry} />;
	}
	const data = preferences.data?.data;
	if (data === undefined) {
		return <LoadingState label={NOTIFICATION_SETTINGS_COPY.description} />;
	}
	return (
		<View className="gap-4">
			<PushPermissionPrimer registration={registration} />
			<KindsCard preferences={data} registration={registration} />
			<ScheduleCard schedule={data.schedule} />
			<OffersCard preferences={data} />
		</View>
	);
}

/** Turns `channels` of one kind on or off, in one save. */
type ChangeChannels = (category: NotificationCategory, channels: readonly NotificationChannel[], enabled: boolean) => void;

function KindsCard({ preferences, registration }: { readonly preferences: NotificationPreferencesResponse; readonly registration: PushRegistration }): React.JSX.Element {
	const api = useApi();
	const update = api.notifications.updatePreferences.useMutation(useSaveFeedback());
	const { mutate } = update;
	const changeChannels = React.useCallback<ChangeChannels>(
		(category, channels, enabled): void => {
			if (channels.length > 0) {
				mutate({ tenantId: preferences.tenantId, changes: channels.map((channel) => ({ category, channel, enabled })) });
			}
		},
		[mutate, preferences.tenantId],
	);
	return (
		// Full-bleed rows: the card's own padding moves to its header.
		<Card className="gap-0 overflow-hidden p-0">
			<CardHeader className="p-4">
				<CardTitle>{NOTIFICATION_SETTINGS_COPY.whatReachesYou}</CardTitle>
				<CardDescription>{NOTIFICATION_SETTINGS_COPY.whatReachesYouHint}</CardDescription>
			</CardHeader>
			<View>
				{preferences.categories.map((row): React.JSX.Element => (
					<React.Fragment key={row.category}>
						<Separator />
						<KindNode row={row} onChange={changeChannels} saving={update.isPending} registration={registration} />
					</React.Fragment>
				))}
			</View>
		</Card>
	);
}

interface KindNodeProps {
	readonly row: NotificationPreferenceRow;
	readonly onChange: ChangeChannels;
	readonly saving: boolean;
	readonly registration: PushRegistration;
}

/**
 * One kind of message as a node of the tree: its own checkbox (all of its channels, some, or none; kept
 * on when none can change) and its symbol, then its channels hung under it, one checkbox each.
 */
function KindNode({ row, onChange, saving, registration }: KindNodeProps): React.JSX.Element {
	const kind = categoryKindOf(row.category);
	const checkState = kindCheckStateOf(row);
	const switchable = isKindSwitchable(row);
	// Nothing to change: kept on when every channel is on, faded otherwise.
	const kindLocked = !switchable && checkState === "all";
	const kindDisabled = !switchable && checkState !== "all";
	const title = CATEGORY_LABELS[row.category];
	const handleKind = React.useCallback(
		(enabled: boolean): void => {
			onChange(row.category, kindChannelChangesOf(row, enabled), enabled);
		},
		[onChange, row],
	);
	return (
		<View className="px-4 py-2" testID={`notification-kind-${row.category}`}>
			<View className="flex-row items-center gap-3">
				<Checkbox
					label={title}
					description={CATEGORY_DESCRIPTIONS[row.category]}
					checked={checkState === "all"}
					indeterminate={checkState === "some"}
					onChange={handleKind}
					locked={kindLocked}
					disabled={kindDisabled}
					loading={saving}
					className="flex-1"
					testID={`notification-kind-${row.category}-checkbox`}
				/>
				<IconTile icon={kind.icon} tone={kind.tone} size="sm" />
			</View>
			<TreeBranch accessibilityLabel={title} className="ml-3">
				{shownPreferenceCellsOf(row).map((cell): React.JSX.Element => (
					<ChannelNode key={cell.channel} category={row.category} cell={cell} onChange={onChange} saving={saving} registration={registration} />
				))}
			</TreeBranch>
		</View>
	);
}

interface ChannelNodeProps {
	readonly category: NotificationCategory;
	readonly cell: NotificationPreferenceCell;
	readonly onChange: ChangeChannels;
	readonly saving: boolean;
	readonly registration: PushRegistration;
}

/** One channel of a kind, a leaf of the tree: its checkbox and symbol on one row, then why it is kept on or what to do to have it. */
function ChannelNode({ category, cell, onChange, saving, registration }: ChannelNodeProps): React.JSX.Element {
	const handleChange = React.useCallback(
		(checked: boolean): void => {
			onChange(category, [cell.channel], checked);
		},
		[category, cell.channel, onChange],
	);
	const state = preferenceCellStateOf(cell);
	const note = channelNoteOf(category, cell);
	const needsPush = state === "unavailable" && cell.reason === "no-push-device" && registration.outcome?.kind !== "registered";
	return (
		<View>
			<View className="flex-row items-center gap-2">
				<Checkbox
					label={CHANNEL_LABELS[cell.channel]}
					{...(note === null ? {} : { accessibilityHint: note })}
					checked={state === "on" || state === "locked"}
					onChange={handleChange}
					locked={state === "locked"}
					disabled={state === "unavailable"}
					loading={saving}
					size="sm"
					className="flex-1"
					testID={`notification-channel-${category}-${cell.channel}`}
				/>
				{needsPush ? (
					<Button label={NOTIFICATION_SETTINGS_COPY.turnOnPush} variant="secondary" size="sm" onPress={registration.enable} disabled={registration.busy} />
				) : (
					<Icon icon={CHANNEL_ICONS[cell.channel]} size="md" colorClassName={state === "unavailable" ? "accent-muted-foreground" : "accent-foreground"} />
				)}
			</View>
			{/* Under the label (box 20 + gap 10 = 30pt), so the row the guide points at stays one line. */}
			{note === null ? null : <Text className="-mt-1.5 pb-2 pl-7.5 font-sans text-sm text-muted-foreground">{note}</Text>}
		</View>
	);
}

function ScheduleCard({ schedule }: { readonly schedule: NotificationSchedule }): React.JSX.Element {
	const api = useApi();
	const update = api.notifications.updateSchedule.useMutation(useSaveFeedback());
	const { mutate } = update;
	const handleQuiet = React.useCallback(
		(quietHoursEnabled: boolean): void => {
			mutate({ ...schedule, quietHoursEnabled });
		},
		[mutate, schedule],
	);
	const handleDigest = React.useCallback(
		(digestFrequency: NotificationDigestFrequency): void => {
			mutate({ ...schedule, digestFrequency });
		},
		[mutate, schedule],
	);
	return (
		<Card title={NOTIFICATION_SETTINGS_COPY.quietAndDigest}>
			<View className="gap-4">
				<Switch
					label={NOTIFICATION_SETTINGS_COPY.quietHours}
					description={NOTIFICATION_SETTINGS_COPY.quietHoursHint(minuteToTime(schedule.quietStartMinute), minuteToTime(schedule.quietEndMinute), schedule.timeZone)}
					checked={schedule.quietHoursEnabled}
					onChange={handleQuiet}
					loading={update.isPending}
				/>
				<SegmentedControl<NotificationDigestFrequency>
					label={NOTIFICATION_SETTINGS_COPY.digest}
					options={DIGEST_OPTIONS}
					value={schedule.digestFrequency}
					onChange={handleDigest}
					disabled={update.isPending}
				/>
			</View>
		</Card>
	);
}

function OffersCard({ preferences }: { readonly preferences: NotificationPreferencesResponse }): React.JSX.Element {
	const api = useApi();
	const consent = api.notifications.setConsent.useMutation(useSaveFeedback());
	const { mutate } = consent;
	const handlePlatform = React.useCallback(
		(granted: boolean): void => {
			mutate({ scope: "PLATFORM", tenantId: null, granted, wordingVersion: MARKETING_CONSENT_WORDING_VERSION, source: "SETTINGS" });
		},
		[mutate],
	);
	return (
		<Card title={NOTIFICATION_SETTINGS_COPY.offers} description={NOTIFICATION_SETTINGS_COPY.offersHint}>
			<View className="gap-3">
				<Switch label={NOTIFICATION_SETTINGS_COPY.platformConsent} checked={preferences.platformMarketingConsent} onChange={handlePlatform} loading={consent.isPending} />
				{preferences.tenants.length === 0 ? (
					<Text className="font-sans text-sm text-muted-foreground">{NOTIFICATION_SETTINGS_COPY.noTenants}</Text>
				) : (
					preferences.tenants.map((tenant): React.JSX.Element => (
						<React.Fragment key={tenant.tenantId}>
							<Separator />
							<TenantOffers tenant={tenant} />
						</React.Fragment>
					))
				)}
			</View>
		</Card>
	);
}

/** One store the person claimed from: hear its offers or not, or leave it (asked first). A store they left says so. */
function TenantOffers({ tenant }: { readonly tenant: NotificationTenantSetting }): React.JSX.Element {
	const api = useApi();
	const feedback = useSaveFeedback();
	const consent = api.notifications.setConsent.useMutation(feedback);
	const leave = api.notifications.leaveTenant.useMutation(feedback);
	const { mutate: consentMutate } = consent;
	const { mutate: leaveMutate } = leave;
	const [confirming, setConfirming] = React.useState(false);
	const handleConsent = React.useCallback(
		(granted: boolean): void => {
			consentMutate({ scope: "TENANT", tenantId: tenant.tenantId, granted, wordingVersion: MARKETING_CONSENT_WORDING_VERSION, source: "SETTINGS" });
		},
		[consentMutate, tenant.tenantId],
	);
	const handleAsk = React.useCallback((): void => {
		setConfirming(true);
	}, []);
	const handleCancel = React.useCallback((): void => {
		setConfirming(false);
	}, []);
	const handleLeave = React.useCallback((): void => {
		leaveMutate(
			{ tenantId: tenant.tenantId },
			{
				onSettled: (): void => {
					setConfirming(false);
				},
			},
		);
	}, [leaveMutate, tenant.tenantId]);
	if (tenant.left) {
		return (
			<View className="gap-0.5">
				<Text className="font-sans text-base text-muted-foreground">{tenant.tenantName}</Text>
				<Text className="font-sans text-sm text-muted-foreground">{NOTIFICATION_SETTINGS_COPY.leftTenant}</Text>
			</View>
		);
	}
	return (
		<View className="gap-1">
			<Switch
				label={tenant.tenantName}
				description={NOTIFICATION_SETTINGS_COPY.tenantConsent}
				checked={tenant.marketingConsent}
				onChange={handleConsent}
				loading={consent.isPending}
			/>
			<Button label={NOTIFICATION_SETTINGS_COPY.leave} variant="ghost" size="sm" className="self-start" onPress={handleAsk} disabled={leave.isPending} />
			<AlertDialog
				visible={confirming}
				title={NOTIFICATION_SETTINGS_COPY.leaveTitle(tenant.tenantName)}
				description={NOTIFICATION_SETTINGS_COPY.leaveDescription}
				confirmLabel={NOTIFICATION_SETTINGS_COPY.leave}
				cancelLabel={NOTIFICATION_SETTINGS_COPY.cancel}
				onConfirm={handleLeave}
				onCancel={handleCancel}
				pending={leave.isPending}
				destructive
			/>
		</View>
	);
}
