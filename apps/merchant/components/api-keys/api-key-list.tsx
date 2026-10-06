"use client";

import { MerchantEmptyState } from "@/components/merchant-ui/empty-state";
import { API_KEY_FILTERS, isActiveApiKey, type ApiKeyFilter } from "@/lib/api-keys/api-key-summary";
import { apiKeyScopeLabel } from "@/lib/api-keys/create-api-key-form";
import { PLATFORM_DISPLAY_REGION, type MerchantApiKeySummary } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { cn } from "@workspace/ui/lib/core/utils";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";
import { AlertTriangle, Ban, CalendarDays, KeyRound, MapPin, RotateCw } from "lucide-react";
import * as React from "react";

const FILTER_LABELS: Readonly<Record<ApiKeyFilter, string>> = { active: "Active", revoked: "Revoked", all: "All" };

/** Column layout shared by the header and every row (stacked below `md`). */
const ROW_GRID = "grid gap-3 px-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1fr)_7rem] md:items-center md:gap-4";

/** Rows shown while the first page loads (matches a typical small fleet of terminals). */
const SKELETON_ROWS = 3;

function formatDay(epochMs: number): string {
	return formatEpochMs(epochMs, "date", PLATFORM_DISPLAY_REGION);
}

export interface ApiKeyListProps {
	/** The keys of the selected status view, as the API filtered them (newest first). */
	readonly keys: readonly MerchantApiKeySummary[];
	readonly filter: ApiKeyFilter;
	readonly onFilterChange: (filter: ApiKeyFilter) => void;
	readonly isLoading: boolean;
	readonly isError: boolean;
	readonly onRetry: () => void;
	/** The key whose revoke is in flight (its button shows progress). */
	readonly revokingKeyId: string | null;
	/** Asks to revoke a key (the parent confirms first). */
	readonly onRevokeRequest: (apiKey: MerchantApiKeySummary) => void;
	/** "Showing the newest N of M keys." — when one page doesn't hold them all. */
	readonly truncationNote: string | null;
}

/** Filterable list of POS keys with loading, error and empty states. Presentational. */
export function ApiKeyList({ keys, filter, onFilterChange, isLoading, isError, onRetry, revokingKeyId, onRevokeRequest, truncationNote }: ApiKeyListProps): React.JSX.Element {
	const showColumnHeader = !isLoading && !isError && keys.length > 0;

	return (
		<section aria-labelledby="api-key-list-heading" className="rounded-xl border border-border bg-card shadow-xs">
			<div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
				<div>
					<h2 id="api-key-list-heading" className="text-base font-semibold text-foreground">
						Terminal keys
					</h2>
					<p className="text-sm text-muted-foreground">Each terminal authenticates its redemptions with its own key.</p>
				</div>
				<div role="group" aria-label="Filter keys" className="inline-flex rounded-lg border border-border bg-muted/50 p-0.5">
					{API_KEY_FILTERS.map((option: ApiKeyFilter): React.JSX.Element => (
						<FilterButton key={option} option={option} isSelected={option === filter} onSelect={onFilterChange} />
					))}
				</div>
			</div>

			{truncationNote === null ? null : <p className="border-b border-border bg-muted/30 px-5 py-2 text-xs text-muted-foreground">{truncationNote}</p>}

			{showColumnHeader ? (
				<div
					aria-hidden="true"
					className={cn(ROW_GRID, "hidden border-b border-border bg-muted/40 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase md:grid")}>
					<span>Terminal</span>
					<span>Store</span>
					<span>Created</span>
					<span />
				</div>
			) : null}

			<div>
				{isLoading ? (
					<ul aria-label="Loading keys" aria-busy="true" className="space-y-2 p-3">
						{Array.from({ length: SKELETON_ROWS }, (_, index: number) => (
							<li key={index} className="flex items-center gap-3 rounded-lg px-3 py-3">
								<Skeleton className="size-10 rounded-lg" />
								<div className="flex-1 space-y-2">
									<Skeleton className="h-4 w-40" />
									<Skeleton className="h-3 w-64" />
								</div>
							</li>
						))}
					</ul>
				) : isError ? (
					<div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
						<AlertTriangle className="size-6 text-destructive" aria-hidden="true" />
						<p className="text-sm text-foreground">Couldn&apos;t load your API keys.</p>
						<Button variant="outline" size="sm" onClick={onRetry}>
							<RotateCw className="size-4" aria-hidden="true" />
							Try again
						</Button>
					</div>
				) : keys.length === 0 ? (
					<MerchantEmptyState
						className="border-0 bg-transparent py-12"
						icon={<KeyRound className="size-5" aria-hidden="true" />}
						title={filter === "revoked" ? "No revoked keys" : "No API keys yet"}
						description={
							filter === "revoked" ? "Keys you revoke stay listed here for your records." : "Create a key for your first POS terminal to start validating redemptions."
						}
					/>
				) : (
					<ul className="divide-y divide-border" aria-label={`${FILTER_LABELS[filter]} keys`}>
						{keys.map((apiKey: MerchantApiKeySummary): React.JSX.Element => (
							<ApiKeyRow key={apiKey.id} apiKey={apiKey} isRevoking={revokingKeyId === apiKey.id} onRevokeRequest={onRevokeRequest} />
						))}
					</ul>
				)}
			</div>
		</section>
	);
}

