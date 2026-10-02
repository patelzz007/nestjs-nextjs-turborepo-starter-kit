"use client";

import { ApiKeyIntegrationGuide } from "@/components/api-keys/api-key-integration-guide";
import { ApiKeyList } from "@/components/api-keys/api-key-list";
import { CreateApiKeyCard } from "@/components/api-keys/create-api-key-card";
import { CreatedApiKeyNotice } from "@/components/api-keys/created-api-key-notice";
import { MerchantAccessDenied, MerchantCapabilityGate } from "@/components/access/merchant-capability-gate";
import { MerchantLocationScopeBanner } from "@/components/layout/merchant-location-scope-banner";
import { MerchantPageHeader } from "@/components/merchant-ui/page-header";
import { MerchantStatCard } from "@/components/merchant-ui/stat-card";
import { DEFAULT_API_KEY_FILTER, summarizeApiKeys, type ApiKeyFilter } from "@/lib/api-keys/api-key-summary";
import { API_KEYS_URL_STATE } from "@/lib/url-state/api-keys";
import { clientEnv } from "@/lib/env/env.client";
import { useActiveLocationFilter, useMerchantLocation } from "@/features/tenant-context/facade";
import { prefetchForLocation, type LocationScopedPrefetch } from "@/lib/org/location-prefetch";
import { orgRoutes } from "@/lib/routes";
import { initialDataOption, readPaginatedTotal, stubPaginatedMetaFromHydration, successEnvelope } from "@workspace/client/lib/api/envelope";
import { useAuth } from "@workspace/client/lib/auth";
import { useUrlState } from "@workspace/client/lib/url-state/use-url-state";
import { MERCHANT_CAPABILITY, MERCHANT_API_KEYS_PAGE_SIZE, type MerchantApiKeySummary } from "@workspace/shared";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogMedia, AlertDialogTitle } from "@workspace/ui/components/overlay/alert-dialog";
import { SHOWCASE_ALERT_DIALOG_LABELS } from "@workspace/ui/lib/form/alert-dialog-labels";
import { Ban, KeyRound, ShieldCheck, Store } from "lucide-react";
import * as React from "react";

const DEFAULT_TERMINAL_NAME = "POS Terminal";
const REVOKE_DIALOG_LABELS = { ...SHOWCASE_ALERT_DIALOG_LABELS, confirm: "Revoke key", loading: "Revoking…" };

export interface MerchantApiKeysPageViewProps {
	readonly orgSlug: string;
	/** Server-prefetched first page with the store filter it was fetched for. */
	readonly initialKeys?: LocationScopedPrefetch<readonly MerchantApiKeySummary[]> | undefined;
}

