"use client";

import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuthorization } from "@workspace/client/lib/contexts/authorization";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import type { BroadcastSaveIntent } from "@workspace/client/lib/features/broadcasts/broadcast-composer-form";
import {
	BROADCAST_CHANNEL_LABELS,
	BROADCAST_STATUS_LABELS,
	broadcastTotals,
	formatWallClock,
	isBroadcastCancellable,
	isBroadcastEditable,
} from "@workspace/client/lib/features/broadcasts/broadcast-draft";
import { PERMISSION, type BroadcastDraftInput, type BroadcastResponse } from "@workspace/shared";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { RichTextView } from "@workspace/ui/components/rich-text-view";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { toastMessage } from "@workspace/ui/components/toast";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { BROADCAST_STATUS_TONES } from "@/contexts/notifications/components/broadcasts-admin-view";
import { PlatformBroadcastComposer } from "@/contexts/notifications/components/platform-broadcast-composer";
import {
	emptyPlatformBroadcastValues,
	PLATFORM_CATEGORY_LABELS,
	PLATFORM_SURFACE_LABELS,
	platformBroadcastValuesOf,
	type PlatformBroadcastValues,
} from "@/contexts/notifications/lib/platform-broadcast-composer";
import { toastMutationError } from "@/lib/api/mutation-error";
import { ROUTES } from "@/lib/routes";

/** The staff member's own zone: a set send time and a sign-up date are read in it. */
function senderTimeZone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function today(): string {
	return format(new Date(), "yyyy-MM-dd");
}

/** After a save: refresh the list, keep the broadcast's own answer, and show its page. */
function useAfterSave(): (response: { readonly data: BroadcastResponse }) => void {
	const queryClient = useQueryClient();
	const router = useRouter();
	return React.useCallback(
		(response: { readonly data: BroadcastResponse }): void => {
			const defs = apiRouter.notificationsAdmin;
			void queryClient.invalidateQueries({ queryKey: defs.broadcasts.scopeKey(undefined) });
			queryClient.setQueryData(defs.broadcast.queryKey({ broadcastId: response.data.id }), response);
			router.push(ROUTES.emails.broadcast(response.data.id), { scroll: false });
		},
		[queryClient, router],
	);
}

interface SaveState {
	readonly save: (draft: BroadcastDraftInput, intent: BroadcastSaveIntent) => void;
	readonly isSaving: boolean;
	readonly savingIntent: BroadcastSaveIntent | undefined;
}

/** Save (create or update), then — for "send" — schedule it (or send it for approval); every outcome is told in a toast. */
function useSavePlatformBroadcast(broadcastId: string | null): SaveState {
	const { api } = useAuth();
	const afterSave = useAfterSave();
	const [savingIntent, setSavingIntent] = React.useState<BroadcastSaveIntent | undefined>(undefined);
	const { mutateAsync: createAsync } = api.notificationsAdmin.createBroadcast.useMutation();
	const { mutateAsync: updateAsync } = api.notificationsAdmin.updateBroadcast.useMutation();
	const { mutateAsync: scheduleAsync } = api.notificationsAdmin.scheduleBroadcast.useMutation();

	const save = React.useCallback(
		(draft: BroadcastDraftInput, intent: BroadcastSaveIntent): void => {
			setSavingIntent(intent);
			const run = async (): Promise<void> => {
				const saved = broadcastId === null ? await createAsync(draft) : await updateAsync({ broadcastId, ...draft });
				const result = intent === "send" ? await scheduleAsync({ broadcastId: saved.data.id }) : saved;
				toastMessage.success(
					intent === "send"
						? result.data.status === "PENDING_APPROVAL"
							? { title: "Sent for approval", description: "It reaches everyone, so a second staff member approves it first." }
							: { title: "Broadcast scheduled", description: "You can follow its progress on its page." }
						: { title: "Draft saved", description: "Nothing goes out until you send it." },
				);
				afterSave(result);
			};
			run()
				.catch((error: unknown): void => {
					toastMutationError(intent === "send" ? "Broadcast not sent" : "Draft not saved", error instanceof Error ? error : new Error("The broadcast could not be saved"));
				})
				.finally((): void => {
					setSavingIntent(undefined);
				});
		},
		[afterSave, broadcastId, createAsync, scheduleAsync, updateAsync],
	);
	return { save, isSaving: savingIntent !== undefined, savingIntent };
}

function BackToBroadcasts({ label }: { readonly label: string }): React.JSX.Element {
	return (
		<Link href={ROUTES.emails.broadcasts} className={buttonVariants({ variant: "ghost" })}>
			{label}
		</Link>
	);
}

function PageHeader({ title, description }: { readonly title: string; readonly description: string }): React.JSX.Element {
	return (
		<header className="flex flex-col gap-1">
			<h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
			<p className="text-sm text-muted-foreground">{description}</p>
		</header>
	);
}

