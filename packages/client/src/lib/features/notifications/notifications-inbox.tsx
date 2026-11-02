"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
	BroadcastReportReasonSchema,
	LIST_FIRST_PAGE,
	NotificationCategorySchema,
	PLATFORM_DISPLAY_REGION,
	type BroadcastReportReason,
	type DisplayRegion,
	type InAppNotificationResponse,
} from "@workspace/shared";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty";
import { IconTile } from "@workspace/ui/components/icon-tile";
import { ListPager } from "@workspace/ui/components/list-pager";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { RelativeTime } from "@workspace/ui/components/relative-time";
import { RichTextView } from "@workspace/ui/components/rich-text-view";
import { Select, SelectContent, SelectItem, type SelectOption, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import { toastMessage } from "@workspace/ui/components/toast";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { getUserInitials } from "@workspace/ui/lib/core/user-initials";
import { cn } from "@workspace/ui/lib/core/utils";
import { Archive, Check, ExternalLink, Flag } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState, type JSX } from "react";

import { readPaginatedHasNext, readPaginatedTotalPages } from "../../api/envelope";
import { apiRouter } from "../../api/endpoints";
import { useAuth, useAuthClientType } from "../../contexts/identity";
import { useUrlState } from "../../url-state/use-url-state";
import { NOTIFICATION_KIND_LOOKS } from "./notification-kinds";
import { notificationLinkTarget } from "./notification-link";
import { NOTIFICATION_SURFACE_OF_CLIENT } from "./notification-surface";
import { NOTIFICATIONS_INBOX_LABELS, type NotificationsInboxLabels } from "./notifications-inbox-labels";
import {
	NOTIFICATIONS_INBOX_URL_STATE,
	NotificationInboxKindSchema,
	NotificationInboxViewSchema,
	toInboxQuery,
	type NotificationInboxKind,
} from "./notifications-inbox-url-state";
import { notificationsPollInterval, useNotificationsLive } from "./use-notifications-live";
import { useOpenNotification } from "./use-open-notification";

const INBOX_SCOPE = apiRouter.notifications.inbox.scopeKey(undefined);

export interface NotificationRowProps {
	readonly notification: InAppNotificationResponse;
	readonly region: DisplayRegion;
	readonly labels: NotificationsInboxLabels;
	readonly onOpen: (notification: InAppNotificationResponse) => void;
	readonly onMarkRead: (notification: InAppNotificationResponse) => void;
	readonly onArchive: (notification: InAppNotificationResponse) => void;
	/** Report a broadcast (only rows that came from one offer it). */
	readonly onReport?: ((notification: InAppNotificationResponse, reason: BroadcastReportReason) => void) | undefined;
	/** True while a mark-read or archive is in flight (the row's buttons wait for it). */
	readonly busy: boolean;
}

/** Its picture: the sender's logo or initials (a store), or the symbol of its kind (the app itself). */
function NotificationPicture({ notification }: { readonly notification: InAppNotificationResponse }): JSX.Element {
	const look = NOTIFICATION_KIND_LOOKS[notification.category];
	const KindIcon = look.icon;
	if (notification.senderName !== null) {
		return (
			<Avatar className="mt-0.5">
				{notification.senderLogoUrl === null ? null : <AvatarImage src={notification.senderLogoUrl} alt="" />}
				<AvatarFallback>{getUserInitials(notification.senderName)}</AvatarFallback>
			</Avatar>
		);
	}
	return (
		<IconTile tone={look.tone} className="mt-0.5">
			<KindIcon />
		</IconTile>
	);
}

/**
 * One notification, in full: its kind and sender, its title and whole text (every line), when it came
 * (relative, and the exact time beside it), a button to open what it is about, and its read / archive /
 * report actions. Stateless.
 */
