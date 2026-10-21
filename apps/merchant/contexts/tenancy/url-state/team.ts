// The Team page's two lists keep their pages in the URL (ADR 023, docs/technical/api/list-queries.md §7)
// under their own keys — `members*` for the roster, `invites*` for the pending invitations — so paging one
// never moves the other, and either page is shareable and undone by Back.

import { listStateToListQuery, type TableFilterState, type TableListQueryInput } from "@workspace/client/lib/api/list-query";
import { listUrlParams } from "@workspace/client/lib/url-state/list-url-state";
import { defineUrlState } from "@workspace/client/lib/url-state/url-state";
import { LIST_DEFAULT_LIMIT, tenantMemberInviteListQuery, tenantMemberListQuery } from "@workspace/shared";

/** Rows per page of either list. */
export const TEAM_LIST_PAGE_SIZE = LIST_DEFAULT_LIMIT;

const TEAM_PAGE_SIZES: readonly number[] = [TEAM_LIST_PAGE_SIZE];

/** `?membersPage=&membersCursor=&membersSort=` — the list keys of `GET /t/:tenantSlug/members`. */
export const TEAM_MEMBERS_URL_STATE = defineUrlState(
	{ ...listUrlParams(tenantMemberListQuery, { pageSizes: TEAM_PAGE_SIZES, defaultLimit: TEAM_LIST_PAGE_SIZE }) },
	{ urlKeys: { page: "membersPage", limit: "membersLimit", cursor: "membersCursor", sort: "membersSort" } },
);

export type TeamMembersUrlState = typeof TEAM_MEMBERS_URL_STATE.defaults;

/** `?invitesPage=&invitesCursor=&invitesSort=` — the list keys of `GET /t/:tenantSlug/members/invites`. */
export const TEAM_INVITES_URL_STATE = defineUrlState(
	{ ...listUrlParams(tenantMemberInviteListQuery, { pageSizes: TEAM_PAGE_SIZES, defaultLimit: TEAM_LIST_PAGE_SIZE }) },
	{ urlKeys: { page: "invitesPage", limit: "invitesLimit", cursor: "invitesCursor", sort: "invitesSort" } },
);

export type TeamInvitesUrlState = typeof TEAM_INVITES_URL_STATE.defaults;

/** A team list request: the tenant plus the URL's list keys. */
export type TeamListQueryInput = Pick<TableListQueryInput<TableFilterState>, "page" | "limit" | "cursor" | "sort"> & { readonly tenantSlug: string };

export function toTeamMembersQuery(tenantSlug: string, state: TeamMembersUrlState): TeamListQueryInput {
	const { page, limit, cursor, sort } = listStateToListQuery(tenantMemberListQuery, { pagination: state, sort: state.sort });
	return { tenantSlug, page, limit, ...(cursor !== undefined ? { cursor } : {}), ...(sort !== undefined ? { sort } : {}) };
}

export function toTeamInvitesQuery(tenantSlug: string, state: TeamInvitesUrlState): TeamListQueryInput {
	const { page, limit, cursor, sort } = listStateToListQuery(tenantMemberInviteListQuery, { pagination: state, sort: state.sort });
	return { tenantSlug, page, limit, ...(cursor !== undefined ? { cursor } : {}), ...(sort !== undefined ? { sort } : {}) };
}
