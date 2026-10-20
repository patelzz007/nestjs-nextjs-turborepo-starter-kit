import {
	epochMs,
	MERCHANT_CAPABILITY,
	type TenantMemberInviteListQuery,
	type TenantMemberListQuery,
	type TenantMemberInviteResponse,
	type TenantMemberRosterResponse,
	type PaginatedServiceResult,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { MerchantAccessGrant, MerchantAccessPort, MerchantAccessRequest } from "../ports/merchant-access.port";
import type { TenantDirectoryPort, ResolvedTenantMember } from "../ports/tenant-directory.port";
import type { TeamInvitePreviewView, TeamReadPort } from "../ports/team-read.port";
import { ListMembersHandler } from "../queries/list-members/list-members.handler";
import { ListMembersQuery } from "../queries/list-members/list-members.query";
import { ListPendingInvitesHandler } from "../queries/list-pending-invites/list-pending-invites.handler";
import { ListPendingInvitesQuery } from "../queries/list-pending-invites/list-pending-invites.query";

const TENANT_ID = "0199a1b2-0000-7000-8000-000000000001";
const USER_ID = "0199a1b2-0000-7000-8000-000000000002";
const NOW = epochMs(1_792_368_000_000);
const REQUEST = { requestId: "req-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null };
const ACTOR: ActorContext = {
	kind: "user",
	userId: USER_ID,
	sessionId: "session-1",
	tenantId: null,
	isSuperAdmin: false,
	accessScope: "tenant",
	impersonatorUserId: null,
	request: REQUEST,
};

const MEMBER: ResolvedTenantMember = {
	tenantId: TENANT_ID,
	slug: "brew-bean",
	displayName: "Brew & Bean",
	userId: USER_ID,
	membership: {
		id: "0199a1b2-0000-7000-8000-000000000003",
		tenantId: TENANT_ID,
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
class RecordingPorts implements TenantDirectoryPort, MerchantAccessPort, TeamReadPort {
	public readonly capabilityRequests: MerchantAccessRequest[] = [];
	public readonly reads: { readonly kind: "members" | "invites"; readonly tenantId: string; readonly actorTenantId: string | null; readonly query: object }[] = [];
	public denyCapability = false;

	public resolveTenantId(): Promise<string> {
		return Promise.resolve(TENANT_ID);
	}

	public resolveMember(): Promise<ResolvedTenantMember> {
		return Promise.resolve(MEMBER);
	}

	public assertAccessibleLocation(): Promise<void> {
		return Promise.resolve();
	}

	public assertCapability(_actor: ActorContext, request: MerchantAccessRequest): Promise<MerchantAccessGrant> {
		this.capabilityRequests.push(request);
		return this.denyCapability ? Promise.reject(new Error("forbidden")) : Promise.resolve({ tenantId: TENANT_ID, locationScope: "ALL_LOCATIONS", locationIds: [] });
	}

	public listMembers(actor: ActorContext, tenantId: string, query: object): Promise<PaginatedServiceResult<TenantMemberRosterResponse>> {
		this.reads.push({ kind: "members", tenantId, actorTenantId: actor.tenantId, query });
		return Promise.resolve(emptyPage());
	}

	public listPendingInvites(actor: ActorContext, tenantId: string, query: object): Promise<PaginatedServiceResult<TenantMemberInviteResponse>> {
		this.reads.push({ kind: "invites", tenantId, actorTenantId: actor.tenantId, query });
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
	it("checks manage-team, then reads the requested page acting in the member's tenant", async () => {
		const query: TenantMemberListQuery = { page: 2, limit: 10, filter: { role: { eq: "CASHIER" } } };

		await new ListMembersHandler(ports, ports, ports).execute(new ListMembersQuery(ACTOR, { tenantSlug: "brew-bean", query }));

		expect(ports.capabilityRequests).toEqual([{ tenantId: TENANT_ID, capability: MERCHANT_CAPABILITY.manageTeam }]);
		expect(ports.reads).toEqual([{ kind: "members", tenantId: TENANT_ID, actorTenantId: TENANT_ID, query }]);
	});

	it("reads nothing when the capability check refuses", async () => {
		ports.denyCapability = true;

		await expect(new ListMembersHandler(ports, ports, ports).execute(new ListMembersQuery(ACTOR, { tenantSlug: "brew-bean", query: { page: 1, limit: 20 } }))).rejects.toThrow(
			"forbidden",
		);
		expect(ports.reads).toEqual([]);
	});
});

describe("ListPendingInvitesHandler", () => {
	it("checks manage-team, then reads the requested page of pending invites", async () => {
		const query: TenantMemberInviteListQuery = { page: 1, limit: 20, sort: "expiresAt" };

		await new ListPendingInvitesHandler(ports, ports, ports).execute(new ListPendingInvitesQuery(ACTOR, { tenantSlug: "brew-bean", query }));

		expect(ports.capabilityRequests).toEqual([{ tenantId: TENANT_ID, capability: MERCHANT_CAPABILITY.manageTeam }]);
		expect(ports.reads).toEqual([{ kind: "invites", tenantId: TENANT_ID, actorTenantId: TENANT_ID, query }]);
	});
});