export function NotificationRow({ notification, region, labels, onOpen, onMarkRead, onArchive, onReport, busy }: NotificationRowProps): JSX.Element {
	const read = notification.readAt !== null;
	const [expanded, setExpanded] = useState(false);
	const handleToggle = useCallback((): void => {
		setExpanded((current) => !current);
	}, []);
	const archived = notification.archivedAt !== null;
	const handleOpen = useCallback((): void => {
		onOpen(notification);
	}, [notification, onOpen]);
	const handleMarkRead = useCallback((): void => {
		onMarkRead(notification);
	}, [notification, onMarkRead]);
	const handleArchive = useCallback((): void => {
		onArchive(notification);
	}, [notification, onArchive]);
	const opens = notificationLinkTarget(notification.link) !== null;

	return (
		<li className={cn("flex items-start gap-3 px-4 py-4 sm:px-5", read ? undefined : "bg-primary/[0.04]")} data-read={String(read)} data-category={notification.category}>
			<NotificationPicture notification={notification} />
			<div className="min-w-0 flex-1 space-y-1.5">
				<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
					<span className="font-medium text-foreground/80">{labels.kinds[notification.category]}</span>
					{notification.senderName === null ? null : <span className="font-medium">{notification.senderName}</span>}
					<RelativeTime epochMs={notification.createdAt} region={region} />
					{notification.groupCount > 1 ? <StatusBadge tone="neutral">{labels.grouped(notification.groupCount)}</StatusBadge> : null}
				</div>
				<div className="flex items-start gap-2">
					<Button
						type="button"
						variant="link"
						className="h-auto max-w-full min-w-0 justify-start p-0 text-start text-sm font-semibold wrap-anywhere whitespace-normal text-foreground"
						onClick={handleOpen}>
						{notification.title}
					</Button>
					{read ? null : <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" role="img" aria-label={labels.unread} />}
				</div>
				{expanded && notification.richBody !== null ? (
					<RichTextView document={notification.richBody} className="rounded-lg border border-border bg-background p-3" />
				) : (
					<p className="text-sm wrap-anywhere whitespace-pre-line text-muted-foreground">{notification.body}</p>
				)}
				{opens || notification.richBody !== null ? (
					<div className="flex flex-wrap items-center gap-3 pt-1">
						{opens ? (
							<Button type="button" variant="outline" size="sm" onClick={handleOpen}>
								{labels.open}
								<ExternalLink className="size-3.5" aria-hidden="true" />
							</Button>
						) : null}
						{notification.richBody === null ? null : (
							<Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={handleToggle} aria-expanded={expanded}>
								{expanded ? labels.readLess : labels.readMore}
							</Button>
						)}
					</div>
				) : null}
			</div>
			<div className="flex shrink-0 items-center gap-1">
				{read ? null : (
					<Button type="button" variant="ghost" size="icon" aria-label={labels.markRead} disabled={busy} onClick={handleMarkRead}>
						<Check className="size-4" aria-hidden="true" />
					</Button>
				)}
				{archived ? null : (
					<Button type="button" variant="ghost" size="icon" aria-label={labels.archive} disabled={busy} onClick={handleArchive}>
						<Archive className="size-4" aria-hidden="true" />
					</Button>
				)}
				{notification.broadcastId === null || onReport === undefined ? null : (
					<ReportBroadcastButton notification={notification} labels={labels} onReport={onReport} busy={busy} />
				)}
			</div>
		</li>
	);
}

interface ReportBroadcastButtonProps {
	readonly notification: InAppNotificationResponse;
	readonly labels: NotificationsInboxLabels;
	readonly onReport: (notification: InAppNotificationResponse, reason: BroadcastReportReason) => void;
	readonly busy: boolean;
}

/** The report button of a broadcast row: pick why, and it goes to the platform's reviewers. */
function ReportBroadcastButton({ notification, labels, onReport, busy }: ReportBroadcastButtonProps): JSX.Element {
	const [open, setOpen] = useState(false);
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger render={<Button type="button" variant="ghost" size="icon" aria-label={labels.report} disabled={busy} />}>
				<Flag className="size-4" aria-hidden="true" />
			</PopoverTrigger>
			<PopoverContent align="end" className="w-64">
				<p className="mb-2 text-sm font-medium">{labels.reportTitle}</p>
				<div className="flex flex-col gap-1">
					{BroadcastReportReasonSchema.options.map((reason): JSX.Element => (
						<ReportReasonButton key={reason} reason={reason} label={labels.reportReasons[reason]} notification={notification} onReport={onReport} onDone={setOpen} />
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
}

interface ReportReasonButtonProps {
	readonly reason: BroadcastReportReason;
	readonly label: string;
	readonly notification: InAppNotificationResponse;
	readonly onReport: (notification: InAppNotificationResponse, reason: BroadcastReportReason) => void;
	readonly onDone: (open: boolean) => void;
}

function ReportReasonButton({ reason, label, notification, onReport, onDone }: ReportReasonButtonProps): JSX.Element {
	const handleClick = useCallback((): void => {
		onReport(notification, reason);
		onDone(false);
	}, [notification, onDone, onReport, reason]);
	return (
		<Button type="button" variant="ghost" className="justify-start" onClick={handleClick}>
			{label}
		</Button>
	);
}

/** The kind filter's options: every kind first, then each kind of message. */
export function kindOptionsOf(labels: NotificationsInboxLabels): readonly SelectOption<NotificationInboxKind>[] {
	return [
		{ value: "any", label: labels.kindOptions.any },
		...NotificationCategorySchema.options.map((category): SelectOption<NotificationInboxKind> => ({ value: category, label: labels.kindOptions[category] })),
	];
}

export interface NotificationsInboxProps {
	/** Locale and time zone the notification times are shown in. */
	readonly region?: DisplayRegion;
	readonly labels?: NotificationsInboxLabels;
	/** This app's notification settings page, linked from the header. */
	readonly settingsHref?: string | undefined;
}

/**
 * The full inbox of THIS app (ADR 070): the inbox, its unread part and the archive, a page at a time (the
 * view and page live in the URL). Live like the bell: a frame from the stream refetches the page.
 */
export function NotificationsInbox({ region = PLATFORM_DISPLAY_REGION, labels = NOTIFICATIONS_INBOX_LABELS, settingsHref }: NotificationsInboxProps): JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const surface = NOTIFICATION_SURFACE_OF_CLIENT[useAuthClientType()];
	const [urlState, updateUrlState] = useUrlState(NOTIFICATIONS_INBOX_URL_STATE);
	const liveState = useNotificationsLive(surface);
	const query = useMemo(() => toInboxQuery(surface, urlState), [surface, urlState]);
	const inbox = api.notifications.inbox.useQuery(query, { refetchInterval: notificationsPollInterval(liveState) });
	const unread = api.notifications.unreadCount.useQuery({ surface });
	const markRead = api.notifications.read.useMutation();
	const archive = api.notifications.archive.useMutation();
	const report = api.notifications.reportBroadcast.useMutation();
	const openNotification = useOpenNotification(surface);

	const refresh = useCallback((): void => {
		void queryClient.invalidateQueries({ queryKey: INBOX_SCOPE });
	}, [queryClient]);
	const handleView = useCallback(
		(value: string | number | null): void => {
			const view = NotificationInboxViewSchema.safeParse(value);
			if (view.success) {
				updateUrlState({ view: view.data, page: LIST_FIRST_PAGE });
			}
		},
		[updateUrlState],
	);
	const handleKind = useCallback(
		(value: string | null): void => {
			const kind = NotificationInboxKindSchema.safeParse(value);
			if (kind.success) {
				updateUrlState({ kind: kind.data, page: LIST_FIRST_PAGE });
			}
		},
		[updateUrlState],
	);
	const kindOptions = useMemo((): readonly SelectOption<NotificationInboxKind>[] => kindOptionsOf(labels), [labels]);
	const handleMarkRead = useCallback(
		(notification: InAppNotificationResponse): void => {
			markRead.mutate({ surface, notificationIds: [notification.id] }, { onSuccess: refresh });
		},
		[markRead, refresh, surface],
	);
	const handleMarkAllRead = useCallback((): void => {
		markRead.mutate({ surface, markAll: true }, { onSuccess: refresh });
	}, [markRead, refresh, surface]);
	const handleArchive = useCallback(
		(notification: InAppNotificationResponse): void => {
			archive.mutate({ notificationIds: [notification.id] }, { onSuccess: refresh });
		},
		[archive, refresh],
	);
	const handleReport = useCallback(
		(notification: InAppNotificationResponse, reason: BroadcastReportReason): void => {
			if (notification.broadcastId === null) {
				return;
			}
			report.mutate(
				{ broadcastId: notification.broadcastId, reason, note: null },
				{
					onSuccess: (): void => {
						toastMessage.success({ title: labels.reported });
					},
				},
			);
		},
		[labels.reported, report],
	);
	const handlePrevious = useCallback((): void => {
		updateUrlState({ page: Math.max(LIST_FIRST_PAGE, urlState.page - 1) });
	}, [updateUrlState, urlState.page]);
	const handleNext = useCallback((): void => {
		updateUrlState({ page: urlState.page + 1 });
	}, [updateUrlState, urlState.page]);

	const notifications = inbox.data?.data ?? [];
	const unreadCount = unread.data?.data.unread ?? 0;
	const busy = markRead.isPending || archive.isPending || report.isPending;

	return (
		<div className="space-y-6">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<h1 className="text-2xl font-semibold tracking-tight">{labels.title}</h1>
						<StatusBadge tone={liveState === "open" ? "success" : "muted"}>{liveState === "open" ? labels.live : labels.polling}</StatusBadge>
					</div>
					<p className="text-sm text-muted-foreground">{labels.description}</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					{settingsHref === undefined ? null : (
						<Link href={settingsHref} className={buttonVariants({ variant: "ghost" })}>
							{labels.settings}
						</Link>
					)}
					<Button type="button" variant="outline" disabled={unreadCount === 0 || busy} onClick={handleMarkAllRead}>
						{labels.markAllRead}
					</Button>
				</div>
			</header>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Tabs value={urlState.view} onValueChange={handleView}>
					<TabsList>
						{NotificationInboxViewSchema.options.map((view) => (
							<TabsTrigger key={view} value={view}>
								{labels.views[view]}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
				<Select<NotificationInboxKind> items={kindOptions} value={urlState.kind} onValueChange={handleKind}>
					<SelectTrigger className="w-full sm:w-56" aria-label={labels.kindFilter}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{kindOptions.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			{inbox.isError ? (
				<Empty>
					<EmptyHeader>
						<EmptyTitle>{labels.loadError}</EmptyTitle>
					</EmptyHeader>
					<Button type="button" variant="outline" onClick={refresh}>
						{labels.retry}
					</Button>
				</Empty>
			) : null}
			{!inbox.isError && !inbox.isPending && notifications.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyDescription>{urlState.kind === "any" ? labels.empty[urlState.view] : labels.emptyKind}</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : null}
			{notifications.length > 0 ? (
				<ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
					{notifications.map((notification: InAppNotificationResponse) => (
						<NotificationRow
							key={notification.id}
							notification={notification}
							region={region}
							labels={labels}
							onOpen={openNotification}
							onMarkRead={handleMarkRead}
							onArchive={handleArchive}
							onReport={handleReport}
							busy={busy}
						/>
					))}
				</ul>
			) : null}
			<ListPager
				page={urlState.page}
				totalPages={inbox.data === undefined ? null : readPaginatedTotalPages(inbox.data.meta)}
				hasPrevious={urlState.page > LIST_FIRST_PAGE}
				hasNext={readPaginatedHasNext(inbox.data?.meta)}
				onPrevious={handlePrevious}
				onNext={handleNext}
				disabled={inbox.isFetching}
			/>
		</div>
	);
}
