"use client";

import { useAuth } from "@workspace/client/lib/auth";
import * as React from "react";

import { SearchableEntityPicker, toSearchParam, type EntityOption } from "@/components/common/searchable-entity-picker";
import { toUsersListQuery, USERS_TABLE_URL_STATE } from "@/lib/url-state/users";

/** Matches offered per search — the picker narrows by typing, it never lists every user. */
export const REFERRER_PICKER_RESULT_LIMIT = 20;

export interface ReferrerPickerProps {
	readonly id: string;
	/** The selected referrer's user id, or `""` for none. */
	readonly value: string;
	readonly onChange: (userId: string) => void;
}

/**
 * The "Referred by" control of the users table (ADR 035): searches users by
 * name or email through `GET /auth/admin/users?search=` (capped matches) and
 * hands the chosen id to the caller, which writes `filter[referrerId]`. A
 * pre-filled id (a shared URL) is labelled from `GET /auth/admin/users/:id`.
 */
export function ReferrerPicker({ id, value, onChange }: ReferrerPickerProps): React.JSX.Element {
	const { api } = useAuth();
	const [search, setSearch] = React.useState<string>("");
	const listQuery = api.auth.adminUsers.useQuery(toUsersListQuery({ ...USERS_TABLE_URL_STATE.defaults, limit: REFERRER_PICKER_RESULT_LIMIT, search: toSearchParam(search) }));
	const selectedQuery = api.auth.adminUserDetail.useQuery({ userId: value }, { enabled: value.length > 0 });

	const users = listQuery.data?.data;
	const options = React.useMemo((): readonly EntityOption[] => (users ?? []).map((user) => ({ id: user.id, label: `${user.fullName} (${user.email})` })), [users]);

	return (
		<SearchableEntityPicker
			id={id}
			value={value}
			onChange={onChange}
			options={options}
			selectedLabel={selectedQuery.data?.data.fullName}
			onSearch={setSearch}
			isLoading={listQuery.isFetching}
			isError={listQuery.isError}
			placeholder="Referred by…"
			emptyText="No matching users"
			errorText="Couldn't load users"
		/>
	);
}