/** `/emails/broadcasts/new` — write a platform notice (CREATE BROADCAST); sending needs PUBLISH BROADCAST. */
export function NewPlatformBroadcastView(): React.JSX.Element {
	const { can } = useAuthorization();
	const { save, isSaving, savingIntent } = useSavePlatformBroadcast(null);
	const [initialValues] = React.useState((): PlatformBroadcastValues => emptyPlatformBroadcastValues(today()));
	return (
		<div className="flex flex-col gap-6">
			<PageHeader title="New broadcast" description="A notice from the platform to the people who use it: product news or something about their account." />
			<PlatformBroadcastComposer
				senderTimeZone={senderTimeZone()}
				initialValues={initialValues}
				canSend={can(PERMISSION.BROADCAST.PUBLISH)}
				isSaving={isSaving}
				savingIntent={savingIntent}
				onSave={save}
				cancel={<BackToBroadcasts label="Cancel" />}
			/>
		</div>
	);
}

/** `/emails/broadcasts/[id]/edit` — a platform draft in the composer (READ + UPDATE BROADCAST); anything else shows its page instead. */
export function EditPlatformBroadcastView({ broadcastId }: { readonly broadcastId: string }): React.JSX.Element {
	const { api } = useAuth();
	const { can } = useAuthorization();
	const broadcast = api.notificationsAdmin.broadcast.useQuery({ broadcastId }).data?.data;
	const { save, isSaving, savingIntent } = useSavePlatformBroadcast(broadcastId);
	if (broadcast === undefined) {
		return <Skeleton className="h-96 w-full rounded-xl" />;
	}
	if (!isBroadcastEditable(broadcast.status)) {
		return (
			<div className="flex flex-col gap-4">
				<PageHeader title={broadcast.title} description="Only a draft can be edited. This one is past that." />
				<Link href={ROUTES.emails.broadcast(broadcast.id)} className={buttonVariants({ variant: "outline", className: "self-start" })}>
					Open the broadcast
				</Link>
			</div>
		);
	}
	return (
		<div className="flex flex-col gap-6">
			<PageHeader title="Edit broadcast" description="Nothing goes out until you send it." />
			<PlatformBroadcastComposer
				senderTimeZone={senderTimeZone()}
				initialValues={platformBroadcastValuesOf(broadcast, senderTimeZone(), today())}
				canSend={can(PERMISSION.BROADCAST.PUBLISH)}
				isSaving={isSaving}
				savingIntent={savingIntent}
				onSave={save}
				cancel={<BackToBroadcasts label="Cancel" />}
			/>
		</div>
	);
}

/** Who a platform notice goes to, in words. */
export function audienceSummaryOf(broadcast: BroadcastResponse): string {
	if (broadcast.audience.kind !== "platform-users") {
		return "A tenant's own customers";
	}
	const { surfaces, signedUpAfter, tenantStates } = broadcast.audience;
	const groups = surfaces.map((surface) => PLATFORM_SURFACE_LABELS[surface].label).join(", ");
	const since = signedUpAfter === null ? "" : `; signed up since ${format(signedUpAfter, "d MMM yyyy")}`;
	const stores = tenantStates === null ? "" : `; only ${tenantStates.map((state) => state.toLowerCase()).join(" or ")} stores`;
	return `${groups}${since}${stores}`;
}

/** When it goes out, in words. */
export function sendTimeOf(broadcast: BroadcastResponse): string {
	if (broadcast.sendMode === "RECIPIENT_LOCAL_TIME" && broadcast.localSendAt !== null) {
		return `${formatWallClock(broadcast.localSendAt)}, in each person's own time`;
	}
	return broadcast.sendAt === null ? "As soon as it is sent" : format(broadcast.sendAt, "d MMM yyyy, HH:mm");
}

