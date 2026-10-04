"use client";

import { useAuth } from "@workspace/client/lib/auth";
import * as React from "react";

import { SearchableEntityPicker, toSearchParam, type EntityOption } from "@/components/common/searchable-entity-picker";
import { KYB_STATUS_LABELS } from "@/lib/data-table/enum-filter-options";
import { MERCHANTS_TABLE_URL_STATE, toMerchantsListQuery } from "@/lib/url-state/merchants";

/** Matches offered per search — the picker narrows by typing, it never lists every merchant. */
export const MERCHANT_PICKER_RESULT_LIMIT = 20;

export interface MerchantPickerProps {
	readonly id: string;
	/** The selected organization id, or `""` for none. */
	readonly value: string;
	readonly onChange: (organizationId: string) => void;
	/** Name of the selected merchant (the panel already loads its detail). */
	readonly selectedName: string | undefined;
}

/** Merchant picker backed by `GET /admin/organizations?search=` (server-side search, capped matches). */
export function MerchantPicker({ id, value, onChange, selectedName }: MerchantPickerProps): React.JSX.Element {
	const { api } = useAuth();
	const [search, setSearch] = React.useState<string>("");
	const listQuery = api.rewardsAdmin.listOrganizations.useQuery(
		toMerchantsListQuery({ ...MERCHANTS_TABLE_URL_STATE.defaults, limit: MERCHANT_PICKER_RESULT_LIMIT, search: toSearchParam(search) }),
	);

	const merchants = listQuery.data?.data;
	const options = React.useMemo(
		(): readonly EntityOption[] => (merchants ?? []).map((merchant) => ({ id: merchant.id, label: `${merchant.businessName} (${KYB_STATUS_LABELS[merchant.kybStatus]})` })),
		[merchants],
	);

	return (
		<SearchableEntityPicker
			id={id}
			value={value}
			onChange={onChange}
			options={options}
			selectedLabel={selectedName}
			onSearch={setSearch}
			isLoading={listQuery.isFetching}
			isError={listQuery.isError}
			placeholder="Search merchants…"
			emptyText="No matching merchants"
			errorText="Couldn't load merchants"
		/>
	);
}
