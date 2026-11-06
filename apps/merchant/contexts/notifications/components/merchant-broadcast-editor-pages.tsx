"use client";

import { MerchantRewardEditorPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import type { CustomerPickerOption } from "@/components/merchant-ui/customer-picker";
import { MerchantPageHeader } from "@/components/merchant-ui/page-header";
import { MerchantBroadcastComposer, type BroadcastSaveIntent } from "@/contexts/notifications/components/merchant-broadcast-composer";
import { broadcastComposerValuesOf, emptyBroadcastComposerValues, type BroadcastComposerValues } from "@/contexts/notifications/lib/broadcast-composer";
import { isBroadcastEditable } from "@workspace/client/lib/features/broadcasts/broadcast-draft";
import { MerchantCapabilityGate } from "@/contexts/tenancy";
import { tenantRoutes } from "@/lib/routes";
import { userSafeErrorMessage } from "@/lib/query/query-policy";
import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuthorization } from "@workspace/client/lib/contexts/authorization";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { LIST_MAX_LIMIT, MERCHANT_CAPABILITY, type BroadcastDraftInput, type BroadcastResponse, type BroadcastWeeklyAllowance } from "@workspace/shared";
import { buttonVariants } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import { toastMessage } from "@workspace/ui/components/toast";
import { cn } from "@workspace/ui/lib/core/utils";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { appRoute } from "@workspace/client/lib/navigation/app-route";

/** Shown when a save fails without a message the merchant can act on. */
const SAVE_FAILED = "Check your connection and try again.";

/** Why sending is not possible this week, or null when it is. */
export function sendBlockedReasonOf(allowance: BroadcastWeeklyAllowance | undefined): string | null {
	if (allowance === undefined) {
		return null;
	}
	if (!allowance.broadcastingEnabled) {
		return "Broadcasting is switched off for your store. Save it as a draft.";
	}
	return allowance.used >= allowance.limit ? `You've sent ${String(allowance.limit)} broadcasts this week. Save it as a draft and send it from Monday.` : null;
}

/** After a save: refresh the list and allowance, keep the broadcast's own answer, and show its page. */
function useAfterBroadcastSave(tenantSlug: string): (response: { readonly data: BroadcastResponse }) => void {
	const queryClient = useQueryClient();
	const router = useRouter();
	return React.useCallback(
		(response: { readonly data: BroadcastResponse }): void => {
			const defs = apiRouter.tenantNotifications;
			void queryClient.invalidateQueries({ queryKey: defs.broadcasts.scopeKey({ tenantSlug }) });
			void queryClient.invalidateQueries({ queryKey: defs.broadcastAllowance.scopeKey({ tenantSlug }) });
			queryClient.setQueryData(defs.broadcast.queryKey({ tenantSlug, broadcastId: response.data.id }), response);
			router.push(appRoute(tenantRoutes(tenantSlug).broadcasts.detail(response.data.id)), { scroll: false });
		},
		[queryClient, router, tenantSlug],
	);
}

interface BroadcastSaveState {
	readonly save: (draft: BroadcastDraftInput, intent: BroadcastSaveIntent) => void;
	readonly isSaving: boolean;
	readonly savingIntent: BroadcastSaveIntent | undefined;
}

/** Save (create or update), then — for "send" — schedule it; every outcome is told in a toast. */
function useSaveBroadcast(tenantSlug: string, broadcastId: string | null): BroadcastSaveState {
	const { api } = useAuth();
	const afterSave = useAfterBroadcastSave(tenantSlug);
	const [savingIntent, setSavingIntent] = React.useState<BroadcastSaveIntent | undefined>(undefined);
	const create = api.tenantNotifications.createBroadcast.useMutation();
	const update = api.tenantNotifications.updateBroadcast.useMutation();
	const schedule = api.tenantNotifications.scheduleBroadcast.useMutation();
	const { mutateAsync: createAsync } = create;
	const { mutateAsync: updateAsync } = update;
	const { mutateAsync: scheduleAsync } = schedule;

	const save = React.useCallback(
		(draft: BroadcastDraftInput, intent: BroadcastSaveIntent): void => {
			setSavingIntent(intent);
			const run = async (): Promise<void> => {
				const saved = broadcastId === null ? await createAsync({ tenantSlug, ...draft }) : await updateAsync({ tenantSlug, broadcastId, ...draft });
				const result = intent === "send" ? await scheduleAsync({ tenantSlug, broadcastId: saved.data.id }) : saved;
				toastMessage.success(
					intent === "send"
						? { title: result.data.status === "PENDING_APPROVAL" ? "Sent for approval" : "Broadcast scheduled", description: "You can follow its progress on its page." }
						: { title: "Draft saved", description: "Nothing goes out until you send it." },
				);
				afterSave(result);
			};
			run()
				.catch((error: unknown): void => {
					toastMessage.error({
						title: intent === "send" ? "Broadcast not sent" : "Draft not saved",
						description: error instanceof Error ? userSafeErrorMessage(error, SAVE_FAILED) : SAVE_FAILED,
					});
				})
				.finally((): void => {
					setSavingIntent(undefined);
				});
		},
		[afterSave, broadcastId, createAsync, scheduleAsync, tenantSlug, updateAsync],
	);
	return { save, isSaving: savingIntent !== undefined, savingIntent };
}

