// The person's notification settings on the phone (ADR 070, 073). What reaches them is a tree: each
// kind of message is a checkbox (all of its channels, some, or none) with its channels hung under it
// on a guide line, one checkbox each. A channel kept on shows a lock and says why, one not available
// yet says what to do, and a channel a kind is never sent on is not shown. Then quiet hours and the
// digest, and offers per store. Every change shows the moment it is tapped and is saved behind it
// (use-preference-saves): a failed save puts the server's state back and says so.

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
	type OkResponse,
	type Envelope,
	type SetMarketingConsentInput,
	type UpdateNotificationPreferencesInput,
	withMarketingConsent,
	withPreferenceChanges,
	withSchedule,
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
import { useInstantChoice } from "./use-instant-choice";
import { usePreferenceSaves, type PreferenceSaves } from "./use-preference-saves";
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

/**
 * The settings are never served from the cache: what each channel can do depends on things outside this screen
 * (this phone's push registration, a verified phone number, consent given elsewhere), and a cached answer once
 * showed Phone greyed out ("Turn on notifications on this phone first") under "This phone gets notifications."
 * Each visit asks the API, and nothing is kept once the screen is gone.
 */
const UNCACHED_PREFERENCES: { readonly staleTime: number; readonly gcTime: number; readonly refetchOnMount: "always" } = {
	staleTime: 0,
	gcTime: 0,
	refetchOnMount: "always",
};

export function NotificationSettingsBody(): React.JSX.Element {
	const api = useApi();
	const preferences = api.notifications.preferences.useQuery({}, UNCACHED_PREFERENCES);
	const registration = usePushRegistration();
	const saves = usePreferenceSaves();
	const { refetch } = preferences;
	const retry = React.useCallback((): void => {
		void refetch();
	}, [refetch]);
	// This phone was just registered here: its Phone options are now available, so ask again.
	const registered = registration.outcome?.kind === "registered";
	React.useEffect((): void => {
		if (registered) {
			void refetch();
		}
	}, [refetch, registered]);

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
			<KindsCard preferences={data} registration={registration} saves={saves} />
			<ScheduleCard schedule={data.schedule} saves={saves} />
			<OffersCard preferences={data} saves={saves} />
		</View>
	);
}

/** Turns `channels` of one kind on or off, in one save. */
type ChangeChannels = (category: NotificationCategory, channels: readonly NotificationChannel[], enabled: boolean) => void;

/** The preferences a save answers with. */
function preferencesOf(response: Envelope<NotificationPreferencesResponse>): NotificationPreferencesResponse {
	return response.data;
}

/** A consent save answers only "ok": the preferences are read again. */
function noPreferences(_response: Envelope<OkResponse>): null {
	return null;
}

function KindsCard({
	preferences,
	registration,
	saves,
}: {
	readonly preferences: NotificationPreferencesResponse;
	readonly registration: PushRegistration;
	readonly saves: PreferenceSaves;
}): React.JSX.Element {
	const api = useApi();
	const update = api.notifications.updatePreferences.useMutation(
		saves.optionsFor<UpdateNotificationPreferencesInput, Envelope<NotificationPreferencesResponse>>(withPreferenceChanges, preferencesOf),
	);
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
						<KindNode row={row} onChange={changeChannels} registration={registration} />
					</React.Fragment>
				))}
			</View>
		</Card>
	);
}

interface KindNodeProps {
	readonly row: NotificationPreferenceRow;
	readonly onChange: ChangeChannels;
	readonly registration: PushRegistration;
}

/**
 * One kind of message as a node of the tree: its own checkbox (all of its channels, some, or none; kept
 * on when none can change) and its symbol, then its channels hung under it, one checkbox each.
 */
function KindNode({ row, onChange, registration }: KindNodeProps): React.JSX.Element {
	const kind = categoryKindOf(row.category);
	const checkState = kindCheckStateOf(row);
	const switchable = isKindSwitchable(row);
	// Nothing to change: kept on when every channel is on, faded otherwise.
	const kindLocked = !switchable && checkState === "all";
	const kindDisabled = !switchable && checkState !== "all";
	const title = CATEGORY_LABELS[row.category];
	const saveKind = React.useCallback(
		(enabled: boolean): void => {
			onChange(row.category, kindChannelChangesOf(row, enabled), enabled);
		},
		[onChange, row],
	);
	// The kind's box answers the tap at once (all on, or all off), before the save is queued.
	const kindChoice = useInstantChoice(row, checkState === "all", saveKind);
	// A pending choice is all or nothing: no dash until the setting has caught up.
	const kindIndeterminate = kindChoice.shown === (checkState === "all") && checkState === "some";
	return (
		<View className="px-4 py-2" testID={`notification-kind-${row.category}`}>
			<View className="flex-row items-center gap-3">
				<Checkbox
					label={title}
					description={CATEGORY_DESCRIPTIONS[row.category]}
					checked={kindChoice.shown}
					indeterminate={kindIndeterminate}
					onChange={kindChoice.choose}
					locked={kindLocked}
					disabled={kindDisabled}
					className="flex-1"
					testID={`notification-kind-${row.category}-checkbox`}
				/>
				<IconTile icon={kind.icon} tone={kind.tone} size="sm" />
			</View>
			<TreeBranch accessibilityLabel={title} className="ml-3">
				{shownPreferenceCellsOf(row).map((cell): React.JSX.Element => (
					<ChannelNode key={cell.channel} category={row.category} cell={cell} onChange={onChange} registration={registration} />
				))}
			</TreeBranch>
		</View>
	);
}

