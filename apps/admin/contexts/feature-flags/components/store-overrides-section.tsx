"use client";

import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import {
	RemoveFeatureFlagStoreOverrideSchema,
	SetFeatureFlagStoreOverrideSchema,
	type FeatureFlagStoreOption,
	type FeatureFlagStoreOverride,
	type StoreFeatureFlagKey,
} from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { toastMessage } from "@workspace/ui/components/toast";
import * as React from "react";

import { OptionSelectField } from "@/components/common/form-fields";
import { toastMutationError } from "@/lib/api/mutation-error";

/** The branch choice meaning "every branch of the merchant" (a merchant-wide setting). */
export const WHOLE_MERCHANT = "whole-merchant";
/** A store's own setting: on or off (a store has no share of people of its own). */
type StoreSetting = "on" | "off";
const SETTINGS: readonly StoreSetting[] = ["on", "off"];
const SETTING_LABELS: Readonly<Record<StoreSetting, string>> = { on: "On", off: "Off" };

function settingLabel(setting: StoreSetting): string {
	return SETTING_LABELS[setting];
}

/** Where a per-store setting applies, in words. */
export function describeStore(override: Pick<FeatureFlagStoreOverride, "tenantName" | "locationName">): string {
	return override.locationName ?? `${override.tenantName}, every branch`;
}

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

export interface StoreOverridesSectionProps {
	readonly flagKey: StoreFeatureFlagKey;
	readonly title: string;
	readonly canChange: boolean;
}

/**
 * A store flag's per-store settings (enhancement 5.11): each merchant's or branch's own value. A branch's
 * setting decides over its merchant's, which decides over the deployment's; with none, the store follows
 * the setting above.
 */
export function StoreOverridesSection({ flagKey, title, canChange }: StoreOverridesSectionProps): React.JSX.Element {
	const { api } = useAuth();
	const overrides = api.featureFlags.overrides.useQuery({ key: flagKey }).data?.data.overrides;
	const headingId = React.useId();
	return (
		<section aria-labelledby={headingId} className="flex flex-col gap-3 border-t border-border pt-4">
			<div className="flex flex-col gap-1">
				<h3 id={headingId} className="text-sm font-medium">
					Per store
				</h3>
				<p className="text-sm text-muted-foreground">A branch&apos;s own setting decides over its merchant&apos;s, and a merchant&apos;s over the one above.</p>
			</div>
			{overrides === undefined ? (
				<Skeleton className="h-16 w-full rounded-lg" />
			) : overrides.length === 0 ? (
				<p className="text-sm text-muted-foreground">No store has its own setting: every store follows the one above.</p>
			) : (
				<ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
					{overrides.map((override): React.JSX.Element => (
						<StoreOverrideRow key={override.id} override={override} flagKey={flagKey} canChange={canChange} />
					))}
				</ul>
			)}
			{canChange ? <SetStoreOverrideForm flagKey={flagKey} title={title} /> : null}
		</section>
	);
}

function useRefreshOverrides(flagKey: StoreFeatureFlagKey): () => Promise<void> {
	const queryClient = useQueryClient();
	return React.useCallback(
		(): Promise<void> => queryClient.invalidateQueries({ queryKey: apiRouter.featureFlags.overrides.queryKey({ key: flagKey }) }),
		[flagKey, queryClient],
	);
}

function StoreOverrideRow({
	override,
	flagKey,
	canChange,
}: {
	readonly override: FeatureFlagStoreOverride;
	readonly flagKey: StoreFeatureFlagKey;
	readonly canChange: boolean;
}): React.JSX.Element {
	const { api } = useAuth();
	const refresh = useRefreshOverrides(flagKey);
	const [removing, setRemoving] = React.useState(false);
	const [reason, setReason] = React.useState("");
	const reasonId = React.useId();
	const store = describeStore(override);
	const remove = api.featureFlags.removeOverride.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: `${store}: back to the setting above` });
			await refresh();
		},
		onError: (error): void => {
			toastMutationError("Could not remove the store's setting", error);
		},
	});
	const { mutate } = remove;
	const valid: boolean = RemoveFeatureFlagStoreOverrideSchema.safeParse({ reason }).success && !remove.isPending;
	const startRemoving = React.useCallback((): void => {
		setRemoving(true);
	}, []);
	const stopRemoving = React.useCallback((): void => {
		setRemoving(false);
		setReason("");
	}, []);
	const handleReason = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setReason(event.currentTarget.value);
	}, []);
	const handleSubmit = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			event.preventDefault();
			const parsed = RemoveFeatureFlagStoreOverrideSchema.safeParse({ reason });
			if (parsed.success) {
				mutate({ key: flagKey, overrideId: override.id, ...parsed.data });
			}
		},
		[flagKey, mutate, override.id, reason],
	);
	return (
		<li className="flex flex-col gap-2 p-3 text-sm">
			<div className="flex flex-wrap items-center gap-2">
				<span className="font-medium">{store}</span>
				<StatusBadge tone={override.enabled ? "success" : "neutral"}>{override.enabled ? "On" : "Off"}</StatusBadge>
				{canChange && !removing ? (
					<Button type="button" variant="ghost" size="sm" className="ms-auto" onClick={startRemoving}>
						Remove
					</Button>
				) : null}
			</div>
			<p className="text-muted-foreground">
				{DATE.format(override.updatedAt)}
				{override.updatedByName === null ? "" : ` by ${override.updatedByName}`}: {override.reason}
			</p>
			{removing ? (
				<form className="flex flex-col gap-2" onSubmit={handleSubmit} aria-label={`Remove ${store}'s setting`}>
					<Label htmlFor={reasonId}>Why remove it (kept in the audit log)</Label>
					<Input id={reasonId} value={reason} onChange={handleReason} placeholder="e.g. The new tills are in" />
					<div className="flex gap-2">
						<Button type="submit" size="sm" variant="destructive" disabled={!valid}>
							Remove setting
						</Button>
						<Button type="button" size="sm" variant="ghost" onClick={stopRemoving}>
							Cancel
						</Button>
					</div>
				</form>
			) : null}
		</li>
	);
}