/** POS API keys route — list/create/revoke all require `merchant:manage_api_keys`. */
export function MerchantApiKeysPageView(props: MerchantApiKeysPageViewProps): React.JSX.Element {
	return (
		<MerchantCapabilityGate
			capability={MERCHANT_CAPABILITY.manageApiKeys}
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

function MerchantApiKeysPageContent({ orgSlug, initialKeys }: MerchantApiKeysPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const { locationId } = useActiveLocationFilter();
	const { activeLocation } = useMerchantLocation();

	// Seed only with keys the server fetched for this exact filter — never another store's under this key.
	const prefetchedKeys = prefetchForLocation(initialKeys, locationId);
	const initialKeysData = React.useMemo(
		() =>
			prefetchedKeys !== undefined
				? successEnvelope(
						[...prefetchedKeys],
						stubPaginatedMetaFromHydration(MERCHANT_API_KEYS_PAGE_SIZE, prefetchedKeys.length, prefetchedKeys.length >= MERCHANT_API_KEYS_PAGE_SIZE),
					)
				: undefined,
		[prefetchedKeys],
	);

	const keysQuery = api.organizations.apiKeys.list.useQuery({ orgSlug, page: 1, limit: MERCHANT_API_KEYS_PAGE_SIZE, locationId }, initialDataOption(initialKeysData));
	const keys: readonly MerchantApiKeySummary[] = keysQuery.data?.data ?? [];
	const totalKeys: number = readPaginatedTotal(keysQuery.data?.meta, keys.length);
	const stats = summarizeApiKeys(keys);

	// The filter is URL state (`?status=`): Back undoes a filter change and a shared link opens on it.
	const [{ status: filter }, updateUrlState] = useUrlState(API_KEYS_URL_STATE);
	const [name, setName] = React.useState<string>(DEFAULT_TERMINAL_NAME);
	const [createdKey, setCreatedKey] = React.useState<CreatedKey | null>(null);
	const [keyToRevoke, setKeyToRevoke] = React.useState<MerchantApiKeySummary | null>(null);
	const [revokingKeyId, setRevokingKeyId] = React.useState<string | null>(null);

	const createMutation = api.organizations.apiKeys.create.useMutation({
		onSuccess: (response): void => {
			setCreatedKey({ name: response.data.name, secret: response.data.apiKey });
			setName(DEFAULT_TERMINAL_NAME);
			// Show the new key: a consequence of the create, not a navigation, so it replaces the entry.
			updateUrlState({ status: DEFAULT_API_KEY_FILTER }, { history: "replace" });
			void keysQuery.refetch();
		},
	});

	const revokeMutation = api.organizations.apiKeys.revoke.useMutation({
		onSuccess: (): void => {
			void keysQuery.refetch();
		},
	});

	const trimmedName = name.trim();

	const handleNameChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setName(event.target.value);
	}, []);

	const handleCreate = React.useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			if (trimmedName.length === 0) {
				return;
			}
			void createMutation.mutateAsync({ orgSlug, name: trimmedName, locationId });
		},
		[createMutation, locationId, orgSlug, trimmedName],
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

	const handleRetry = React.useCallback((): void => {
		void keysQuery.refetch();
	}, [keysQuery]);

	const handleRevokeDialogChange = React.useCallback(
		(open: boolean): void => {
			if (!open && revokingKeyId === null) {
				setKeyToRevoke(null);
			}
		},
		[revokingKeyId],
	);

	const handleConfirmRevoke = React.useCallback((): void => {
		if (keyToRevoke === null) {
			return;
		}
		setRevokingKeyId(keyToRevoke.id);
		void revokeMutation
			.mutateAsync({ orgSlug, keyId: keyToRevoke.id })
			.then((): void => {
				setKeyToRevoke(null);
			})
			.catch((): void => {
				// The mutation surfaces the error; keep the dialog open to retry.
			})
			.finally((): void => {
				setRevokingKeyId(null);
			});
	}, [keyToRevoke, orgSlug, revokeMutation]);

	const truncationNote = totalKeys > keys.length ? `Showing the newest ${String(keys.length)} of ${String(totalKeys)} keys.` : null;
	const storesHint = stats.hasOrganizationWideKey ? "Plus an organization-wide key" : "With at least one active key";

	return (
		<div className="space-y-8">
			<MerchantPageHeader
				title="POS API keys"
				description="Terminal keys let your point-of-sale devices validate and confirm customer redemptions. Each key is shown once, when it's created."
			/>
			<MerchantLocationScopeBanner />

			{createdKey === null ? null : <CreatedApiKeyNotice keyName={createdKey.name} secret={createdKey.secret} onDismiss={handleDismissCreated} />}

			<div className="grid gap-4 sm:grid-cols-3">
				<MerchantStatCard label="Active keys" value={String(stats.active)} hint="Can validate redemptions now" icon={<KeyRound className="size-5" aria-hidden="true" />} />
				<MerchantStatCard label="Stores covered" value={String(stats.storesCovered)} hint={storesHint} icon={<Store className="size-5" aria-hidden="true" />} />
				<MerchantStatCard label="Revoked" value={String(stats.revoked)} hint="Kept for your records" icon={<Ban className="size-5" aria-hidden="true" />} />
			</div>

			<CreateApiKeyCard name={name} onNameChange={handleNameChange} onSubmit={handleCreate} isPending={createMutation.isPending} locationName={activeLocation?.name} />

			<ApiKeyList
				keys={keys}
				filter={filter}
				onFilterChange={handleFilterChange}
				isLoading={keysQuery.isPending}
				isError={keysQuery.isError}
				onRetry={handleRetry}
				revokingKeyId={revokingKeyId}
				onRevokeRequest={setKeyToRevoke}
				truncationNote={truncationNote}
			/>

			<ApiKeyIntegrationGuide apiBaseUrl={clientEnv.NEXT_PUBLIC_API_URL} terminalsHref={orgRoutes(orgSlug).terminals} />

			<AlertDialog open={keyToRevoke !== null} onOpenChange={handleRevokeDialogChange}>
				<AlertDialogContent
					severity="critical"
					align="start"
					actionOrder="cancel-first"
					labels={REVOKE_DIALOG_LABELS}
					confirmLoading={revokingKeyId !== null}
					onConfirm={handleConfirmRevoke}>
					<AlertDialogMedia severity="critical">
						<ShieldCheck aria-hidden="true" />
					</AlertDialogMedia>
					<AlertDialogTitle>Revoke “{keyToRevoke?.name ?? ""}”?</AlertDialogTitle>
					<AlertDialogDescription>The terminal using this key stops working immediately. This can&apos;t be undone — create a new key to reconnect it.</AlertDialogDescription>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