interface FilterButtonProps {
	readonly option: ApiKeyFilter;
	readonly isSelected: boolean;
	readonly onSelect: (filter: ApiKeyFilter) => void;
}

function FilterButton({ option, isSelected, onSelect }: FilterButtonProps): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		onSelect(option);
	}, [onSelect, option]);

	return (
		<button
			type="button"
			aria-pressed={isSelected}
			onClick={handleClick}
			className={cn(
				"rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none",
				isSelected ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
			)}>
			{FILTER_LABELS[option]}
		</button>
	);
}

interface ApiKeyRowProps {
	readonly apiKey: MerchantApiKeySummary;
	readonly isRevoking: boolean;
	readonly onRevokeRequest: (apiKey: MerchantApiKeySummary) => void;
}

function ApiKeyRow({ apiKey, isRevoking, onRevokeRequest }: ApiKeyRowProps): React.JSX.Element {
	const isActive = isActiveApiKey(apiKey);
	const handleRevoke = React.useCallback((): void => {
		onRevokeRequest(apiKey);
	}, [apiKey, onRevokeRequest]);

	return (
		<li className={cn(ROW_GRID, "py-4 transition-colors hover:bg-muted/30 motion-reduce:transition-none")}>
			<div className="flex min-w-0 items-center gap-3">
				<span
					className={cn(
						"flex size-10 shrink-0 items-center justify-center rounded-lg border",
						isActive ? "border-primary/20 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground",
					)}>
					<KeyRound className="size-5" aria-hidden="true" />
				</span>
				<div className="min-w-0">
					<p className={cn("truncate font-medium", isActive ? "text-foreground" : "text-muted-foreground")}>{apiKey.name}</p>
					<span className={cn("mt-0.5 inline-flex items-center gap-1.5 text-xs font-medium", isActive ? "text-success" : "text-muted-foreground")}>
						<span aria-hidden="true" className={cn("size-1.5 rounded-full", isActive ? "bg-success" : "bg-muted-foreground")} />
						{isActive ? "Active" : "Revoked"}
					</span>
					<span className="ms-2 mt-0.5 inline-flex items-center rounded-full border border-border px-2 text-xs text-muted-foreground">
						<span className="sr-only">Access: </span>
						{apiKeyScopeLabel(apiKey.scope)}
					</span>
				</div>
			</div>
			<p className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
				<MapPin className="size-3.5 shrink-0" aria-hidden="true" />
				<span className="md:sr-only">Store: </span>
				<span className="truncate">{apiKey.locationName ?? "All stores (organization-wide)"}</span>
			</p>
			<div className="text-sm text-muted-foreground">
				<p className="flex items-center gap-1.5">
					<CalendarDays className="size-3.5 shrink-0 md:hidden" aria-hidden="true" />
					<span className="md:sr-only">Created </span>
					{formatDay(apiKey.createdAt)}
				</p>
				{apiKey.revokedAt === null ? null : (
					<p className="mt-0.5 flex items-center gap-1.5 text-xs">
						<Ban className="size-3.5 shrink-0" aria-hidden="true" />
						Revoked {formatDay(apiKey.revokedAt)}
					</p>
				)}
			</div>
			<div className="md:text-end">
				{isActive ? (
					<Button size="sm" variant="outline" loading={isRevoking} disabled={isRevoking} onClick={handleRevoke} aria-label={`Revoke ${apiKey.name}`}>
						Revoke
					</Button>
				) : null}
			</div>
		</li>
	);
}