function SetStoreOverrideForm({ flagKey, title }: { readonly flagKey: StoreFeatureFlagKey; readonly title: string }): React.JSX.Element {
	const { api } = useAuth();
	const refresh = useRefreshOverrides(flagKey);
	const [search, setSearch] = React.useState("");
	// Typing stays instant; the search follows when React has a moment.
	const deferredSearch = React.useDeferredValue(search.trim());
	const stores = api.featureFlags.stores.useQuery(deferredSearch.length === 0 ? {} : { search: deferredSearch }).data?.data.stores;
	const [tenantId, setTenantId] = React.useState<string | null>(null);
	const [branch, setBranch] = React.useState<string>(WHOLE_MERCHANT);
	const [setting, setSetting] = React.useState<StoreSetting>("on");
	const [reason, setReason] = React.useState("");
	const searchId = React.useId();
	const reasonId = React.useId();
	const merchant: FeatureFlagStoreOption | undefined = stores?.find((store) => store.tenantId === tenantId);
	const merchantIds = React.useMemo((): readonly string[] => (stores ?? []).map((store) => store.tenantId), [stores]);
	const branchIds = React.useMemo((): readonly string[] => [WHOLE_MERCHANT, ...(merchant?.branches ?? []).map((branchOption) => branchOption.locationId)], [merchant]);
	const merchantLabel = React.useCallback((id: string): string => stores?.find((store) => store.tenantId === id)?.tenantName ?? id, [stores]);
	const branchLabel = React.useCallback(
		(id: string): string => (id === WHOLE_MERCHANT ? "Every branch" : (merchant?.branches.find((branchOption) => branchOption.locationId === id)?.name ?? id)),
		[merchant],
	);
	const chooseMerchant = React.useCallback((id: string): void => {
		setTenantId(id);
		setBranch(WHOLE_MERCHANT);
	}, []);
	const save = api.featureFlags.setOverride.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: `${title}: store setting saved` });
			setReason("");
			await refresh();
		},
		onError: (error): void => {
			toastMutationError("Could not save the store's setting", error);
		},
	});
	const draft = { tenantId, locationId: branch === WHOLE_MERCHANT ? null : branch, enabled: setting === "on", reason };
	const valid: boolean = SetFeatureFlagStoreOverrideSchema.safeParse(draft).success && !save.isPending;
	const { mutate } = save;
	const handleSubmit = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			event.preventDefault();
			const parsed = SetFeatureFlagStoreOverrideSchema.safeParse({ tenantId, locationId: branch === WHOLE_MERCHANT ? null : branch, enabled: setting === "on", reason });
			if (parsed.success) {
				mutate({ key: flagKey, ...parsed.data });
			}
		},
		[branch, flagKey, mutate, reason, setting, tenantId],
	);
	const handleSearch = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setSearch(event.currentTarget.value);
	}, []);
	const handleReason = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setReason(event.currentTarget.value);
	}, []);
	return (
		<form className="flex flex-col gap-3" onSubmit={handleSubmit} aria-label={`Set ${title} for a store`}>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={searchId}>Find a merchant</Label>
				<Input id={searchId} type="search" value={search} onChange={handleSearch} placeholder="e.g. Jonker" />
			</div>
			<div className="grid gap-3 sm:grid-cols-3">
				<OptionSelectField id={`${flagKey}-merchant`} label="Merchant" value={tenantId ?? ""} options={merchantIds} onChange={chooseMerchant} labelOf={merchantLabel} />
				<OptionSelectField id={`${flagKey}-branch`} label="Branch" value={branch} options={branchIds} onChange={setBranch} labelOf={branchLabel} />
				<OptionSelectField id={`${flagKey}-setting`} label="Setting" value={setting} options={SETTINGS} onChange={setSetting} labelOf={settingLabel} />
			</div>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={reasonId}>Why (kept in the audit log)</Label>
				<Input id={reasonId} value={reason} onChange={handleReason} placeholder="e.g. Bukit Katil's tills are being replaced" />
			</div>
			<div>
				<Button type="submit" size="sm" disabled={!valid}>
					Save store setting
				</Button>
			</div>
		</form>
	);
}