/** `/emails/broadcasts/[id]` — one platform notice: the message, who and how, its status and results, and what can be done next. */
export function PlatformBroadcastDetailView({ broadcastId }: { readonly broadcastId: string }): React.JSX.Element {
	const { api } = useAuth();
	const { can } = useAuthorization();
	const queryClient = useQueryClient();
	const query = api.notificationsAdmin.broadcast.useQuery({ broadcastId });
	const refresh = React.useCallback(async (): Promise<void> => {
		const defs = apiRouter.notificationsAdmin;
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: defs.broadcast.scopeKey({ broadcastId }) }),
			queryClient.invalidateQueries({ queryKey: defs.broadcasts.scopeKey(undefined) }),
		]);
	}, [broadcastId, queryClient]);
	const schedule = api.notificationsAdmin.scheduleBroadcast.useMutation({
		onSuccess: async (response): Promise<void> => {
			toastMessage.success(response.data.status === "PENDING_APPROVAL" ? { title: "Sent for approval" } : { title: "Broadcast scheduled" });
			await refresh();
		},
		onError: (error): void => {
			toastMutationError("Broadcast not sent", error);
		},
	});
	const approve = api.notificationsAdmin.approveBroadcast.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: "Approved", description: "It goes out at its time." });
			await refresh();
		},
		onError: (error): void => {
			toastMutationError("Could not approve the broadcast", error);
		},
	});
	const cancel = api.notificationsAdmin.cancelBroadcast.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: "Cancelled", description: "No one else receives it." });
			await refresh();
		},
		onError: (error): void => {
			toastMutationError("Could not cancel the broadcast", error);
		},
	});
	const { mutate: scheduleMutate } = schedule;
	const { mutate: approveMutate } = approve;
	const { mutate: cancelMutate } = cancel;
	const handleSend = React.useCallback((): void => {
		scheduleMutate({ broadcastId });
	}, [broadcastId, scheduleMutate]);
	const handleApprove = React.useCallback((): void => {
		approveMutate({ broadcastId });
	}, [approveMutate, broadcastId]);
	const handleCancel = React.useCallback((): void => {
		cancelMutate({ broadcastId });
	}, [broadcastId, cancelMutate]);

	const broadcast = query.data?.data;
	if (broadcast === undefined) {
		return <Skeleton className="h-96 w-full rounded-xl" />;
	}
	const busy = schedule.isPending || approve.isPending || cancel.isPending;
	const draft = isBroadcastEditable(broadcast.status);
	const totals = broadcastTotals(broadcast);
	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div className="flex min-w-0 flex-col gap-1">
					<div className="flex flex-wrap items-center gap-2">
						<h1 className="text-2xl font-semibold tracking-tight wrap-anywhere">{broadcast.title}</h1>
						<StatusBadge tone={BROADCAST_STATUS_TONES[broadcast.status]}>{BROADCAST_STATUS_LABELS[broadcast.status]}</StatusBadge>
					</div>
					{broadcast.pauseReason === null ? null : <p className="text-sm text-muted-foreground">{broadcast.pauseReason}</p>}
				</div>
				<div className="flex flex-wrap items-center gap-2">
					{draft && can(PERMISSION.BROADCAST.UPDATE) ? (
						<Link href={ROUTES.emails.broadcastEdit(broadcast.id)} className={buttonVariants({ variant: "outline" })}>
							Edit
						</Link>
					) : null}
					{draft && can(PERMISSION.BROADCAST.PUBLISH) ? (
						<Button type="button" onClick={handleSend} disabled={busy}>
							{broadcast.sendAt === null && broadcast.localSendAt === null ? "Send" : "Schedule"}
						</Button>
					) : null}
					{broadcast.status === "PENDING_APPROVAL" && can(PERMISSION.BROADCAST.APPROVE) ? (
						<Button type="button" onClick={handleApprove} disabled={busy}>
							Approve
						</Button>
					) : null}
					{isBroadcastCancellable(broadcast.status) && can(PERMISSION.BROADCAST.DELETE) ? (
						<Button type="button" variant="outline" onClick={handleCancel} disabled={busy}>
							Cancel broadcast
						</Button>
					) : null}
				</div>
			</header>
			{broadcast.status === "PENDING_APPROVAL" ? (
				<p className="rounded-lg bg-muted/60 px-3 py-2 text-sm">It reaches everyone, so another staff member approves it before it goes out. You cannot approve your own.</p>
			) : null}
			<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
				<Card>
					<CardHeader>
						<CardTitle>Message</CardTitle>
					</CardHeader>
					<CardContent>
						<RichTextView document={broadcast.body} />
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Who and how</CardTitle>
						<CardDescription>{broadcast.audienceCount === null ? "Counted when it starts sending." : `${String(broadcast.audienceCount)} recipients.`}</CardDescription>
					</CardHeader>
					<CardContent>
						<dl className="grid gap-3 text-sm">
							<DetailRow term="Kind">{broadcast.category === "ACCOUNT" ? PLATFORM_CATEGORY_LABELS.ACCOUNT.label : PLATFORM_CATEGORY_LABELS.PRODUCT.label}</DetailRow>
							<DetailRow term="People">{audienceSummaryOf(broadcast)}</DetailRow>
							<DetailRow term="Channels">{broadcast.channels.map((channel) => BROADCAST_CHANNEL_LABELS[channel]).join(", ")}</DetailRow>
							<DetailRow term="When">{sendTimeOf(broadcast)}</DetailRow>
							{broadcast.results.length === 0 ? null : (
								<DetailRow term="Results">{`${String(totals.delivered)} delivered, ${String(totals.suppressed)} held back, ${String(totals.failed)} failed`}</DetailRow>
							)}
						</dl>
					</CardContent>
				</Card>
			</div>
			<BackToBroadcasts label="Back to broadcasts" />
		</div>
	);
}

function DetailRow({ term, children }: { readonly term: string; readonly children: React.ReactNode }): React.JSX.Element {
	return (
		<div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3">
			<dt className="text-muted-foreground">{term}</dt>
			<dd className="wrap-anywhere text-foreground">{children}</dd>
		</div>
	);
}
