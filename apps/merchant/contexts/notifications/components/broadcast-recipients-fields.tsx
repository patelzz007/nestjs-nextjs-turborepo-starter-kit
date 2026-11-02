"use client";

import { CUSTOMER_SEARCH_DEBOUNCE_MS, CustomerPicker, type CustomerPickerOption } from "@/components/merchant-ui/customer-picker";
import {
	BroadcastRecipientsModeSchema,
	BroadcastRedeemedFilterSchema,
	toBroadcastAudience,
	UNREACHABLE_REASON_LABELS,
	type BroadcastComposerValues,
	type BroadcastRedeemedFilter,
} from "@/contexts/notifications/lib/broadcast-composer";
import { keepPreviousData } from "@tanstack/react-query";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { BROADCAST_CHOICE_SURFACE_CLASS } from "@workspace/client/lib/features/broadcasts/broadcast-composer-form";
import {
	BROADCAST_CLAIMED_WITHIN_MAX_DAYS,
	BROADCAST_CLAIMED_WITHIN_MIN_DAYS,
	BROADCAST_MAX_CHOSEN_CUSTOMERS,
	type BroadcastAudiencePreview,
	type TenantCustomerEntry,
} from "@workspace/shared";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
import { Select, SelectContent, SelectItem, type SelectOption, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import { useDebouncedValue } from "@workspace/ui/hooks/use-debounced-value";
import { format } from "date-fns";
import * as React from "react";

const REDEEMED_OPTIONS: readonly SelectOption<BroadcastRedeemedFilter>[] = [
	{ value: "any", label: "Whether or not they redeemed" },
	{ value: "redeemed", label: "Only customers who redeemed" },
	{ value: "not-redeemed", label: "Only customers who have not redeemed yet" },
];

const LEFT_OUT_LABELS: Readonly<Record<BroadcastAudiencePreview["leftOut"][number]["reason"], string>> = {
	"no-consent": "opted out",
	banned: "banned",
	left: "left your store",
	staff: "on your team",
	deleted: "closed their account",
};

/** How many customers one search page shows. */
const CUSTOMER_PAGE_SIZE = 20;
/** How long the live count waits after the last filter change. */
const PREVIEW_DEBOUNCE_MS = 400;

/** One of the tenant's customers as the picker shows them; one who cannot hear from the store is marked why. */
export function toBroadcastCustomerOption(customer: TenantCustomerEntry): CustomerPickerOption {
	const claims = customer.claimCount === 1 ? "Claimed once" : `Claimed ${String(customer.claimCount)} times`;
	return {
		userId: customer.userId,
		fullName: customer.fullName,
		maskedEmail: customer.maskedEmail,
		detail: `${claims} · last ${format(customer.lastClaimedAt, "d MMM yyyy")}`,
		unavailableReason: customer.unreachableReason === null ? null : UNREACHABLE_REASON_LABELS[customer.unreachableReason],
	};
}

export interface BroadcastRecipientsFieldsProps {
	readonly tenantSlug: string;
	readonly values: BroadcastComposerValues;
	readonly onChange: (patch: Partial<BroadcastComposerValues>) => void;
	/** The people already picked (editing a draft), so their names show before any search. */
	readonly initialCustomers: readonly CustomerPickerOption[];
	readonly errorMessage: string | undefined;
	readonly disabled: boolean;
}

/**
 * Who the broadcast goes to: all the store's customers (filtered by how recently they claimed and whether
 * they redeemed), or a hand-picked group — one person or many. A live count says how many will get it and
 * how many are left out and why (never who).
 */
export function BroadcastRecipientsFields({ tenantSlug, values, onChange, initialCustomers, errorMessage, disabled }: BroadcastRecipientsFieldsProps): React.JSX.Element {
	const savedById = React.useMemo((): ReadonlyMap<string, CustomerPickerOption> => new Map(initialCustomers.map((option) => [option.userId, option])), [initialCustomers]);
	const [picked, setPicked] = React.useState<ReadonlyMap<string, CustomerPickerOption>>(() => new Map());

	const handleModeChange = React.useCallback(
		(value: string): void => {
			const parsed = BroadcastRecipientsModeSchema.safeParse(value);
			if (parsed.success) {
				onChange({ recipients: parsed.data });
			}
		},
		[onChange],
	);
	const handleDaysChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			const days = Number(event.currentTarget.value);
			if (Number.isInteger(days)) {
				onChange({ claimedWithinDays: Math.min(Math.max(days, BROADCAST_CLAIMED_WITHIN_MIN_DAYS), BROADCAST_CLAIMED_WITHIN_MAX_DAYS) });
			}
		},
		[onChange],
	);
	const handleRedeemedChange = React.useCallback(
		(value: string | null): void => {
			const parsed = BroadcastRedeemedFilterSchema.safeParse(value);
			if (parsed.success) {
				onChange({ redeemed: parsed.data });
			}
		},
		[onChange],
	);
	const handleAdd = React.useCallback(
		(option: CustomerPickerOption): void => {
			setPicked((current) => new Map(current).set(option.userId, option));
			if (!values.customerIds.includes(option.userId)) {
				onChange({ customerIds: [...values.customerIds, option.userId] });
			}
		},
		[onChange, values.customerIds],
	);
	const handleRemove = React.useCallback(
		(userId: string): void => {
			onChange({ customerIds: values.customerIds.filter((id) => id !== userId) });
		},
		[onChange, values.customerIds],
	);
	const selected = React.useMemo(
		(): readonly CustomerPickerOption[] =>
			values.customerIds.map(
				(userId): CustomerPickerOption =>
					picked.get(userId) ?? savedById.get(userId) ?? { userId, fullName: "Customer", maskedEmail: null, detail: "", unavailableReason: null },
			),
		[picked, savedById, values.customerIds],
	);

	return (
		<div className="flex flex-col gap-4">
			<RadioGroup aria-label="Who gets it" value={values.recipients} onValueChange={handleModeChange} disabled={disabled} className="grid gap-2 sm:grid-cols-2">
				<Label className={BROADCAST_CHOICE_SURFACE_CLASS}>
					<RadioGroupItem value="all-customers" className="mt-0.5" />
					<span className="flex flex-col gap-0.5">
						<span className="text-sm font-medium text-foreground">All my customers</span>
						<span className="text-xs text-muted-foreground">Everyone who claimed a reward from you, narrowed below.</span>
					</span>
				</Label>
				<Label className={BROADCAST_CHOICE_SURFACE_CLASS}>
					<RadioGroupItem value="chosen-customers" className="mt-0.5" />
					<span className="flex flex-col gap-0.5">
						<span className="text-sm font-medium text-foreground">Customers I pick</span>
						<span className="text-xs text-muted-foreground">One person, or a group you choose by name.</span>
					</span>
				</Label>
			</RadioGroup>

			{values.recipients === "all-customers" ? (
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="flex flex-col gap-2">
						<Label htmlFor="claimedWithinDays">Claimed in the last (days)</Label>
						<Input
							id="claimedWithinDays"
							type="number"
							inputMode="numeric"
							min={BROADCAST_CLAIMED_WITHIN_MIN_DAYS}
							max={BROADCAST_CLAIMED_WITHIN_MAX_DAYS}
							value={values.claimedWithinDays}
							onChange={handleDaysChange}
							disabled={disabled}
						/>
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="redeemed">Redeemed</Label>
						<Select<BroadcastRedeemedFilter> items={REDEEMED_OPTIONS} value={values.redeemed} onValueChange={handleRedeemedChange} disabled={disabled}>
							<SelectTrigger id="redeemed">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{REDEEMED_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
			) : (
				<BroadcastCustomerSearch tenantSlug={tenantSlug} selected={selected} onAdd={handleAdd} onRemove={handleRemove} disabled={disabled} errorMessage={errorMessage} />
			)}

			<BroadcastAudienceCount tenantSlug={tenantSlug} values={values} />
		</div>
	);
}

