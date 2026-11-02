// The inbox as a feed (ADR 070), the way a social app lists notifications: All / Unread chips with
// "mark all as read" and the settings beside them, then "New" (the last day) and "Earlier". Each
// notice is a round picture, the bold title running into the message and how long ago; an unread one
// is tinted. Tapping one reads it and opens the full message in a sheet (a broadcast's rich body, a
// link to follow); its "…" menu marks it read, removes it, reports a broadcast or opens the settings.
//
// Presentational: the smart side (notifications-inbox.tsx) owns the notices and what each action
// does; this screen owns only what is open, and the minute clock the times are read against.

import { BroadcastReportReasonSchema, PLATFORM_DISPLAY_REGION, type BroadcastReportReason, type InAppNotificationResponse } from "@workspace/shared";
import { BottomSheet } from "@workspace/ui-native/components/bottom-sheet";
import { Button } from "@workspace/ui-native/components/button";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { EmptyState, ErrorState } from "@workspace/ui-native/components/empty";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { NotificationRow } from "@workspace/ui-native/components/notification-row";
import { RichTextView } from "@workspace/ui-native/components/rich-text-view";
import { Skeleton, SkeletonGroup, SkeletonText } from "@workspace/ui-native/components/skeleton";
import { BodyText, MutedText, Subheading } from "@workspace/ui-native/components/text";
import { ToggleGroup, type ToggleGroupOption } from "@workspace/ui-native/components/toggle-group";
import * as Clipboard from "expo-clipboard";
import BellIcon from "lucide-react-native/icons/bell";
import CheckIcon from "lucide-react-native/icons/check";
import CheckCheckIcon from "lucide-react-native/icons/check-check";
import CircleXIcon from "lucide-react-native/icons/circle-x";
import EllipsisIcon from "lucide-react-native/icons/ellipsis";
import ExternalLinkIcon from "lucide-react-native/icons/external-link";
import FlagIcon from "lucide-react-native/icons/flag";
import SettingsIcon from "lucide-react-native/icons/settings";
import * as React from "react";
import { Linking, View } from "react-native";

import { useToast } from "../../features/toast/facade";
import { formatDateTime } from "../../lib/time-format";
import { useNow } from "../../lib/use-now";
import { externalLinkOf, feedSectionsOf, isUnread, noticeKindOf, noticeSenderOf, type FeedSection, type InboxFilter } from "./feed-model";
import { NOTIFICATIONS_COPY } from "./labels";

/** The times ("25m") are read against a clock that ticks once a minute. */
const CLOCK_TICK_MS = 60_000;
/** Placeholder rows while the first page loads. */
const SKELETON_ROWS = 4;

/** Where the feed stands: its first page loading, failed, or the notices so far. */
export type NotificationsFeedState =
	| { readonly kind: "loading" }
	| { readonly kind: "error" }
	| { readonly kind: "ready"; readonly notifications: readonly InAppNotificationResponse[]; readonly hasMore: boolean };

export interface NotificationsFeedProps {
	readonly state: NotificationsFeedState;
	readonly filter: InboxFilter;
	readonly onFilterChange: (filter: InboxFilter) => void;
	/** Unread notices on every page (the bell's count): "Mark all as read" waits for one. */
	readonly unreadCount: number;
	/** A change is in flight: the actions wait for it. */
	readonly busy: boolean;
	readonly loadingMore: boolean;
	readonly onLoadMore: () => void;
	readonly onRetry: () => void;
	/** A notice was read (opened, or marked from its menu). */
	readonly onRead: (notification: InAppNotificationResponse) => void;
	readonly onReadAll: () => void;
	readonly onRemove: (notification: InAppNotificationResponse) => void;
	readonly onReport: (notification: InAppNotificationResponse, reason: BroadcastReportReason) => void;
	readonly onOpenSettings: () => void;
}

const FILTER_OPTIONS: readonly ToggleGroupOption<InboxFilter>[] = [
	{ value: "all", label: NOTIFICATIONS_COPY.filters.all },
	{ value: "unread", label: NOTIFICATIONS_COPY.filters.unread },
];