/** The store's zone and this week's allowance: the composer needs both before it opens. */
function useComposerContext(tenantSlug: string): { readonly timeZone: string | undefined; readonly allowance: BroadcastWeeklyAllowance | undefined } {
	const { api } = useAuth();
	const timeZone = api.tenants.context.useQuery({ tenantSlug }).data?.data.tenant.timeZone;
	const allowance = api.tenantNotifications.broadcastAllowance.useQuery({ tenantSlug }).data?.data;
	return { timeZone, allowance };
}

export interface MerchantNewBroadcastPageViewProps {
	readonly tenantSlug: string;
}

/** `/t/:tenantSlug/broadcasts/new` — requires `merchant:manage_broadcasts`; sending needs `merchant:publish_broadcasts`. */
export function MerchantNewBroadcastPageView({ tenantSlug }: MerchantNewBroadcastPageViewProps): React.JSX.Element {
	return (
		<MerchantCapabilityGate capability={MERCHANT_CAPABILITY.manageBroadcasts} loading={<MerchantRewardEditorPageSkeleton />}>
			<MerchantNewBroadcastContent tenantSlug={tenantSlug} />
		</MerchantCapabilityGate>
	);
}

const NO_CUSTOMERS: readonly CustomerPickerOption[] = [];

function MerchantNewBroadcastContent({ tenantSlug }: MerchantNewBroadcastPageViewProps): React.JSX.Element {
	const { can } = useAuthorization();
	const { timeZone, allowance } = useComposerContext(tenantSlug);
	const { save, isSaving, savingIntent } = useSaveBroadcast(tenantSlug, null);
	const [initialValues] = React.useState((): BroadcastComposerValues => emptyBroadcastComposerValues(format(new Date(), "yyyy-MM-dd")));
	const listHref = tenantRoutes(tenantSlug).broadcasts.list;

	if (timeZone === undefined) {
		return <MerchantRewardEditorPageSkeleton />;
	}
	return (
		<div className="flex flex-col gap-6">
			<MerchantPageHeader title="New broadcast" description="Write to one customer, a group you pick, or all your customers." />
			<MerchantBroadcastComposer
				tenantSlug={tenantSlug}
				storeTimeZone={timeZone}
				initialValues={initialValues}
				initialCustomers={NO_CUSTOMERS}
				canSend={can(MERCHANT_CAPABILITY.publishBroadcasts)}
				sendBlockedReason={sendBlockedReasonOf(allowance)}
				isSaving={isSaving}
				savingIntent={savingIntent}
				onSave={save}
				cancel={
					<Link href={appRoute(listHref)} className={cn(buttonVariants({ variant: "ghost" }))}>
						Cancel
					</Link>
				}
			/>
		</div>
	);
}

export interface MerchantEditBroadcastPageViewProps {
	readonly tenantSlug: string;
	readonly broadcastId: string;
}

/** `/t/:tenantSlug/broadcasts/:broadcastId/edit` — a draft's composer. */
export function MerchantEditBroadcastPageView(props: MerchantEditBroadcastPageViewProps): React.JSX.Element {
	return (
		<MerchantCapabilityGate capability={MERCHANT_CAPABILITY.manageBroadcasts} loading={<MerchantRewardEditorPageSkeleton />}>
			<MerchantEditBroadcastContent {...props} />
		</MerchantCapabilityGate>
	);
}

function MerchantEditBroadcastContent({ tenantSlug, broadcastId }: MerchantEditBroadcastPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const broadcastQuery = api.tenantNotifications.broadcast.useQuery({ tenantSlug, broadcastId });
	const { timeZone, allowance } = useComposerContext(tenantSlug);
	const broadcast = broadcastQuery.data?.data;

	if (broadcastQuery.isError) {
		return <BroadcastUnavailable tenantSlug={tenantSlug} message={userSafeErrorMessage(broadcastQuery.error, "Could not load this broadcast.")} />;
	}
	if (broadcast === undefined || timeZone === undefined) {
		return <MerchantRewardEditorPageSkeleton />;
	}
	if (!isBroadcastEditable(broadcast.status)) {
		return <BroadcastUnavailable tenantSlug={tenantSlug} message="Only a draft can be changed. This one is already on its way, or finished." broadcastId={broadcast.id} />;
	}
	return <MerchantEditBroadcastForm tenantSlug={tenantSlug} broadcast={broadcast} timeZone={timeZone} allowance={allowance} />;
}