interface BroadcastCustomerSearchProps {
	readonly tenantSlug: string;
	readonly selected: readonly CustomerPickerOption[];
	readonly onAdd: (option: CustomerPickerOption) => void;
	readonly onRemove: (userId: string) => void;
	readonly disabled: boolean;
	readonly errorMessage: string | undefined;
}

/** The picker fed by `GET /tenants/:tenantSlug/broadcasts/customers`, searched as the merchant types. */
function BroadcastCustomerSearch({ tenantSlug, selected, onAdd, onRemove, disabled, errorMessage }: BroadcastCustomerSearchProps): React.JSX.Element {
	const { api } = useAuth();
	const [search, setSearch] = React.useState("");
	const settledSearch = useDebouncedValue(search.trim(), CUSTOMER_SEARCH_DEBOUNCE_MS);
	const customersQuery = api.tenantNotifications.broadcastCustomers.useQuery(
		{ tenantSlug, page: 1, limit: CUSTOMER_PAGE_SIZE, ...(settledSearch.length === 0 ? {} : { search: settledSearch }) },
		{ placeholderData: keepPreviousData },
	);
	const options = React.useMemo((): readonly CustomerPickerOption[] => (customersQuery.data?.data ?? []).map(toBroadcastCustomerOption), [customersQuery.data]);
	return (
		<CustomerPicker
			id="customerIds"
			search={search}
			onSearchChange={setSearch}
			options={options}
			selected={selected}
			onAdd={onAdd}
			onRemove={onRemove}
			isLoading={customersQuery.isPending}
			isError={customersQuery.isError}
			max={BROADCAST_MAX_CHOSEN_CUSTOMERS}
			disabled={disabled}
			errorMessage={errorMessage}
		/>
	);
}