export function NotificationsFeed({
	state,
	filter,
	onFilterChange,
	unreadCount,
	busy,
	loadingMore,
	onLoadMore,
	onRetry,
	onRead,
	onReadAll,
	onRemove,
	onReport,
	onOpenSettings,
}: NotificationsFeedProps): React.JSX.Element {
	const now = useNow({ intervalMs: CLOCK_TICK_MS, running: true });
	const [openedId, setOpenedId] = React.useState<string | null>(null);
	const notifications = state.kind === "ready" ? state.notifications : [];
	const opened = notifications.find((notification: InAppNotificationResponse): boolean => notification.id === openedId) ?? null;

	const changeFilter = React.useCallback(
		(next: InboxFilter | null): void => {
			if (next !== null) {
				onFilterChange(next);
			}
		},
		[onFilterChange],
	);
	const open = React.useCallback(
		(notification: InAppNotificationResponse): void => {
			if (isUnread(notification)) {
				onRead(notification);
			}
			setOpenedId(notification.id);
		},
		[onRead],
	);
	const closeOpened = React.useCallback((): void => {
		setOpenedId(null);
	}, []);

	return (
		<View className="gap-3">
			<View className="flex-row items-center gap-1">
				<ToggleGroup<InboxFilter>
					type="single"
					label={NOTIFICATIONS_COPY.filterLabel}
					options={FILTER_OPTIONS}
					value={filter}
					onChange={changeFilter}
					variant="pill"
					size="sm"
					className="flex-1"
				/>
				<IconButton icon={CheckCheckIcon} label={NOTIFICATIONS_COPY.markAllRead} variant="ghost" size="sm" onPress={onReadAll} disabled={busy || unreadCount === 0} />
				<IconButton icon={SettingsIcon} label={NOTIFICATIONS_COPY.settings} variant="ghost" size="sm" onPress={onOpenSettings} />
			</View>
			{state.kind === "loading" ? <FeedSkeleton /> : null}
			{state.kind === "error" ? <ErrorState message={NOTIFICATIONS_COPY.loadError} retryLabel={NOTIFICATIONS_COPY.retry} onRetry={onRetry} /> : null}
			{state.kind === "ready" && notifications.length === 0 ? (
				<EmptyState icon={BellIcon} message={filter === "unread" ? NOTIFICATIONS_COPY.emptyUnread : NOTIFICATIONS_COPY.empty} />
			) : null}
			{feedSectionsOf(notifications, now).map((section: FeedSection): React.JSX.Element => (
				<View key={section.key} className="gap-1" testID={`notifications-section-${section.key}`}>
					<Subheading accessibilityRole="header" className="px-1 pt-1">
						{NOTIFICATIONS_COPY.sections[section.key]}
					</Subheading>
					{section.notifications.map((notification: InAppNotificationResponse): React.JSX.Element => (
						<FeedRow
							key={notification.id}
							notification={notification}
							now={now}
							busy={busy}
							onOpen={open}
							onRead={onRead}
							onRemove={onRemove}
							onReport={onReport}
							onOpenSettings={onOpenSettings}
						/>
					))}
				</View>
			))}
			{state.kind === "ready" && state.hasMore ? <Button label={NOTIFICATIONS_COPY.seeEarlier} variant="secondary" onPress={onLoadMore} loading={loadingMore} /> : null}
			<OpenedNotice notification={opened} onClose={closeOpened} />
		</View>
	);
}

/** What a notice's "…" menu can do. A report names its reason, so each reason is its own item. */
type NoticeAction = "read" | "remove" | "settings" | BroadcastReportReason;

function menuItemsOf(notification: InAppNotificationResponse): readonly DropdownMenuItemData<NoticeAction>[] {
	const read: readonly DropdownMenuItemData<NoticeAction>[] = isUnread(notification) ? [{ value: "read", label: NOTIFICATIONS_COPY.markRead, icon: CheckIcon }] : [];
	const reports: readonly DropdownMenuItemData<NoticeAction>[] =
		notification.broadcastId === null
			? []
			: BroadcastReportReasonSchema.options.map((reason: BroadcastReportReason): DropdownMenuItemData<NoticeAction> => ({
					value: reason,
					label: NOTIFICATIONS_COPY.reportAs[reason],
					icon: FlagIcon,
					variant: "destructive",
				}));
	return [
		...read,
		{ value: "remove", label: NOTIFICATIONS_COPY.remove, icon: CircleXIcon },
		...reports,
		{ value: "settings", label: NOTIFICATIONS_COPY.settings, icon: SettingsIcon },
	];
}

interface FeedRowProps {
	readonly notification: InAppNotificationResponse;
	readonly now: number;
	readonly busy: boolean;
	readonly onOpen: (notification: InAppNotificationResponse) => void;
	readonly onRead: (notification: InAppNotificationResponse) => void;
	readonly onRemove: (notification: InAppNotificationResponse) => void;
	readonly onReport: (notification: InAppNotificationResponse, reason: BroadcastReportReason) => void;
	readonly onOpenSettings: () => void;
}