interface MerchantEditBroadcastFormProps {
	readonly tenantSlug: string;
	readonly broadcast: BroadcastResponse;
	readonly timeZone: string;
	readonly allowance: BroadcastWeeklyAllowance | undefined;
}

/** `items` in runs of at most `size`, in order. */
export function chunksOf<TItem>(items: readonly TItem[], size: number): readonly (readonly TItem[])[] {
	return Array.from({ length: Math.ceil(items.length / size) }, (_unused, index): readonly TItem[] => items.slice(index * size, (index + 1) * size));
}

/** Looks up one page of a draft's picked people by id and hands their names up (renders nothing). */
function PickedCustomersLookup({
	tenantSlug,
	ids,
	chunk,
	onFound,
}: {
	readonly tenantSlug: string;
	readonly ids: readonly string[];
	readonly chunk: number;
	readonly onFound: (chunk: number, options: readonly CustomerPickerOption[]) => void;
}): null {
	const { api } = useAuth();
	const query = api.tenantNotifications.broadcastCustomers.useQuery({ tenantSlug, page: 1, limit: LIST_MAX_LIMIT, ids: [...ids] });
	const customers = query.data?.data;
	React.useEffect((): void => {
		if (customers !== undefined) {
			onFound(
				chunk,
				customers.map((customer): CustomerPickerOption => ({
					userId: customer.userId,
					fullName: customer.fullName,
					maskedEmail: customer.maskedEmail,
					detail: "",
					unavailableReason: null,
				})),
			);
		}
	}, [chunk, customers, onFound]);
	return null;
}

function MerchantEditBroadcastForm({ tenantSlug, broadcast, timeZone, allowance }: MerchantEditBroadcastFormProps): React.JSX.Element {
	const { can } = useAuthorization();
	const { save, isSaving, savingIntent } = useSaveBroadcast(tenantSlug, broadcast.id);
	const [initialValues] = React.useState((): BroadcastComposerValues => broadcastComposerValuesOf(broadcast, timeZone, format(new Date(), "yyyy-MM-dd")));
	// The picked people's names, looked up by id one page at a time (enhancement 5.5): every picked person is named.
	const chunks = React.useMemo((): readonly (readonly string[])[] => chunksOf(initialValues.customerIds, LIST_MAX_LIMIT), [initialValues.customerIds]);
	const [found, setFound] = React.useState<ReadonlyMap<number, readonly CustomerPickerOption[]>>(new Map());
	const handleFound = React.useCallback((chunk: number, options: readonly CustomerPickerOption[]): void => {
		setFound((current) => new Map(current).set(chunk, options));
	}, []);
	const initialCustomers = React.useMemo((): readonly CustomerPickerOption[] => [...found.values()].flat(), [found]);
	const detailHref = tenantRoutes(tenantSlug).broadcasts.detail(broadcast.id);

	return (
		<div className="flex flex-col gap-6">
			{chunks.map((ids, chunk): React.JSX.Element => (
				<PickedCustomersLookup key={ids.join(",")} tenantSlug={tenantSlug} ids={ids} chunk={chunk} onFound={handleFound} />
			))}
			<MerchantPageHeader title="Edit broadcast" description="Nothing goes out until you send it." />
			<MerchantBroadcastComposer
				tenantSlug={tenantSlug}
				storeTimeZone={timeZone}
				initialValues={initialValues}
				initialCustomers={initialCustomers}
				canSend={can(MERCHANT_CAPABILITY.publishBroadcasts)}
				sendBlockedReason={sendBlockedReasonOf(allowance)}
				isSaving={isSaving}
				savingIntent={savingIntent}
				onSave={save}
				cancel={
					<Link href={appRoute(detailHref)} className={cn(buttonVariants({ variant: "ghost" }))}>
						Cancel
					</Link>
				}
			/>
		</div>
	);
}

interface BroadcastUnavailableProps {
	readonly tenantSlug: string;
	readonly message: string;
	readonly broadcastId?: string;
}

/** A broadcast that cannot be shown or changed, with the way back. */
export function BroadcastUnavailable({ tenantSlug, message, broadcastId }: BroadcastUnavailableProps): React.JSX.Element {
	const routes = tenantRoutes(tenantSlug).broadcasts;
	return (
		<Card className="items-start gap-3 px-6 py-8">
			<h1 className="text-xl font-semibold tracking-tight text-foreground">{`This broadcast can't be opened here`}</h1>
			<p role="alert" className="max-w-prose text-sm text-muted-foreground">
				{message}
			</p>
			<Link href={appRoute(broadcastId === undefined ? routes.list : routes.detail(broadcastId))} className={cn(buttonVariants({ variant: "outline" }))}>
				{broadcastId === undefined ? "All broadcasts" : "View broadcast"}
			</Link>
		</Card>
	);
}
