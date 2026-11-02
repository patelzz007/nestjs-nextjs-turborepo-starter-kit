"use client";

import { CUSTOMER_SEARCH_DEBOUNCE_MS, CustomerPicker, type CustomerPickerOption } from "@/components/merchant-ui/customer-picker";
import { toRewardCustomerOption } from "@/contexts/rewards/lib/reward-audience";
import type { RewardEditorState } from "@/contexts/rewards/lib/reward-editor-form";
import { keepPreviousData } from "@tanstack/react-query";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { REWARD_MAX_AUDIENCE_CUSTOMERS, RewardAudienceTypeSchema, type RewardAudienceType } from "@workspace/shared";
import { Label } from "@workspace/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
import { useDebouncedValue } from "@workspace/ui/hooks/use-debounced-value";
import * as React from "react";

interface AudienceOption {
	readonly value: RewardAudienceType;
	readonly label: string;
	readonly hint: string;
}

/** Who can claim a reward: everyone (the default), or only the customers the merchant picks. */
const AUDIENCE_OPTIONS: readonly AudienceOption[] = [
	{ value: "EVERYONE", label: "Everyone", hint: "Anyone browsing your rewards can claim it." },
	{ value: "SELECTED_CUSTOMERS", label: "Chosen customers", hint: "Only the customers you pick see it. Others never know it exists." },
];

const CHOICE_SURFACE_CLASS =
	"flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-3 font-normal transition-colors duration-150 hover:border-foreground/20 has-data-checked:border-primary has-data-checked:bg-primary/5 has-data-disabled:cursor-not-allowed has-data-disabled:opacity-60 motion-reduce:transition-none dark:has-data-checked:bg-primary/10";

/** How many customers one search page shows. */
const CUSTOMER_PAGE_SIZE = 20;

export interface MerchantRewardAudienceFieldsProps {
	readonly editor: RewardEditorState;
	readonly tenantSlug: string;
	/** The customers the reward was already given to (editing), so their names show before any search. */
	readonly initialCustomers: readonly CustomerPickerOption[];
	readonly disabled?: boolean;
}

/**
 * The editor's "Who can claim" body: everyone, or a hand-picked set of the tenant's own customers
 * (searched by name or email; only masked emails are ever shown). The shared schema decides what is
 * valid: at least one customer when the reward is for chosen customers.
 */
export function MerchantRewardAudienceFields({ editor, tenantSlug, initialCustomers, disabled = false }: MerchantRewardAudienceFieldsProps): React.JSX.Element {
	const { values, errors, setField } = editor;
	const { audienceType, audienceCustomerIds } = values;
	// Names of everyone picked so far: the saved audience, plus whoever was ticked in a search.
	const savedById = React.useMemo((): ReadonlyMap<string, CustomerPickerOption> => new Map(initialCustomers.map((option) => [option.userId, option])), [initialCustomers]);
	const [picked, setPicked] = React.useState<ReadonlyMap<string, CustomerPickerOption>>(() => new Map());

	const handleAudienceChange = React.useCallback(
		(value: string): void => {
			const parsed = RewardAudienceTypeSchema.safeParse(value);
			if (parsed.success) {
				setField("audienceType", parsed.data);
			}
		},
		[setField],
	);

	const handleAdd = React.useCallback(
		(option: CustomerPickerOption): void => {
			setPicked((current) => new Map(current).set(option.userId, option));
			if (!audienceCustomerIds.includes(option.userId)) {
				setField("audienceCustomerIds", [...audienceCustomerIds, option.userId]);
			}
		},
		[audienceCustomerIds, setField],
	);
	const handleRemove = React.useCallback(
		(userId: string): void => {
			setField(
				"audienceCustomerIds",
				audienceCustomerIds.filter((id) => id !== userId),
			);
		},
		[audienceCustomerIds, setField],
	);

	const selected = React.useMemo(
		(): readonly CustomerPickerOption[] =>
			audienceCustomerIds.map(
				(userId): CustomerPickerOption =>
					picked.get(userId) ?? savedById.get(userId) ?? { userId, fullName: "Customer", maskedEmail: null, detail: "", unavailableReason: null },
			),
		[audienceCustomerIds, picked, savedById],
	);

	return (
		<div className="flex flex-col gap-4">
			<RadioGroup aria-label="Who can claim" value={audienceType} onValueChange={handleAudienceChange} disabled={disabled} className="grid gap-2 sm:grid-cols-2">
				{AUDIENCE_OPTIONS.map((option): React.JSX.Element => (
					<Label key={option.value} className={CHOICE_SURFACE_CLASS}>
						<RadioGroupItem value={option.value} className="mt-0.5" />
						<span className="flex min-w-0 flex-col gap-0.5">
							<span className="text-sm font-medium text-foreground">{option.label}</span>
							<span className="text-xs text-muted-foreground">{option.hint}</span>
						</span>
					</Label>
				))}
			</RadioGroup>
			{audienceType === "SELECTED_CUSTOMERS" ? (
				<RewardCustomerSearch
					tenantSlug={tenantSlug}
					selected={selected}
					onAdd={handleAdd}
					onRemove={handleRemove}
					disabled={disabled}
					errorMessage={errors.audienceCustomerIds}
				/>
			) : null}
		</div>
	);
}

interface RewardCustomerSearchProps {
	readonly tenantSlug: string;
	readonly selected: readonly CustomerPickerOption[];
	readonly onAdd: (option: CustomerPickerOption) => void;
	readonly onRemove: (userId: string) => void;
	readonly disabled: boolean;
	readonly errorMessage: string | undefined;
}

/** The picker fed by `GET /tenants/:tenantSlug/rewards/customers`, searched as the merchant types. */
function RewardCustomerSearch({ tenantSlug, selected, onAdd, onRemove, disabled, errorMessage }: RewardCustomerSearchProps): React.JSX.Element {
	const { api } = useAuth();
	const [search, setSearch] = React.useState("");
	const settledSearch = useDebouncedValue(search.trim(), CUSTOMER_SEARCH_DEBOUNCE_MS);
	const customersQuery = api.tenants.rewards.customers.useQuery(
		{ tenantSlug, page: 1, limit: CUSTOMER_PAGE_SIZE, ...(settledSearch.length === 0 ? {} : { search: settledSearch }) },
		{ placeholderData: keepPreviousData },
	);
	const options = React.useMemo((): readonly CustomerPickerOption[] => (customersQuery.data?.data ?? []).map(toRewardCustomerOption), [customersQuery.data]);

	return (
		<CustomerPicker
			id="audienceCustomerIds"
			search={search}
			onSearchChange={setSearch}
			options={options}
			selected={selected}
			onAdd={onAdd}
			onRemove={onRemove}
			isLoading={customersQuery.isPending}
			isError={customersQuery.isError}
			max={REWARD_MAX_AUDIENCE_CUSTOMERS}
			disabled={disabled}
			errorMessage={errorMessage}
		/>
	);
}