/** "128 customers will get this · 6 left out (4 opted out, 2 banned)", recounted as the audience changes. */
function BroadcastAudienceCount({ tenantSlug, values }: { readonly tenantSlug: string; readonly values: BroadcastComposerValues }): React.JSX.Element | null {
	const { api } = useAuth();
	// Built from plain values, so the same filters keep the same audience and never recount.
	const { recipients, claimedWithinDays, redeemed } = values;
	const customerIdsKey = values.customerIds.join(",");
	const current = React.useMemo(
		() => toBroadcastAudience({ recipients, claimedWithinDays, redeemed, customerIds: customerIdsKey.length === 0 ? [] : customerIdsKey.split(",") }),
		[recipients, claimedWithinDays, redeemed, customerIdsKey],
	);
	const audience = useDebouncedValue(current, PREVIEW_DEBOUNCE_MS);
	const preview = api.tenantNotifications.broadcastAudiencePreview.useMutation();
	const { mutate } = preview;
	React.useEffect((): void => {
		mutate({ tenantSlug, ...audience });
	}, [audience, mutate, tenantSlug]);

	const result = preview.data?.data;
	if (result === undefined) {
		return null;
	}
	const leftOut = result.leftOut.filter((entry) => entry.count > 0);
	const leftOutTotal = leftOut.reduce((sum, entry) => sum + entry.count, 0);
	return (
		<p role="status" className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-foreground">
			<span className="font-medium tabular-nums">{result.eligible === 1 ? "1 customer" : `${String(result.eligible)} customers`}</span> will get this.
			{leftOutTotal === 0 ? null : (
				<span className="text-muted-foreground">
					{" "}
					{leftOutTotal} left out ({leftOut.map((entry) => `${String(entry.count)} ${LEFT_OUT_LABELS[entry.reason]}`).join(", ")}).
				</span>
			)}
		</p>
	);
}
