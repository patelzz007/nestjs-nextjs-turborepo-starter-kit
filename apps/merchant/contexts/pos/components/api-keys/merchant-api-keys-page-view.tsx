"use client";

import { ApiKeyList } from "@/contexts/pos/components/api-keys/api-key-list";
import { CreateApiKeyCard } from "@/contexts/pos/components/api-keys/create-api-key-card";
import { FLEET_STAT_CARDS, GuideCardSkeleton, MerchantApiKeysPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import { MerchantStatCardsSkeleton } from "@/components/loading/merchant-skeleton-parts";
import { MerchantAccessDenied, MerchantCapabilityGate } from "@/contexts/tenancy";
import { MerchantLocationScopeBanner } from "@/components/layout/merchant-location-scope-banner";
import { MerchantPageHeader } from "@/components/merchant-ui/page-header";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { StatCard } from "@workspace/ui/components/stat-card";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import {
	API_KEY_COUNT_PAGE_SIZE,
	DEFAULT_API_KEY_FILTER,
	summarizeApiKeys,
	toApiKeyListQuery,
	type ApiKeyFilter,
	type ApiKeyStats,
} from "@/contexts/pos/lib/api-keys/api-key-summary";
import {
	CREATE_API_KEY_FIELD_ERRORS,
	DEFAULT_API_KEY_SCOPE_CHOICE,
	defaultApiKeyStoreChoice,
	parseCreateApiKeyForm,
	type ApiKeyStoreChoices,
} from "@/contexts/pos/lib/api-keys/create-api-key-form";
import { toFormSubmissionError } from "@/lib/forms/api-field-errors";
import { userSafeErrorMessage } from "@/lib/query/query-policy";
import { API_KEYS_URL_STATE } from "@/contexts/pos/url-state/api-keys";
import { clientEnv } from "@/lib/env/env.client";
import { useActiveLocationFilter, useMerchantLocation } from "@/features/tenant-context/facade";
import { prefetchForLocation, type LocationScopedPrefetch } from "@/contexts/tenancy";
import { tenantRoutes } from "@/lib/routes";
import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { initialDataOption, readPaginatedTotal } from "@workspace/client/lib/api/envelope";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { prefetchedDataFor, type PrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import { useUrlState } from "@workspace/client/lib/url-state/use-url-state";
import { MERCHANT_CAPABILITY, type Envelope, type MerchantApiKeySummary } from "@workspace/shared";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogMedia, AlertDialogTitle } from "@workspace/ui/components/alert-dialog";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { Ban, KeyRound, ShieldCheck, Store } from "lucide-react";
import dynamic from "next/dynamic";
import * as React from "react";

function renderGuideSkeleton(): React.JSX.Element {
	return <GuideCardSkeleton />;
}

function renderCreatedKeyNoticeSkeleton(): React.JSX.Element {
	return <Skeleton className="h-52 rounded-xl" />;
}

/** The code-block panels (`CodeBlock` is large) are their own chunk; both still render on the server (rules/19, T43). */
const ApiKeyIntegrationGuide = dynamic(() => import("./api-key-integration-guide").then((module) => module.ApiKeyIntegrationGuide), { loading: renderGuideSkeleton });
const CreatedApiKeyNotice = dynamic(() => import("./created-api-key-notice").then((module) => module.CreatedApiKeyNotice), { loading: renderCreatedKeyNoticeSkeleton });

const DEFAULT_TERMINAL_NAME = "POS Terminal";
const CREATE_KEY_FAILED_MESSAGE = "The key could not be created. Try again.";
const REVOKE_KEY_FAILED_MESSAGE = "The key could not be revoked. Try again.";
const REVOKE_DIALOG_LABELS: UiKitLabelsOverride<"alertDialog"> = { confirm: "Revoke key", loading: "Revoking…" };

/** Everything the server prefetched for the page, as the API answered it (real envelopes — never synthesized meta). */
export interface ApiKeysPagePrefetch {
	/** The list for the status view the URL named — bound to that URL state. */
	readonly list: PrefetchedQuery<Envelope<MerchantApiKeySummary[]>> | undefined;
	/** Active keys (one full page) — the active total and store coverage. */
	readonly active: Envelope<MerchantApiKeySummary[]> | undefined;
	/** One revoked key — its `meta.total` is the revoked count. */
	readonly revokedCount: Envelope<MerchantApiKeySummary[]> | undefined;
}

export interface MerchantApiKeysPageViewProps {
	readonly tenantSlug: string;
	/** Server prefetch with the store filter it was fetched for. */
	readonly initialKeys?: LocationScopedPrefetch<ApiKeysPagePrefetch> | undefined;
}

/** POS API keys route — list/create/revoke all require `merchant:manage_api_keys`. */
export function MerchantApiKeysPageView(props: MerchantApiKeysPageViewProps): React.JSX.Element {
	return (
		<MerchantCapabilityGate
			capability={MERCHANT_CAPABILITY.manageApiKeys}
			loading={<MerchantApiKeysPageSkeleton />}
			fallback={
				<div className="space-y-8">
					<MerchantPageHeader title="POS API keys" description="Keys for redemption terminals — owner or admin access required." />
					<MerchantAccessDenied
						title="Owner or admin access required"
						description="API key management is limited to store owners and admins. Contact your account owner if you need a new terminal key."
					/>
				</div>
			}>
			<MerchantApiKeysPageContent {...props} />
		</MerchantCapabilityGate>
	);
}

interface CreatedKey {
	readonly name: string;
	readonly secret: string;
}

const STORES_COVERED_LABEL = "Stores covered";
/** Shown under a figure whose counts could not be loaded (the queries settled without data). */
const STATS_UNAVAILABLE_HINT = "Couldn't load the count";

/** What the stat row announces while the key counts load. */
export const API_KEY_STATS_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading key totals…" };

function storesCoveredCard(stats: ApiKeyStats | undefined): { readonly value: string; readonly hint: string } {
	if (stats === undefined) {
		return { value: "—", hint: STATS_UNAVAILABLE_HINT };
	}
	if (stats.coverage.kind === "unavailable") {
		return { value: "—", hint: "Too many active keys to count here — see the list" };
	}
	return { value: String(stats.coverage.stores), hint: stats.coverage.hasTenantWideKey ? "Plus a tenant-wide key" : "With at least one active key" };
}

function MerchantApiKeysPageContent({ tenantSlug, initialKeys }: MerchantApiKeysPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const { locationId } = useActiveLocationFilter();
	const { activeLocation, accessibleLocations, hasTenantWideAccess } = useMerchantLocation();

	// The filter is URL state (`?status=`): Back undoes a filter change and a shared link opens on it.
	const [urlState, updateUrlState] = useUrlState(API_KEYS_URL_STATE);
	const filter: ApiKeyFilter = urlState.status;

	// Seed only with what the server fetched for this exact store filter (and, for the list, this exact URL state).
	const prefetched = prefetchForLocation(initialKeys, locationId);
	const prefetchedList = prefetchedDataFor(prefetched?.list, API_KEYS_URL_STATE.serialize(urlState));

	const listQuery = api.tenants.apiKeys.list.useQuery(toApiKeyListQuery(tenantSlug, locationId, filter), initialDataOption(prefetchedList));
	const activeQuery = api.tenants.apiKeys.list.useQuery(toApiKeyListQuery(tenantSlug, locationId, "active"), initialDataOption(prefetched?.active));
	const revokedCountQuery = api.tenants.apiKeys.list.useQuery(
		toApiKeyListQuery(tenantSlug, locationId, "revoked", API_KEY_COUNT_PAGE_SIZE),
		initialDataOption(prefetched?.revokedCount),
	);

	const keys: readonly MerchantApiKeySummary[] = listQuery.data?.data ?? [];
	const totalKeys: number = readPaginatedTotal(listQuery.data?.meta, keys.length);
	const activeData = activeQuery.data;
	const revokedData = revokedCountQuery.data;
	const isLoadingStats: boolean = activeQuery.isPending || revokedCountQuery.isPending;
	const stats: ApiKeyStats | undefined =
		activeData === undefined || revokedData === undefined
			? undefined
			: summarizeApiKeys(
					{ keys: activeData.data, total: readPaginatedTotal(activeData.meta, activeData.data.length) },
					readPaginatedTotal(revokedData.meta, revokedData.data.length),
				);

	const storeChoices = React.useMemo(
		(): ApiKeyStoreChoices => ({
			stores: accessibleLocations.map((location) => ({ id: location.id, name: location.name })),
			allowTenantWide: hasTenantWideAccess,
		}),
		[accessibleLocations, hasTenantWideAccess],
	);

	const [name, setName] = React.useState<string>(DEFAULT_TERMINAL_NAME);
	// `null` = the member has not picked yet: the default follows the store in view.
	const [pickedStoreChoice, setPickedStoreChoice] = React.useState<string | null>(null);
	const storeChoice = pickedStoreChoice ?? defaultApiKeyStoreChoice(storeChoices, activeLocation?.id);
	const [scope, setScope] = React.useState<string>(DEFAULT_API_KEY_SCOPE_CHOICE);
	const createInput = parseCreateApiKeyForm({ name, storeChoice, scope }, storeChoices);
	const [createdKey, setCreatedKey] = React.useState<CreatedKey | null>(null);
	const [keyToRevoke, setKeyToRevoke] = React.useState<MerchantApiKeySummary | null>(null);

	const invalidateKeys = React.useCallback((): void => {
		// Every list view and count of this tenant (any store, any status) is stale after a change.
		void queryClient.invalidateQueries({ queryKey: apiRouter.tenants.apiKeys.list.scopeKey({ tenantSlug }) });
	}, [tenantSlug, queryClient]);

	const createMutation = api.tenants.apiKeys.create.useMutation({
		onSuccess: (response): void => {
			setCreatedKey({ name: response.data.name, secret: response.data.apiKey });
			setName(DEFAULT_TERMINAL_NAME);
			setPickedStoreChoice(null);
			setScope(DEFAULT_API_KEY_SCOPE_CHOICE);
			// Show the new key: a consequence of the create, not a navigation, so it replaces the entry.
			updateUrlState({ status: DEFAULT_API_KEY_FILTER }, { history: "replace" });
			invalidateKeys();
		},
	});

	const revokeMutation = api.tenants.apiKeys.revoke.useMutation({
		onSuccess: (): void => {
			setKeyToRevoke(null);
			invalidateKeys();
		},
	});

	const handleNameChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setName(event.target.value);
	}, []);

	const handleStoreChoiceChange = React.useCallback((choice: string): void => {
		setPickedStoreChoice(choice);
	}, []);

	const handleScopeChange = React.useCallback((value: string): void => {
		setScope(value);
	}, []);

	const handleCreate = React.useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			if (createInput === undefined) {
				return;
			}
			// The mutation's error state renders inline (the form keeps its values).
			createMutation.mutate({ tenantSlug, ...createInput });
		},
		[createInput, createMutation, tenantSlug],
	);

	const handleFilterChange = React.useCallback(
		(nextFilter: ApiKeyFilter): void => {
			updateUrlState({ status: nextFilter });
		},
		[updateUrlState],
	);

	const handleDismissCreated = React.useCallback((): void => {
		setCreatedKey(null);
	}, []);

	const refetchList = listQuery.refetch;
	const handleRetry = React.useCallback((): void => {
		void refetchList();
	}, [refetchList]);

	const isRevoking = revokeMutation.isPending;
	const resetRevoke = revokeMutation.reset;
	const handleRevokeRequest = React.useCallback(
		(apiKey: MerchantApiKeySummary): void => {
			resetRevoke();
			setKeyToRevoke(apiKey);
		},
		[resetRevoke],
	);

	const handleRevokeDialogChange = React.useCallback(
		(open: boolean): void => {
			if (!open && !isRevoking) {
				setKeyToRevoke(null);
			}
		},
		[isRevoking],
	);

	const handleConfirmRevoke = React.useCallback((): void => {
		if (keyToRevoke === null) {
			return;
		}
		// On failure the dialog stays open with the error, so the merchant can retry.
		revokeMutation.mutate({ tenantSlug, keyId: keyToRevoke.id });
	}, [keyToRevoke, tenantSlug, revokeMutation]);

	const truncationNote = totalKeys > keys.length ? `Showing the newest ${String(keys.length)} of ${String(totalKeys)} keys.` : null;
	const storesCard = storesCoveredCard(stats);

	return (
		<div className="space-y-8">
			<MerchantPageHeader
				title="POS API keys"
				description="Terminal keys let your point-of-sale devices validate and confirm customer redemptions. Each key is shown once, when it's created."
			/>
			<MerchantLocationScopeBanner
				filteredNote="Only this store's keys are listed and counted."
				allStoresNote="Listing the keys of every store you can access, including tenant-wide keys."
			/>

			{createdKey === null ? null : <CreatedApiKeyNotice keyName={createdKey.name} secret={createdKey.secret} onDismiss={handleDismissCreated} />}

			{isLoadingStats ? (
				<SkeletonRegion labels={API_KEY_STATS_LOADING_LABELS}>
					<MerchantStatCardsSkeleton count={FLEET_STAT_CARDS} className="sm:grid-cols-3" />
				</SkeletonRegion>
			) : (
				<div className="grid gap-4 sm:grid-cols-3">
					<StatCard
						label="Active keys"
						tone="green"
						value={stats === undefined ? "—" : String(stats.active)}
						hint="Can validate redemptions now"
						icon={<KeyRound className="size-5" aria-hidden="true" />}
					/>
					<StatCard label={STORES_COVERED_LABEL} tone="blue" value={storesCard.value} hint={storesCard.hint} icon={<Store className="size-5" aria-hidden="true" />} />
					<StatCard
						label="Revoked"
						tone="red"
						value={stats === undefined ? "—" : String(stats.revoked)}
						hint="Kept for your records"
						icon={<Ban className="size-5" aria-hidden="true" />}
					/>
				</div>
			)}

			<CreateApiKeyCard
				name={name}
				onNameChange={handleNameChange}
				storeChoice={storeChoice}
				onStoreChoiceChange={handleStoreChoiceChange}
				storeChoices={storeChoices}
				scope={scope}
				onScopeChange={handleScopeChange}
				canSubmit={createInput !== undefined}
				onSubmit={handleCreate}
				isPending={createMutation.isPending}
				submissionError={createMutation.error === null ? null : toFormSubmissionError(createMutation.error, CREATE_API_KEY_FIELD_ERRORS, CREATE_KEY_FAILED_MESSAGE)}
			/>

			<ApiKeyList
				keys={keys}
				filter={filter}
				onFilterChange={handleFilterChange}
				isLoading={listQuery.isPending}
				isError={listQuery.isError}
				onRetry={handleRetry}
				revokingKeyId={isRevoking ? (keyToRevoke?.id ?? null) : null}
				onRevokeRequest={handleRevokeRequest}
				truncationNote={truncationNote}
			/>

			<ApiKeyIntegrationGuide apiBaseUrl={clientEnv.NEXT_PUBLIC_API_URL} terminalsHref={tenantRoutes(tenantSlug).terminals} />

			<AlertDialog open={keyToRevoke !== null} onOpenChange={handleRevokeDialogChange}>
				<AlertDialogContent
					severity="critical"
					align="start"
					actionOrder="cancel-first"
					labels={REVOKE_DIALOG_LABELS}
					confirmLoading={isRevoking}
					onConfirm={handleConfirmRevoke}>
					<AlertDialogMedia severity="critical">
						<ShieldCheck aria-hidden="true" />
					</AlertDialogMedia>
					<AlertDialogTitle>Revoke “{keyToRevoke?.name ?? ""}”?</AlertDialogTitle>
					<AlertDialogDescription>The terminal using this key stops working immediately. This can&apos;t be undone — create a new key to reconnect it.</AlertDialogDescription>
					{revokeMutation.error === null ? null : (
						<p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
							{userSafeErrorMessage(revokeMutation.error, REVOKE_KEY_FAILED_MESSAGE)}
						</p>
					)}
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
