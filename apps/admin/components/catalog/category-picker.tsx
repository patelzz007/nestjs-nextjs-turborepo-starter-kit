"use client";

import { useAuth } from "@workspace/client/lib/auth";
import * as React from "react";

import { SearchableEntityPicker, toSearchParam, type EntityOption } from "@/components/common/searchable-entity-picker";
import { CATEGORIES_TABLE_URL_STATE, toCategoriesListQuery } from "@/lib/url-state/categories";

/** Matches offered per search — the picker narrows by typing, it never lists the whole catalog. */
export const CATEGORY_PICKER_RESULT_LIMIT = 20;

export interface CategoryPickerProps {
	readonly id: string;
	/** The selected category id, or `""` for none. */
	readonly value: string;
	readonly onChange: (categoryId: string) => void;
	readonly invalid: boolean;
}

/**
 * Category picker backed by `GET /sample-category` (server-side search,
 * `CATEGORY_PICKER_RESULT_LIMIT` matches per query). The selected category's
 * name comes from `GET /sample-category/:id`, so a pre-filled value shows its
 * label even when it is not among the current matches.
 */
export function CategoryPicker({ id, value, onChange, invalid }: CategoryPickerProps): React.JSX.Element {
	const { api } = useAuth();
	const [search, setSearch] = React.useState<string>("");

	const listQuery = api.sampleCategory.list.useQuery(
		toCategoriesListQuery({ ...CATEGORIES_TABLE_URL_STATE.defaults, limit: CATEGORY_PICKER_RESULT_LIMIT, search: toSearchParam(search) }),
	);
	const selectedQuery = api.sampleCategory.detail.useQuery({ id: value }, { enabled: value.length > 0 });

	const categories = listQuery.data?.data;
	const options = React.useMemo((): readonly EntityOption[] => (categories ?? []).map((category) => ({ id: category.id, label: category.name })), [categories]);

	return (
		<SearchableEntityPicker
			id={id}
			value={value}
			onChange={onChange}
			options={options}
			selectedLabel={selectedQuery.data?.data.name}
			onSearch={setSearch}
			isLoading={listQuery.isFetching}
			isError={listQuery.isError}
			placeholder="Search categories…"
			emptyText="No matching categories"
			errorText="Couldn't load categories"
			invalid={invalid}
		/>
	);
}