function FeedRow({ notification, now, busy, onOpen, onRead, onRemove, onReport, onOpenSettings }: FeedRowProps): React.JSX.Element {
	const kind = noticeKindOf(notification);
	const items = React.useMemo(() => menuItemsOf(notification), [notification]);
	const handleOpen = React.useCallback((): void => {
		onOpen(notification);
	}, [notification, onOpen]);
	const handleAction = React.useCallback(
		(action: NoticeAction): void => {
			if (action === "read") {
				onRead(notification);
			} else if (action === "remove") {
				onRemove(notification);
			} else if (action === "settings") {
				onOpenSettings();
			} else {
				onReport(notification, action);
			}
		},
		[notification, onOpenSettings, onRead, onRemove, onReport],
	);
	return (
		<NotificationRow
			title={notification.title}
			body={notification.body}
			sender={noticeSenderOf(notification)}
			icon={kind.icon}
			tone={kind.tone}
			createdAt={notification.createdAt}
			now={now}
			locale={PLATFORM_DISPLAY_REGION.locale}
			unread={isUnread(notification)}
			onPress={handleOpen}
			unreadLabel={NOTIFICATIONS_COPY.unread}
			accessibilityHint={NOTIFICATIONS_COPY.openHint}
			testID={`notification-${notification.id}`}
			trailing={
				<DropdownMenu<NoticeAction>
					label={NOTIFICATIONS_COPY.more(notification.title)}
					title={NOTIFICATIONS_COPY.menuTitle}
					items={items}
					onSelect={handleAction}
					icon={EllipsisIcon}
					variant="ghost"
					size="icon"
					disabled={busy}
					className="rounded-full"
				/>
			}
		/>
	);
}

interface OpenedNoticeProps {
	readonly notification: InAppNotificationResponse | null;
	readonly onClose: () => void;
}

/** The full message of the notice tapped: who sent it and when, its rich body or text, and its link. */
function OpenedNotice({ notification, onClose }: OpenedNoticeProps): React.JSX.Element {
	const toast = useToast();
	const link = notification === null ? null : externalLinkOf(notification);
	const openLink = React.useCallback((href: string): void => {
		void Linking.openURL(href);
	}, []);
	const followLink = React.useCallback((): void => {
		if (link !== null) {
			void Linking.openURL(link);
		}
	}, [link]);
	const copyCode = React.useCallback(
		(code: string): void => {
			void Clipboard.setStringAsync(code).then((): void => {
				toast.success(NOTIFICATIONS_COPY.copied);
			});
		},
		[toast],
	);
	return (
		<BottomSheet visible={notification !== null} title={notification?.title ?? NOTIFICATIONS_COPY.menuTitle} onClose={onClose} testID="notification-message">
			{notification === null ? null : (
				<View className="gap-3 pb-2">
					<View className="gap-0.5">
						{notification.senderName === null ? null : <BodyText className="font-sans-semibold">{notification.senderName}</BodyText>}
						<MutedText>{formatDateTime(notification.createdAt)}</MutedText>
					</View>
					{notification.richBody === null ? (
						<BodyText>{notification.body}</BodyText>
					) : (
						<RichTextView document={notification.richBody} onOpenLink={openLink} onCopyCode={copyCode} />
					)}
					{link === null ? null : <Button label={NOTIFICATIONS_COPY.openLink} icon={ExternalLinkIcon} variant="secondary" onPress={followLink} />}
				</View>
			)}
		</BottomSheet>
	);
}

/** Four rows of placeholder: the picture, two lines of message and the time. */
function FeedSkeleton(): React.JSX.Element {
	return (
		<SkeletonGroup accessibilityLabel={NOTIFICATIONS_COPY.description} className="gap-1">
			{Array.from({ length: SKELETON_ROWS }, (_unused: undefined, row: number): React.JSX.Element => (
				<View key={row} className="flex-row items-center gap-3 px-3 py-2.5">
					<Skeleton className="size-14 rounded-full" />
					<View className="flex-1 gap-1">
						<SkeletonText size="base" widthClassName="w-11/12" />
						<SkeletonText size="base" widthClassName="w-2/3" />
						<SkeletonText size="sm" widthClassName="w-12" />
					</View>
				</View>
			))}
		</SkeletonGroup>
	);
}
