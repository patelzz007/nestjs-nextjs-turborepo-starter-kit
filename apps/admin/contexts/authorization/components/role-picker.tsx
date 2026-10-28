"use client";

import { LIST_FIRST_PAGE } from "@workspace/client/lib/url-state/list-url-state";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import type { RoleListItem } from "@workspace/shared";
import * as React from "react";

import { SearchableEntityPicker, toSearchParam, type EntityOption } from "@/components/common/searchable-entity-picker";

/** Matches offered per search — the picker narrows by typing, it never lists the whole role catalog. */
export const ROLE_PICKER_RESULT_LIMIT = 20;

export interface RolePickerProps {
	readonly id: string;
	/** The selected role id, or `""` for none. */
	readonly value: string;
	readonly onChange: (roleId: string) => void;
	/** Roles never offered (e.g. the ones the user already holds). */
	readonly excludedRoleIds: ReadonlySet<string>;
	/** Whether the session may list roles (`role.list`); without it no search runs. */
	readonly enabled: boolean;
}

/**
 * The roles a staff member can be given: platform roles they do not already hold. Tenant-role templates
 * (ADR 067) define each business's roles and are never assigned to staff.
 */
export function assignableRoleOptions(roles: readonly Pick<RoleListItem, "id" | "name" | "kind">[], excludedRoleIds: ReadonlySet<string>): readonly EntityOption[] {
	return roles.filter((role) => role.kind === "PLATFORM" && !excludedRoleIds.has(role.id)).map((role) => ({ id: role.id, label: role.name }));
}

/**
 * Active-role picker backed by `GET /admin/roles` (server-side name search, `filter[isActive]=true`,
 * `ROLE_PICKER_RESULT_LIMIT` matches per query). The chosen role's name is kept when the next search no
 * longer matches it, so the closed picker always shows a name, never an id.
 */
export function RolePicker({ id, value, onChange, excludedRoleIds, enabled }: RolePickerProps): React.JSX.Element {
	const { api } = useAuth();
	const [search, setSearch] = React.useState<string>("");
	const [chosenLabel, setChosenLabel] = React.useState<string | undefined>(undefined);

	const listQuery = api.admin.roles.list.useQuery(
		{ page: LIST_FIRST_PAGE, limit: ROLE_PICKER_RESULT_LIMIT, search: toSearchParam(search), filter: { isActive: { eq: true } } },
		{ enabled },
	);

	const roles = listQuery.data?.data;
	const options = React.useMemo((): readonly EntityOption[] => assignableRoleOptions(roles ?? [], excludedRoleIds), [excludedRoleIds, roles]);

	const handleChange = React.useCallback(
		(roleId: string): void => {
			setChosenLabel(options.find((option) => option.id === roleId)?.label);
			onChange(roleId);
		},
		[onChange, options],
	);

	return (
		<SearchableEntityPicker
			id={id}
			value={value}
			onChange={handleChange}
			options={options}
			selectedLabel={chosenLabel}
			onSearch={setSearch}
			isLoading={listQuery.isFetching}
			isError={listQuery.isError}
			placeholder="Search roles…"
			emptyText="No roles available to assign"
			errorText="Could not load the role catalog. Check LIST:ROLE permission and refresh."
		/>
	);
}