interface ChannelNodeProps {
	readonly category: NotificationCategory;
	readonly cell: NotificationPreferenceCell;
	readonly onChange: ChangeChannels;
	readonly registration: PushRegistration;
}

/** One channel of a kind, a leaf of the tree: its checkbox and symbol on one row, then its subtitle, always (what it is, why it is kept on, or what to do to have it). */
function ChannelNode({ category, cell, onChange, registration }: ChannelNodeProps): React.JSX.Element {
	const save = React.useCallback(
		(checked: boolean): void => {
			onChange(category, [cell.channel], checked);
		},
		[category, cell.channel, onChange],
	);
	const state = preferenceCellStateOf(cell);
	// Answers the tap at once, before the save is queued (use-instant-choice).
	const choice = useInstantChoice(cell, state === "on" || state === "locked", save);
	const note = channelNoteOf(category, cell);
	const needsPush = state === "unavailable" && cell.reason === "no-push-device" && registration.outcome?.kind !== "registered";
	return (
		<View>
			<View className="flex-row items-center gap-2">
				<Checkbox
					label={CHANNEL_LABELS[cell.channel]}
					accessibilityHint={note}
					checked={choice.shown}
					onChange={choice.choose}
					locked={state === "locked"}
					disabled={state === "unavailable"}
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
			<Text className="-mt-1.5 pb-2 pl-7.5 font-sans text-sm text-muted-foreground">{note}</Text>
		</View>
	);
}

function ScheduleCard({ schedule, saves }: { readonly schedule: NotificationSchedule; readonly saves: PreferenceSaves }): React.JSX.Element {
	const api = useApi();
	const update = api.notifications.updateSchedule.useMutation(saves.optionsFor<NotificationSchedule, Envelope<NotificationPreferencesResponse>>(withSchedule, preferencesOf));
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
				/>
				<SegmentedControl<NotificationDigestFrequency>
					label={NOTIFICATION_SETTINGS_COPY.digest}
					options={DIGEST_OPTIONS}
					value={schedule.digestFrequency}
					onChange={handleDigest}
				/>
			</View>
		</Card>
	);
}

function OffersCard({ preferences, saves }: { readonly preferences: NotificationPreferencesResponse; readonly saves: PreferenceSaves }): React.JSX.Element {
	const api = useApi();
	const consent = api.notifications.setConsent.useMutation(saves.optionsFor<SetMarketingConsentInput, Envelope<OkResponse>>(withMarketingConsent, noPreferences));
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
				<Switch label={NOTIFICATION_SETTINGS_COPY.platformConsent} checked={preferences.platformMarketingConsent} onChange={handlePlatform} />
				{preferences.tenants.length === 0 ? (
					<Text className="font-sans text-sm text-muted-foreground">{NOTIFICATION_SETTINGS_COPY.noTenants}</Text>
				) : (
					preferences.tenants.map((tenant): React.JSX.Element => (
						<React.Fragment key={tenant.tenantId}>
							<Separator />
							<TenantOffers tenant={tenant} saves={saves} />
						</React.Fragment>
					))
				)}
			</View>
		</Card>
	);
}

/** One store the person claimed from: hear its offers or not, or leave it (asked first). A store they left says so. */
function TenantOffers({ tenant, saves }: { readonly tenant: NotificationTenantSetting; readonly saves: PreferenceSaves }): React.JSX.Element {
	const api = useApi();
	const consent = api.notifications.setConsent.useMutation(saves.optionsFor<SetMarketingConsentInput, Envelope<OkResponse>>(withMarketingConsent, noPreferences));
	// Leaving is asked first and answered when done (it removes the store's offers): it keeps its own feedback.
	const leave = api.notifications.leaveTenant.useMutation(useSaveFeedback());
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
			<Switch label={tenant.tenantName} description={NOTIFICATION_SETTINGS_COPY.tenantConsent} checked={tenant.marketingConsent} onChange={handleConsent} />
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
