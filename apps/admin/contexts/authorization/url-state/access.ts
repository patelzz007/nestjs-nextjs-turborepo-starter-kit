// The access pages keep each list's page in the URL (ADR 023, docs/technical/api/list-queries.md §7) under
// its own keys — `roles*` and `permissions*` on /settings/access, `grants*` for a user's grant tree — so
// paging one list never moves another, and every page is shareable and undone by Back.

import { listStateToListQuery, type TableFilterState, type TableListQueryInput } from "@workspace/client/lib/api/list-query";
import { listUrlParams } from "@workspace/client/lib/url-state/list-url-state";
import { defineUrlState } from "@workspace/client/lib/url-state/url-state";
import { LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT, permissionListQuery, roleListQuery } from "@workspace/shared";

/** Roles per page of the role catalog. */
export const ROLE_LIST_PAGE_SIZE = LIST_DEFAULT_LIMIT;
/** Permissions per page of a permission tree: the largest page, so a page holds whole groups. */
export const PERMISSION_LIST_PAGE_SIZE = LIST_MAX_LIMIT;

const ROLE_PAGE_SIZES: readonly number[] = [ROLE_LIST_PAGE_SIZE];
const PERMISSION_PAGE_SIZES: readonly number[] = [PERMISSION_LIST_PAGE_SIZE];

/** `?rolesPage=&rolesSort=` — the list keys of `GET /admin/roles`. */
export const ROLES_URL_STATE = defineUrlState(
	{ ...listUrlParams(roleListQuery, { pageSizes: ROLE_PAGE_SIZES, defaultLimit: ROLE_LIST_PAGE_SIZE }) },
	{ urlKeys: { page: "rolesPage", limit: "rolesLimit", cursor: "rolesCursor", sort: "rolesSort" } },
);

export type RolesUrlState = typeof ROLES_URL_STATE.defaults;

/** `?permissionsPage=` — the list keys of `GET /admin/permissions` on /settings/access. */
export const PERMISSIONS_URL_STATE = defineUrlState(
	{ ...listUrlParams(permissionListQuery, { pageSizes: PERMISSION_PAGE_SIZES, defaultLimit: PERMISSION_LIST_PAGE_SIZE }) },
	{ urlKeys: { page: "permissionsPage", limit: "permissionsLimit", cursor: "permissionsCursor", sort: "permissionsSort" } },
);

/** `?grantsPage=` — the page of `GET /admin/permissions` a user's direct-grant tree shows. */
export const GRANTS_URL_STATE = defineUrlState(
	{ ...listUrlParams(permissionListQuery, { pageSizes: PERMISSION_PAGE_SIZES, defaultLimit: PERMISSION_LIST_PAGE_SIZE }) },
	{ urlKeys: { page: "grantsPage", limit: "grantsLimit", cursor: "grantsCursor", sort: "grantsSort" } },
);

export type PermissionsUrlState = typeof PERMISSIONS_URL_STATE.defaults;

/** A catalog list request: the URL's list keys. */
export type CatalogListQueryInput = Pick<TableListQueryInput<TableFilterState>, "page" | "limit" | "sort">;

export function toRolesQuery(state: RolesUrlState): CatalogListQueryInput {
	const { page, limit, sort } = listStateToListQuery(roleListQuery, { pagination: state, sort: state.sort });
	return { page, limit, ...(sort !== undefined ? { sort } : {}) };
}

export function toPermissionsQuery(state: PermissionsUrlState): CatalogListQueryInput {
	const { page, limit, sort } = listStateToListQuery(permissionListQuery, { pagination: state, sort: state.sort });
	return { page, limit, ...(sort !== undefined ? { sort } : {}) };
}
