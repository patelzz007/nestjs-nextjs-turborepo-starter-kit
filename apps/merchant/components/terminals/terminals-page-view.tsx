"use client";

import { MerchantAccessDenied, MerchantCapabilityGate } from "@/components/access/merchant-capability-gate";
import { MerchantLocationScopeBanner } from "@/components/layout/merchant-location-scope-banner";
import { MerchantPageHeader } from "@/components/merchant-ui/page-header";
import { MerchantStatCard } from "@/components/merchant-ui/stat-card";
import { AddTerminalDialog, type TerminalStoreOption } from "@/components/terminals/add-terminal-dialog";
import { PairingCodeDialog } from "@/components/terminals/pairing-code-dialog";
import { TerminalList } from "@/components/terminals/terminal-list";
import { TerminalPairingGuide } from "@/components/terminals/terminal-pairing-guide";
import { TerminalSettingsCard } from "@/components/terminals/terminal-settings-card";
import { clientEnv } from "@/lib/env/env.client";
import { useActiveLocationFilter, useMerchantLocation } from "@/features/tenant-context/facade";
import { prefetchForLocation, type LocationScopedPrefetch } from "@/lib/org/location-prefetch";
import { toFormSubmissionError } from "@/lib/forms/api-field-errors";
import { CREATE_TERMINAL_FIELD_ERRORS } from "@/lib/terminals/create-terminal-form";
import { isPairingComplete, requiresRepairConfirmation, shouldKeepPollingPairing, summarizeTerminalPage, type TerminalStatsState } from "@/lib/terminals/terminal-summary";
import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { initialDataOption, readPaginatedTotal } from "@workspace/client/lib/api/envelope";
import { useAuth } from "@workspace/client/lib/auth";
import { resolveAuthErrorMessage } from "@workspace/client/lib/auth/errors";
import {
	MERCHANT_CAPABILITY,
	MERCHANT_TERMINALS_PAGE_SIZE,
	nowEpochMs,
	type Envelope,
	type MerchantCreateTerminalInput,
	type MerchantTerminalPairing,
	type MerchantTerminalSettings,
	type MerchantTerminalSummary,
} from "@workspace/shared";
import { toastMessage } from "@workspace/ui/components/toast";
import { Button } from "@workspace/ui/components/button";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogMedia, AlertDialogTitle } from "@workspace/ui/components/alert-dialog";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { CheckCircle2, Hourglass, Plus, RefreshCw, Store, Trash2 } from "lucide-react";
import * as React from "react";

/** How often the open pairing dialog asks whether the till has used its code. */
export const PAIRING_STATUS_POLL_INTERVAL_MS = 3000;

const CREATE_TERMINAL_FAILED_MESSAGE = "The terminal could not be added. Try again.";
const REMOVE_DIALOG_LABELS: UiKitLabelsOverride<"alertDialog"> = { confirm: "Remove terminal", loading: "Removing…" };
const REPAIR_DIALOG_LABELS: UiKitLabelsOverride<"alertDialog"> = { confirm: "Issue new code", loading: "Issuing…" };

/** Shown instead of a number that is still loading or cannot be counted from one page. */
const UNKNOWN_STAT_VALUE = "—";
const UNCOUNTABLE_STAT_HINT = "Too many terminals to count here — see the list";

function statValue(state: TerminalStatsState | undefined, key: "active" | "awaitingPairing" | "storesCovered"): string {
	return state?.kind === "exact" ? String(state.stats[key]) : UNKNOWN_STAT_VALUE;
}

function statHint(state: TerminalStatsState | undefined, hint: string): string {
	return state?.kind === "unavailable" ? UNCOUNTABLE_STAT_HINT : hint;
}

export interface TerminalsPageViewProps {
	readonly orgSlug: string;
	/** Server-prefetched first page — the API's own envelope (real pagination meta) — with the store filter it was fetched for. */
	readonly initialTerminals?: LocationScopedPrefetch<Envelope<MerchantTerminalSummary[]>> | undefined;
	readonly initialSettings?: Envelope<MerchantTerminalSettings> | undefined;
}

