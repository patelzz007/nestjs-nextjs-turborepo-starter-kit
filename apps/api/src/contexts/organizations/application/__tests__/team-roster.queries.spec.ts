import {
	epochMs,
	MERCHANT_CAPABILITY,
	type OrganizationMemberInviteListQuery,
	type OrganizationMemberListQuery,
	type OrganizationMemberInviteResponse,
	type OrganizationMemberRosterResponse,
	type PaginatedServiceResult,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { MerchantAccessGrant, MerchantAccessPort, MerchantAccessRequest } from "../ports/merchant-access.port";
import type { OrganizationDirectoryPort, ResolvedOrganizationMember } from "../ports/organization-directory.port";
import type { TeamInvitePreviewView, TeamReadPort } from "../ports/team-read.port";
import { ListMembersHandler } from "../queries/list-members/list-members.handler";
import { ListMembersQuery } from "../queries/list-members/list-members.query";
import { ListPendingInvitesHandler } from "../queries/list-pending-invites/list-pending-invites.handler";
import { ListPendingInvitesQuery } from "../queries/list-pending-invites/list-pending-invites.query";

const ORGANIZATION_ID = "0199a1b2-0000-7000-8000-000000000001";
const USER_ID = "0199a1b2-0000-7000-8000-000000000002";
const NOW = epochMs(1_792_368_000_000);
const REQUEST = { requestId: "req-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null };
const ACTOR: ActorContext = {
	kind: "user",
	userId: USER_ID,
	sessionId: "session-1",
	organizationId: null,
	isSuperAdmin: false,
	accessScope: "tenant",
	impersonatorUserId: null,
	request: REQUEST,
};

const MEMBER: ResolvedOrganizationMember = {
	organizationId: ORGANIZATION_ID,
	slug: "brew-bean",
	displayName: "Brew & Bean",
	userId: USER_ID,
	membership: {
		id: "0199a1b2-0000-7000-8000-000000000003",
		organizationId: ORGANIZATION_ID,
		userId: USER_ID,
		role: "OWNER",
		status: "ACTIVE",
		displayName: null,
		locationScopeType: "ALL_LOCATIONS",
		locationIds: [],
		createdAt: NOW,
		updatedAt: NOW,
	},
	policyVersion: 1,
};

function emptyPage<Item>(): PaginatedServiceResult<Item> {
	return { items: [], limit: 1, total: 0, page: 1, totalPages: 1, nextCursor: null, hasNext: false, hasPrevious: false };
}

/** Records what each port was asked. */
class RecordingPorts implements OrganizationDirectoryPort, MerchantAccessPort, TeamReadPort {
	public readonly capabilityRequests: MerchantAccessRequest[] = [];
	public readonly reads: { readonly kind: "members" | "invites"; readonly organizationId: string; readonly actorOrganizationId: string | null; readonly query: object }[] = [];
	public denyCapability = false;

	public resolveOrganizationId(): Promise<string> {
		return Promise.resolve(ORGANIZATION_ID);
	}

	public resolveMember(): Promise<ResolvedOrganizationMember> {
		return Promise.resolve(MEMBER);
	}

	public assertAccessibleLocation(): Promise<void> {
		return Promise.resolve();
	}

	public assertCapability(_actor: ActorContext, request: MerchantAccessRequest): Promise<MerchantAccessGrant> {
		this.capabilityRequests.push(request);
		return this.denyCapability
			? Promise.reject(new Error("forbidden"))
			: Promise.resolve({ organizationId: ORGANIZATION_ID, locationScope: "ALL_LOCATIONS", locationIds: [] });
	}

	public listMembers(actor: ActorContext, organizationId: string, query: object): Promise<PaginatedServiceResult<OrganizationMemberRosterResponse>> {
		this.reads.push({ kind: "members", organizationId, actorOrganizationId: actor.organizationId, query });
		return Promise.resolve(emptyPage());
	}

	public listPendingInvites(actor: ActorContext, organizationId: string, query: object): Promise<PaginatedServiceResult<OrganizationMemberInviteResponse>> {
		this.reads.push({ kind: "invites", organizationId, actorOrganizationId: actor.organizationId, query });
		return Promise.resolve(emptyPage());
	}

	public findPendingInvitePreview(): Promise<TeamInvitePreviewView | null> {
		return Promise.resolve(null);
	}
}

let ports: RecordingPorts;

beforeEach(() => {
	ports = new RecordingPorts();
});

describe("ListMembersHandler", () => {
	it("checks manage-team, then reads the requested page acting in the member's organization", async () => {
		const query: OrganizationMemberListQuery = { page: 2, limit: 10, filter: { role: { eq: "CASHIER" } } };

		await new ListMembersHandler(ports, ports, ports).execute(new ListMembersQuery(ACTOR, { orgSlug: "brew-bean", query }));

		expect(ports.capabilityRequests).toEqual([{ organizationId: ORGANIZATION_ID, capability: MERCHANT_CAPABILITY.manageTeam }]);
		expect(ports.reads).toEqual([{ kind: "members", organizationId: ORGANIZATION_ID, actorOrganizationId: ORGANIZATION_ID, query }]);
	});

	it("reads nothing when the capability check refuses", async () => {
		ports.denyCapability = true;

		await expect(new ListMembersHandler(ports, ports, ports).execute(new ListMembersQuery(ACTOR, { orgSlug: "brew-bean", query: { page: 1, limit: 20 } }))).rejects.toThrow(
			"forbidden",
		);
		expect(ports.reads).toEqual([]);
	});
});

describe("ListPendingInvitesHandler", () => {
	it("checks manage-team, then reads the requested page of pending invites", async () => {
		const query: OrganizationMemberInviteListQuery = { page: 1, limit: 20, sort: "expiresAt" };

		await new ListPendingInvitesHandler(ports, ports, ports).execute(new ListPendingInvitesQuery(ACTOR, { orgSlug: "brew-bean", query }));

		expect(ports.capabilityRequests).toEqual([{ organizationId: ORGANIZATION_ID, capability: MERCHANT_CAPABILITY.manageTeam }]);
		expect(ports.reads).toEqual([{ kind: "invites", organizationId: ORGANIZATION_ID, actorOrganizationId: ORGANIZATION_ID, query }]);
	});
});