/** POS terminals route — list/add/pair/remove and the policy all require `merchant:manage_api_keys`. */
export function TerminalsPageView(props: TerminalsPageViewProps): React.JSX.Element {
	return (
		<MerchantCapabilityGate
			capability={MERCHANT_CAPABILITY.manageApiKeys}
			fallback={
				<div className="space-y-8">
					<MerchantPageHeader title="POS terminals" description="Tills that validate redemptions — owner or admin access required." />
					<MerchantAccessDenied
						title="Owner or admin access required"
						description="Terminal management is limited to store owners and admins. Contact your account owner if a till needs pairing."
					/>
				</div>
			}>
			<TerminalsPageContent {...props} />
		</MerchantCapabilityGate>
	);
}

function TerminalsPageContent({ orgSlug, initialTerminals, initialSettings }: TerminalsPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const { locationId } = useActiveLocationFilter();
	const { activeLocation, accessibleLocations } = useMerchantLocation();

	const [isAddOpen, setIsAddOpen] = React.useState<boolean>(false);
	const [pairing, setPairing] = React.useState<MerchantTerminalPairing | null>(null);
	const [pairingTerminalId, setPairingTerminalId] = React.useState<string | null>(null);
	const [terminalToRepair, setTerminalToRepair] = React.useState<MerchantTerminalSummary | null>(null);
	const [terminalToRemove, setTerminalToRemove] = React.useState<MerchantTerminalSummary | null>(null);
	const [removingTerminalId, setRemovingTerminalId] = React.useState<string | null>(null);

	// Seed only with terminals the server fetched for this exact filter — never another store's under this key.
	const prefetchedTerminals = prefetchForLocation(initialTerminals, locationId);

	const terminalsQuery = api.organizations.terminals.list.useQuery(
		{ orgSlug, page: 1, limit: MERCHANT_TERMINALS_PAGE_SIZE, locationId },
		initialDataOption(prefetchedTerminals),
	);
	const terminals: readonly MerchantTerminalSummary[] = terminalsQuery.data?.data ?? [];
	const totalTerminals: number = readPaginatedTotal(terminalsQuery.data?.meta, terminals.length);
	const statsState: TerminalStatsState | undefined = terminalsQuery.data === undefined ? undefined : summarizeTerminalPage(terminals, totalTerminals);

	// While a code is on screen, watch the terminal's own store — and stop as soon as the till paired, the code
	// expired, or the terminal cannot be observed on the page (there is no per-terminal status endpoint).
	const pairingStatusQuery = api.organizations.terminals.list.useQuery(
		{ orgSlug, page: 1, limit: MERCHANT_TERMINALS_PAGE_SIZE, locationId: pairing?.terminal.locationId },
		{
			enabled: pairing !== null,
			refetchInterval: (query): number | false =>
				pairing !== null && shouldKeepPollingPairing(pairing, { terminals: query.state.data?.data }, nowEpochMs()) ? PAIRING_STATUS_POLL_INTERVAL_MS : false,
		},
	);
	const polledTerminal = pairing === null ? undefined : pairingStatusQuery.data?.data.find((terminal) => terminal.id === pairing.terminal.id);
	const isPaired = pairing !== null && isPairingComplete(pairing.terminal, polledTerminal);

	const settingsQuery = api.organizations.terminals.settings.useQuery({ orgSlug }, initialDataOption(initialSettings));

	/** Every terminal list of this organization (any store, the pairing poll included) is stale after a change. */
	const invalidateTerminals = React.useCallback((): void => {
		void queryClient.invalidateQueries({ queryKey: apiRouter.organizations.terminals.list.scopeKey({ orgSlug }) });
	}, [orgSlug, queryClient]);

	const createMutation = api.organizations.terminals.create.useMutation({
		onSuccess: (response): void => {
			setIsAddOpen(false);
			setPairing(response.data);
			invalidateTerminals();
		},
	});

	const pairingCodeMutation = api.organizations.terminals.pairingCode.useMutation({
		onSuccess: (response): void => {
			setPairing(response.data);
			invalidateTerminals();
		},
		onError: (error): void => {
			toastMessage.error({ title: resolveAuthErrorMessage(error) });
		},
		onSettled: (): void => {
			setPairingTerminalId(null);
		},
	});

	const removeMutation = api.organizations.terminals.remove.useMutation();

	const updateSettingsMutation = api.organizations.terminals.updateSettings.useMutation({
		onSuccess: (): void => {
			void settingsQuery.refetch();
		},
	});

	const stores = React.useMemo(
		(): readonly TerminalStoreOption[] => accessibleLocations.map((location): TerminalStoreOption => ({ id: location.id, name: location.name })),
		[accessibleLocations],
	);
	const defaultStoreId: string | undefined = activeLocation?.id ?? (accessibleLocations.length === 1 ? accessibleLocations.at(0)?.id : undefined);

	const resetCreate = createMutation.reset;
	const handleAddOpenChange = React.useCallback(
		(open: boolean): void => {
			if (open) {
				resetCreate();
			}
			setIsAddOpen(open);
		},
		[resetCreate],
	);

	const handleOpenAdd = React.useCallback((): void => {
		handleAddOpenChange(true);
	}, [handleAddOpenChange]);

	const handleCreate = React.useCallback(
		(input: MerchantCreateTerminalInput): void => {
			createMutation.mutate({ orgSlug, ...input });
		},
		[createMutation, orgSlug],
	);

	const issuePairingCode = React.useCallback(
		(terminal: MerchantTerminalSummary): void => {
			setPairingTerminalId(terminal.id);
			pairingCodeMutation.mutate({ orgSlug, id: terminal.id });
		},
		[orgSlug, pairingCodeMutation],
	);

	const handlePairRequest = React.useCallback(
		(terminal: MerchantTerminalSummary): void => {
			if (requiresRepairConfirmation(terminal.status)) {
				setTerminalToRepair(terminal);
				return;
			}
			issuePairingCode(terminal);
		},
		[issuePairingCode],
	);

	const handleRepairDialogChange = React.useCallback((open: boolean): void => {
		if (!open) {
			setTerminalToRepair(null);
		}
	}, []);

	const handleConfirmRepair = React.useCallback((): void => {
		if (terminalToRepair === null) {
			return;
		}
		setTerminalToRepair(null);
		issuePairingCode(terminalToRepair);
	}, [issuePairingCode, terminalToRepair]);

	const handlePairingDialogChange = React.useCallback(
		(open: boolean): void => {
			if (!open) {
				setPairing(null);
				// The till may have paired while the dialog was open: the list shows its new state.
				invalidateTerminals();
			}
		},
		[invalidateTerminals],
	);

	const handleNewCode = React.useCallback((): void => {
		if (pairing !== null) {
			issuePairingCode(pairing.terminal);
		}
	}, [issuePairingCode, pairing]);

	const handleRemoveDialogChange = React.useCallback(
		(open: boolean): void => {
			if (!open && removingTerminalId === null) {
				setTerminalToRemove(null);
			}
		},
		[removingTerminalId],
	);

	const handleConfirmRemove = React.useCallback((): void => {
		if (terminalToRemove === null) {
			return;
		}
		const removed = terminalToRemove;
		setRemovingTerminalId(removed.id);
		removeMutation.mutate(
			{ orgSlug, id: removed.id },
			{
				onSuccess: (): void => {
					setTerminalToRemove(null);
					toastMessage.success({ title: `“${removed.name}” removed`, description: "Its key no longer works." });
					invalidateTerminals();
				},
				// Keep the dialog open so the merchant can retry.
				onError: (error): void => {
					toastMessage.error({ title: resolveAuthErrorMessage(error) });
				},
				onSettled: (): void => {
					setRemovingTerminalId(null);
				},
			},
		);
	}, [invalidateTerminals, orgSlug, removeMutation, terminalToRemove]);

	const refetchTerminals = terminalsQuery.refetch;
	const handleRetryTerminals = React.useCallback((): void => {
		void refetchTerminals();
	}, [refetchTerminals]);

	const handleRetrySettings = React.useCallback((): void => {
		void settingsQuery.refetch();
	}, [settingsQuery]);

	const handleRequireRegisteredTerminalsChange = React.useCallback(
		(requireRegisteredTerminals: boolean): void => {
			updateSettingsMutation.mutate({ orgSlug, requireRegisteredTerminals });
		},
		[orgSlug, updateSettingsMutation],
	);

	const truncationNote = totalTerminals > terminals.length ? `Showing the newest ${String(terminals.length)} of ${String(totalTerminals)} terminals.` : null;

	return (
		<div className="space-y-8">
			<MerchantPageHeader
				title="POS terminals"
				description="Register each till once with a one-time pairing code. Paired tills get their own key, so you can switch one off without touching the rest."
				actions={
					<Button onClick={handleOpenAdd}>
						<Plus className="size-4" aria-hidden="true" />
						Add terminal
					</Button>
				}
			/>
			<MerchantLocationScopeBanner filteredNote="Only this store's tills are listed and counted." allStoresNote="Listing the tills of every store you can access." />

			<div className="grid gap-4 sm:grid-cols-3">
				<MerchantStatCard
					label="Active"
					value={statValue(statsState, "active")}
					hint={statHint(statsState, "Paired and ready to redeem")}
					icon={<CheckCircle2 className="size-5" aria-hidden="true" />}
				/>
				<MerchantStatCard
					label="Awaiting pairing"
					value={statValue(statsState, "awaitingPairing")}
					hint={statHint(statsState, "Code issued, till not paired yet")}
					icon={<Hourglass className="size-5" aria-hidden="true" />}
				/>
				<MerchantStatCard
					label="Stores covered"
					value={statValue(statsState, "storesCovered")}
					hint={statHint(statsState, "With at least one active till")}
					icon={<Store className="size-5" aria-hidden="true" />}
				/>
			</div>

			<TerminalList
				terminals={terminals}
				isLoading={terminalsQuery.isPending}
				isError={terminalsQuery.isError}
				onRetry={handleRetryTerminals}
				onAddRequest={handleOpenAdd}
				pairingTerminalId={pairingTerminalId}
				removingTerminalId={removingTerminalId}
				onPairRequest={handlePairRequest}
				onRemoveRequest={setTerminalToRemove}
				truncationNote={truncationNote}
			/>

			<TerminalSettingsCard
				settings={settingsQuery.data?.data}
				isLoading={settingsQuery.isPending}
				isError={settingsQuery.isError}
				onRetry={handleRetrySettings}
				isSaving={updateSettingsMutation.isPending}
				saveErrorMessage={updateSettingsMutation.error === null ? null : resolveAuthErrorMessage(updateSettingsMutation.error)}
				onRequireRegisteredTerminalsChange={handleRequireRegisteredTerminalsChange}
			/>

			<TerminalPairingGuide apiBaseUrl={clientEnv.NEXT_PUBLIC_API_URL} />

			<AddTerminalDialog
				open={isAddOpen}
				onOpenChange={handleAddOpenChange}
				stores={stores}
				defaultStoreId={defaultStoreId}
				isPending={createMutation.isPending}
				submissionError={createMutation.error === null ? null : toFormSubmissionError(createMutation.error, CREATE_TERMINAL_FIELD_ERRORS, CREATE_TERMINAL_FAILED_MESSAGE)}
				onSubmit={handleCreate}
			/>

			<PairingCodeDialog
				pairing={pairing}
				onOpenChange={handlePairingDialogChange}
				isPaired={isPaired}
				apiBaseUrl={clientEnv.NEXT_PUBLIC_API_URL}
				onNewCode={handleNewCode}
				isIssuingCode={pairingCodeMutation.isPending}
			/>

			<AlertDialog open={terminalToRepair !== null} onOpenChange={handleRepairDialogChange}>
				<AlertDialogContent severity="warning" align="start" actionOrder="cancel-first" labels={REPAIR_DIALOG_LABELS} onConfirm={handleConfirmRepair}>
					<AlertDialogMedia severity="warning">
						<RefreshCw aria-hidden="true" />
					</AlertDialogMedia>
					<AlertDialogTitle>Re-pair “{terminalToRepair?.name ?? ""}”?</AlertDialogTitle>
					<AlertDialogDescription>
						A new one-time code is issued now. As soon as a till uses it, this till&apos;s current key stops working — until then it keeps running.
					</AlertDialogDescription>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog open={terminalToRemove !== null} onOpenChange={handleRemoveDialogChange}>
				<AlertDialogContent
					severity="critical"
					align="start"
					actionOrder="cancel-first"
					labels={REMOVE_DIALOG_LABELS}
					confirmLoading={removingTerminalId !== null}
					onConfirm={handleConfirmRemove}>
					<AlertDialogMedia severity="critical">
						<Trash2 aria-hidden="true" />
					</AlertDialogMedia>
					<AlertDialogTitle>Remove “{terminalToRemove?.name ?? ""}”?</AlertDialogTitle>
					<AlertDialogDescription>
						The till stops working immediately and its key is revoked. This can&apos;t be undone — add it again and pair it to reconnect.
					</AlertDialogDescription>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
