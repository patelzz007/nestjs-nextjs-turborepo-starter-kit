import { epochMs, type CedarAuthorizationDecision, type EpochMs, type PermissionDefinition } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { Clock } from "../../../../../platform/application/clock.port";
import { TransactionalEventCollector } from "../../../../../platform/application/events/transactional-event-collector";
import type { IdentitySessionsPort, SessionRevocationActor } from "../../../../../platform/application/ports/identity-sessions.port";
import type { SystemOperationName } from "../../../../../platform/application/system-operation-names";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import {
	AuthorizationPolicyDraftAggregate,
	type PolicyDraftState,
	type PolicySimulationSnapshot,
	type PolicySlot,
} from "../../../domain/aggregates/authorization-policy-draft.aggregate";
import { PermissionAggregate, type PermissionState } from "../../../domain/aggregates/permission.aggregate";
import { RoleAggregate, type RoleState } from "../../../domain/aggregates/role.aggregate";
import { SupportAccessGrantAggregate, type SupportAccessGrantState } from "../../../domain/aggregates/support-access-grant.aggregate";
import { UserAuthorizationAggregate, type DirectPermissionOverride, type UserAuthorizationState } from "../../../domain/aggregates/user-authorization.aggregate";
import { PolicyPublished } from "../../../domain/events/policy-published.event";
import type { ProtectedRoleHolders } from "../../../domain/policies/protected-role-holder.policy";
import type { RbacPermissionPair } from "../../../domain/policies/rbac-escalation.policy";
import type { PermissionRepository } from "../../../domain/repositories/permission.repository";
import type { PolicyDraftRepository } from "../../../domain/repositories/policy-draft.repository";
import type { RoleRepository } from "../../../domain/repositories/role.repository";
import type { SupportAccessGrantRepository } from "../../../domain/repositories/support-access-grant.repository";
import type { UserAuthorizationRepository } from "../../../domain/repositories/user-authorization.repository";
import { permissionKeyOf } from "../../../domain/rbac-catalog";
import type { AuthorizationScope } from "../../authorization-scope";
import type { CedarPolicyEvaluatorPort } from "../../ports/cedar-policy-evaluator.port";
import type { AuthorizationCatalogStore, CapabilityCatalogSyncResult, PermissionRegistrySyncResult } from "../../ports/catalog-sync.port";
import type { PermissionAuditEntry, PermissionAuditWriter } from "../../ports/permission-audit.port";
import type { PermissionReachPort } from "../../ports/permission-reach.port";
import type {
	ActivePolicyVersion,
	NewPolicySimulation,
	NewPolicyVersion,
	PolicyAuditRecord,
	PolicyAuditWriter,
	PolicyPrincipalReader,
	PolicySimulationStore,
	PolicyVersionStore,
	SimulationPrincipal,
} from "../../ports/policy-control-plane.port";
import type { RbacGraphReader, RbacMutationLock } from "../../ports/rbac-graph.port";
import type { TenantAuditRecord, TenantAuditWriter, SupportAccessTenantReader } from "../../ports/support-access.port";

export const NOW: EpochMs = epochMs(1_800_000_000_000);

export class FixedClock implements Clock {
	public constructor(private current: EpochMs = NOW) {}

	public now(): EpochMs {
		return this.current;
	}

	public advance(ms: number): void {
		this.current = epochMs(this.current + ms);
	}
}

/** A user's stored grants plus the account facts the holder counts read. */
export interface StoredUser extends UserAuthorizationState {
	readonly isActive: boolean;
}

/**
 * RBAC rows in memory, with the hierarchy reads computed over them as the Prisma graph reader does: a
 * child role inherits its ancestors' permissions; holder counts follow the lineage downwards.
 */
export class InMemoryRbacStore {
	public readonly roles = new Map<string, RoleState>();
	public readonly rolePermissions = new Map<string, readonly string[]>();
	public readonly permissions = new Map<string, PermissionState>();
	public readonly users = new Map<string, StoredUser>();
	private overrideIds = 0;

	public seedRole(state: Partial<RoleState> & Pick<RoleState, "id" | "name">, permissionIds: readonly string[] = []): void {
		this.roles.set(state.id, {
			description: null,
			isActive: true,
			isSystem: false,
			parentId: null,
			isDeleted: false,
			deletedAt: null,
			createdAt: NOW,
			updatedAt: NOW,
			...state,
		});
		this.rolePermissions.set(state.id, permissionIds);
	}

	public seedPermission(state: Partial<PermissionState> & Pick<PermissionState, "id" | "action" | "resource">): void {
		this.permissions.set(state.id, {
			scope: "GLOBAL",
			description: null,
			group: null,
			isSystem: false,
			conditions: null,
			isDeleted: false,
			deletedAt: null,
			createdAt: NOW,
			updatedAt: NOW,
			...state,
		});
	}

	public seedUser(
		userId: string,
		roleIds: readonly string[] = [],
		overrides: readonly DirectPermissionOverride[] = [],
		account: { readonly isSuperAdmin?: boolean } = {},
	): void {
		this.users.set(userId, { userId, isSuperAdmin: account.isSuperAdmin ?? false, isActive: true, roleIds: [...roleIds], overrides: [...overrides] });
	}

	public nextOverrideId(): string {
		this.overrideIds += 1;
		return `override-${String(this.overrideIds)}`;
	}

	public ancestorsOf(roleIds: readonly string[]): Set<string> {
		const collected = new Set<string>();
		let frontier: string[] = [...new Set<string>(roleIds)];
		while (frontier.length > 0) {
			for (const id of frontier) {
				collected.add(id);
			}
			frontier = frontier.flatMap((id: string): string[] => {
				const parentId: string | null = this.roles.get(id)?.parentId ?? null;
				return parentId !== null && !collected.has(parentId) ? [parentId] : [];
			});
		}
		return collected;
	}

	public descendantsOf(roleIds: readonly string[]): Set<string> {
		const lineage = new Set<string>(roleIds);
		let frontier: string[] = [...lineage];
		while (frontier.length > 0) {
			frontier = [...this.roles.values()]
				.filter((role: RoleState): boolean => role.parentId !== null && frontier.includes(role.parentId) && !lineage.has(role.id))
				.map((role: RoleState): string => role.id);
			for (const id of frontier) {
				lineage.add(id);
			}
		}
		return lineage;
	}

	public holdersOf(roleIds: ReadonlySet<string>): string[] {
		return [...this.users.values()]
			.filter((user: StoredUser): boolean => user.roleIds.some((roleId: string): boolean => roleIds.has(roleId)))
			.map((user: StoredUser): string => user.userId);
	}

	/** Every `action:resource` the user holds through roles (with inheritance) or a live ALLOW override. */
	public heldPermissionKeys(userId: string): Set<string> {
		const user: StoredUser | undefined = this.users.get(userId);
		if (user === undefined) {
			return new Set<string>();
		}
		const effectiveRoles: string[] = [...this.ancestorsOf(user.roleIds)].filter((roleId: string): boolean => this.roles.get(roleId)?.isDeleted === false);
		const fromRoles: string[] = effectiveRoles.flatMap((roleId: string): readonly string[] => this.rolePermissions.get(roleId) ?? []);
		const allowed: string[] = user.overrides.filter((override): boolean => override.effect === "ALLOW").map((override): string => override.permissionId);
		const denied = new Set<string>(user.overrides.filter((override): boolean => override.effect === "DENY").map((override): string => override.permissionId));
		return new Set<string>(
			[...fromRoles, ...allowed]
				.filter((permissionId: string): boolean => !denied.has(permissionId))
				.flatMap((permissionId: string): string[] => {
					const permission: PermissionState | undefined = this.permissions.get(permissionId);
					return permission === undefined || permission.isDeleted ? [] : [permissionKeyOf(permission)];
				}),
		);
	}
}

class InMemoryRoles implements RoleRepository {
	public constructor(private readonly store: InMemoryRbacStore) {}

	public findLive(roleId: string): Promise<RoleAggregate | null> {
		const row: RoleState | undefined = this.store.roles.get(roleId);
		return Promise.resolve(row === undefined || row.isDeleted ? null : RoleAggregate.rehydrate(row));
	}

	public findIncludingDeleted(roleId: string): Promise<RoleAggregate | null> {
		const row: RoleState | undefined = this.store.roles.get(roleId);
		return Promise.resolve(row === undefined ? null : RoleAggregate.rehydrate(row));
	}

	public findLiveByName(name: string): Promise<RoleAggregate | null> {
		const row: RoleState | undefined = [...this.store.roles.values()].find((role: RoleState): boolean => role.name === name && !role.isDeleted);
		return Promise.resolve(row === undefined ? null : RoleAggregate.rehydrate(row));
	}

	public isNameTaken(name: string): Promise<boolean> {
		return Promise.resolve([...this.store.roles.values()].some((role: RoleState): boolean => role.name === name));
	}

	public save(role: RoleAggregate): Promise<RoleState> {
		for (const change of role.pullChanges()) {
			if (change.kind === "permissions_synced") {
				this.store.rolePermissions.set(role.id, change.permissionIds);
			}
		}
		const state: RoleState = role.snapshot();
		this.store.roles.set(role.id, state);
		return Promise.resolve(state);
	}
}

class InMemoryPermissions implements PermissionRepository {
	public constructor(private readonly store: InMemoryRbacStore) {}

	public findLive(permissionId: string): Promise<PermissionAggregate | null> {
		const row: PermissionState | undefined = this.store.permissions.get(permissionId);
		return Promise.resolve(row === undefined || row.isDeleted ? null : PermissionAggregate.rehydrate(row));
	}

	public findIncludingDeleted(permissionId: string): Promise<PermissionAggregate | null> {
		const row: PermissionState | undefined = this.store.permissions.get(permissionId);
		return Promise.resolve(row === undefined ? null : PermissionAggregate.rehydrate(row));
	}

	public existsForPair(pair: RbacPermissionPair): Promise<boolean> {
		return Promise.resolve([...this.store.permissions.values()].some((row: PermissionState): boolean => permissionKeyOf(row) === permissionKeyOf(pair)));
	}

	public countLive(permissionIds: readonly string[]): Promise<number> {
		return Promise.resolve(permissionIds.filter((id: string): boolean => this.store.permissions.get(id)?.isDeleted === false).length);
	}

	public findLivePairs(permissionIds: readonly string[]): Promise<RbacPermissionPair[]> {
		return Promise.resolve(
			permissionIds.flatMap((id: string): RbacPermissionPair[] => {
				const row: PermissionState | undefined = this.store.permissions.get(id);
				return row === undefined || row.isDeleted ? [] : [{ action: row.action, resource: row.resource }];
			}),
		);
	}

	public save(permission: PermissionAggregate): Promise<PermissionState> {
		permission.pullChanges();
		const state: PermissionState = permission.snapshot();
		this.store.permissions.set(permission.id, state);
		return Promise.resolve(state);
	}
}

class InMemoryUserAuthorizations implements UserAuthorizationRepository {
	public constructor(private readonly store: InMemoryRbacStore) {}

	public findForAccount(userId: string): Promise<UserAuthorizationAggregate | null> {
		const user: StoredUser | undefined = this.store.users.get(userId);
		return Promise.resolve(user === undefined ? null : UserAuthorizationAggregate.rehydrate(user));
	}

	public findWithExpiredOverrides(now: EpochMs, limit: number): Promise<UserAuthorizationAggregate[]> {
		return Promise.resolve(
			[...this.store.users.values()]
				.filter((user: StoredUser): boolean => user.overrides.some((override): boolean => override.expiresAt !== null && override.expiresAt < now))
				.sort((left: StoredUser, right: StoredUser): number => left.userId.localeCompare(right.userId))
				.slice(0, limit)
				.map((user: StoredUser): UserAuthorizationAggregate => UserAuthorizationAggregate.rehydrate(user)),
		);
	}

	/** Stores the aggregate's current roles and overrides (a new override gets its row id here, as on insert). */
	public save(authorization: UserAuthorizationAggregate): Promise<void> {
		authorization.pullChanges();
		const stored: StoredUser | undefined = this.store.users.get(authorization.userId);
		const overrides: DirectPermissionOverride[] = [...authorization.overridesWithEffect("ALLOW"), ...authorization.overridesWithEffect("DENY")].map(
			(override): DirectPermissionOverride => ({ ...override, id: override.id ?? this.store.nextOverrideId() }),
		);
		this.store.users.set(authorization.userId, {
			userId: authorization.userId,
			isSuperAdmin: authorization.account.isSuperAdmin,
			isActive: stored?.isActive ?? true,
			roleIds: [...authorization.assignedRoleIds],
			overrides,
		});
		return Promise.resolve();
	}
}

class InMemoryRbacGraph implements RbacGraphReader {
	public constructor(private readonly store: InMemoryRbacStore) {}

	public withAllAncestors(roleIds: readonly string[]): Promise<ReadonlySet<string>> {
		return Promise.resolve(this.store.ancestorsOf(roleIds));
	}

	public holdersOfLineage(roleId: string): Promise<string[]> {
		return Promise.resolve(this.store.holdersOf(this.store.descendantsOf([roleId])));
	}

	public holdersOfPermission(permissionId: string): Promise<string[]> {
		const conferring: string[] = [...this.store.rolePermissions.entries()]
			.filter(([, permissionIds]): boolean => permissionIds.includes(permissionId))
			.map(([roleId]): string => roleId);
		const direct: string[] = [...this.store.users.values()]
			.filter((user: StoredUser): boolean => user.overrides.some((override): boolean => override.permissionId === permissionId))
			.map((user: StoredUser): string => user.userId);
		return Promise.resolve([...new Set<string>([...direct, ...this.store.holdersOf(this.store.descendantsOf(conferring))])]);
	}

	public permissionPairsConferredBy(roleIds: readonly string[]): Promise<RbacPermissionPair[]> {
		return Promise.resolve(
			roleIds.flatMap((roleId: string): RbacPermissionPair[] =>
				(this.store.rolePermissions.get(roleId) ?? []).flatMap((permissionId: string): RbacPermissionPair[] => {
					const permission: PermissionState | undefined = this.store.permissions.get(permissionId);
					return permission === undefined || permission.isDeleted ? [] : [{ action: permission.action, resource: permission.resource }];
				}),
			),
		);
	}

	public assignedRoleIds(userId: string): Promise<string[]> {
		return Promise.resolve([...(this.store.users.get(userId)?.roleIds ?? [])]);
	}

	public effectiveRoleNames(roleIds: readonly string[]): Promise<ReadonlySet<string>> {
		return Promise.resolve(
			new Set<string>(
				[...this.store.ancestorsOf(roleIds)].flatMap((roleId: string): string[] => {
					const role: RoleState | undefined = this.store.roles.get(roleId);
					return role === undefined || role.isDeleted || !role.isActive ? [] : [role.name];
				}),
			),
		);
	}

	public protectedRoleHolders(roleNames: readonly string[]): Promise<ProtectedRoleHolders[]> {
		return Promise.resolve(
			[...this.store.roles.values()]
				.filter((role: RoleState): boolean => roleNames.includes(role.name) && role.isSystem && !role.isDeleted)
				.map((role: RoleState): ProtectedRoleHolders => ({
					roleId: role.id,
					roleName: role.name,
					activeHolders: [...this.store.users.values()].filter((user: StoredUser): boolean => user.isActive && user.roleIds.includes(role.id)).length,
				})),
		);
	}
}

/** Counts lock acquisitions (Postgres serializes them; a test only checks the lock is taken). */
export class CountingLock implements RbacMutationLock {
	public acquired = 0;

	public acquire(): Promise<void> {
		this.acquired += 1;
		return Promise.resolve();
	}
}

export class RecordingPermissionAudit implements PermissionAuditWriter {
	public readonly entries: PermissionAuditEntry[] = [];
	public readonly retired: { readonly cutoff: EpochMs; readonly now: EpochMs }[] = [];
	public retireCount = 0;

	public append(entry: PermissionAuditEntry): Promise<void> {
		this.entries.push(entry);
		return Promise.resolve();
	}

	public retireCreatedBefore(cutoff: EpochMs, now: EpochMs): Promise<number> {
		this.retired.push({ cutoff, now });
		return Promise.resolve(this.retireCount);
	}
}

export class RecordingIdentitySessions implements IdentitySessionsPort {
	public readonly revocations: { readonly userIds: readonly string[]; readonly revokedBy: SessionRevocationActor }[] = [];

	public revokeAllSessions(userIds: readonly string[], revokedBy: SessionRevocationActor): Promise<void> {
		this.revocations.push({ userIds: [...userIds], revokedBy });
		return Promise.resolve();
	}
}

export class ScriptedCatalog implements AuthorizationCatalogStore {
	public locks = 0;
	public readonly synced: (readonly PermissionDefinition[])[] = [];
	public registryResult: PermissionRegistrySyncResult = { created: [], updated: [], orphaned: [] };
	public capabilityResult: CapabilityCatalogSyncResult = { created: 0, updated: 0 };

	public lockCatalogSync(): Promise<void> {
		this.locks += 1;
		return Promise.resolve();
	}

	public syncPermissionDefinitions(definitions: readonly PermissionDefinition[]): Promise<PermissionRegistrySyncResult> {
		this.synced.push(definitions);
		return Promise.resolve(this.registryResult);
	}

	public convergePlatformCapabilities(): Promise<CapabilityCatalogSyncResult> {
		return Promise.resolve(this.capabilityResult);
	}
}

export class InMemoryPolicyDrafts implements PolicyDraftRepository {
	public readonly rows = new Map<string, PolicyDraftState>();
	public readonly published: AuthorizationPolicyDraftAggregate[] = [];

	public findById(draftId: string): Promise<AuthorizationPolicyDraftAggregate | null> {
		const row: PolicyDraftState | undefined = this.rows.get(draftId);
		return Promise.resolve(row === undefined ? null : AuthorizationPolicyDraftAggregate.rehydrate(row));
	}

	public add(draft: AuthorizationPolicyDraftAggregate): Promise<void> {
		this.rows.set(draft.id, draft.snapshot());
		return Promise.resolve();
	}

	public savePublished(draft: AuthorizationPolicyDraftAggregate): Promise<void> {
		this.rows.set(draft.id, draft.snapshot());
		this.published.push(draft);
		return Promise.resolve();
	}
}

export class InMemoryPolicyVersions implements PolicyVersionStore {
	public readonly versions: (NewPolicyVersion & { readonly id: string; readonly supersededAt: EpochMs | null })[] = [];
	public readonly lockedSlots: PolicySlot[] = [];

	public lockSlotForPublish(slot: PolicySlot): Promise<void> {
		this.lockedSlots.push(slot);
		return Promise.resolve();
	}

	public maxVersion(slot: PolicySlot): Promise<number> {
		return Promise.resolve(Math.max(0, ...this.inSlot(slot).map((version): number => version.version)));
	}

	public supersedeActive(slot: PolicySlot, now: EpochMs): Promise<void> {
		for (const [index, version] of this.versions.entries()) {
			if (version.tenantId === slot.tenantId && version.scope === slot.scope && version.supersededAt === null) {
				this.versions.splice(index, 1, { ...version, supersededAt: now });
			}
		}
		return Promise.resolve();
	}

	public create(version: NewPolicyVersion): Promise<{ readonly id: string; readonly version: number }> {
		const id = `version-${String(this.versions.length + 1)}`;
		this.versions.push({ ...version, id, supersededAt: null });
		return Promise.resolve({ id, version: version.version });
	}

	public baselineVersionIds(tenantId: string | null): Promise<string[]> {
		return Promise.resolve(
			this.versions
				.filter((version): boolean => version.supersededAt === null && (version.tenantId === null || version.tenantId === tenantId))
				.map((version): string => version.id),
		);
	}

	public activeVersionsForTenants(tenantIds: readonly string[]): Promise<ActivePolicyVersion[]> {
		return Promise.resolve(
			this.versions
				.filter((version): boolean => version.supersededAt === null && version.tenantId !== null && tenantIds.includes(version.tenantId))
				.map((version): ActivePolicyVersion => ({
					id: version.id,
					tenantId: version.tenantId,
					scope: version.scope,
					version: version.version,
					cedarSource: version.cedarSource,
				})),
		);
	}

	private inSlot(slot: PolicySlot): NewPolicyVersion[] {
		return this.versions.filter((version): boolean => version.tenantId === slot.tenantId && version.scope === slot.scope);
	}
}

export class InMemoryPolicySimulations implements PolicySimulationStore {
	public readonly recorded: NewPolicySimulation[] = [];
	public readonly createdAt = new Map<string, EpochMs>();

	public constructor(private readonly clock: Clock) {}

	public record(simulation: NewPolicySimulation): Promise<void> {
		this.recorded.push(simulation);
		this.createdAt.set(simulation.id, this.clock.now());
		return Promise.resolve();
	}

	public latestFor(draftId: string): Promise<PolicySimulationSnapshot | null> {
		const latest: NewPolicySimulation | undefined = this.recorded.filter((simulation): boolean => simulation.draftId === draftId).at(-1);
		if (latest === undefined) {
			return Promise.resolve(null);
		}
		return Promise.resolve({ passed: latest.result.passed, createdAt: this.createdAt.get(latest.id) ?? NOW, baselineFingerprint: latest.baselineFingerprint });
	}
}

export class FixedPrincipals implements PolicyPrincipalReader {
	public constructor(private readonly principals: readonly SimulationPrincipal[] = []) {}

	public countActive(tenantId: string | null): Promise<number> {
		return Promise.resolve(this.of(tenantId).length);
	}

	public listActive(tenantId: string | null, afterMembershipId: string | null, take: number): Promise<SimulationPrincipal[]> {
		const all: SimulationPrincipal[] = this.of(tenantId);
		const start: number = afterMembershipId === null ? 0 : all.findIndex((principal): boolean => principal.id === afterMembershipId) + 1;
		return Promise.resolve(all.slice(start, start + take));
	}

	private of(tenantId: string | null): SimulationPrincipal[] {
		return this.principals.filter((principal): boolean => tenantId === null || principal.tenantId === tenantId);
	}
}

export class RecordingPolicyAudit implements PolicyAuditWriter {
	public readonly records: PolicyAuditRecord[] = [];

	public append(record: PolicyAuditRecord): Promise<void> {
		this.records.push(record);
		return Promise.resolve();
	}
}

/** Support-access grants as stored rows; `save` is a compare-and-set on the loaded status, as in Postgres. */
export class InMemorySupportGrants implements SupportAccessGrantRepository {
	public readonly rows = new Map<string, SupportAccessGrantState>();

	public findById(grantId: string): Promise<SupportAccessGrantAggregate | null> {
		const row: SupportAccessGrantState | undefined = this.rows.get(grantId);
		return Promise.resolve(row === undefined ? null : SupportAccessGrantAggregate.rehydrate(row));
	}

	public add(grant: SupportAccessGrantAggregate): Promise<SupportAccessGrantState> {
		const state: SupportAccessGrantState = grant.snapshot();
		this.rows.set(grant.id, state);
		return Promise.resolve(state);
	}

	public findDueForExpiry(now: EpochMs, limit: number): Promise<SupportAccessGrantAggregate[]> {
		const expirable: ReadonlySet<string> = new Set<string>(["PENDING_APPROVAL", "PENDING_TENANT_APPROVAL", "ACTIVE"]);
		return Promise.resolve(
			[...this.rows.values()]
				.filter((row) => expirable.has(row.status) && row.expiresAt <= now)
				.sort((left, right) => left.expiresAt - right.expiresAt || left.id.localeCompare(right.id))
				.slice(0, limit)
				.map((row) => SupportAccessGrantAggregate.rehydrate(row)),
		);
	}

	public save(grant: SupportAccessGrantAggregate): Promise<"saved" | "lost"> {
		if (this.rows.get(grant.id)?.status !== grant.concurrencyToken) {
			return Promise.resolve("lost");
		}
		this.rows.set(grant.id, grant.snapshot());
		return Promise.resolve("saved");
	}
}

export class InMemoryTenants implements SupportAccessTenantReader, TenantAuditWriter {
	public readonly tenants = new Set<string>();
	public readonly owners = new Set<string>();
	public readonly audits: TenantAuditRecord[] = [];

	public addTenant(tenantId: string, ownerUserIds: readonly string[] = []): void {
		this.tenants.add(tenantId);
		for (const userId of ownerUserIds) {
			this.owners.add(`${tenantId}:${userId}`);
		}
	}

	public exists(tenantId: string): Promise<boolean> {
		return Promise.resolve(this.tenants.has(tenantId));
	}

	public isActiveOwner(tenantId: string, userId: string): Promise<boolean> {
		return Promise.resolve(this.owners.has(`${tenantId}:${userId}`));
	}

	public record(entry: TenantAuditRecord): Promise<void> {
		this.audits.push(entry);
		return Promise.resolve();
	}
}

/** Answers what the actor holds from the same in-memory grants the handlers write. */
export class StoreBackedReach implements PermissionReachPort {
	public constructor(private readonly store: InMemoryRbacStore) {}

	public heldGlobally(actorUserId: string, pairs: readonly RbacPermissionPair[]): Promise<ReadonlySet<string>> {
		const held: Set<string> = this.store.heldPermissionKeys(actorUserId);
		return Promise.resolve(new Set<string>(pairs.map(permissionKeyOf).filter((key: string): boolean => held.has(key))));
	}
}

function restorableMap<Key, Value>(map: Map<Key, Value>): () => void {
	const saved: [Key, Value][] = [...map.entries()];
	return (): void => {
		map.clear();
		for (const [key, value] of saved) {
			map.set(key, value);
		}
	};
}

/** Restores an append-only record to its current length (any array: only `length` is touched). */
function restorableArray(items: { length: number }): () => void {
	const length: number = items.length;
	return (): void => {
		items.length = length;
	};
}

/** One authorization database in memory, shared across units of work. */
export class InMemoryAuthorizationStore {
	public readonly clock: FixedClock;
	public readonly rbac = new InMemoryRbacStore();
	public readonly lock = new CountingLock();
	public readonly permissionAudit = new RecordingPermissionAudit();
	public readonly identitySessions = new RecordingIdentitySessions();
	public readonly catalog = new ScriptedCatalog();
	public readonly policyDrafts = new InMemoryPolicyDrafts();
	public readonly policyVersions = new InMemoryPolicyVersions();
	public readonly policySimulations: InMemoryPolicySimulations;
	public readonly policyAudit = new RecordingPolicyAudit();
	public readonly supportGrants = new InMemorySupportGrants();
	public readonly tenants = new InMemoryTenants();
	public readonly events = new TransactionalEventCollector();
	public principals: PolicyPrincipalReader = new FixedPrincipals();
	public readonly uow: InMemoryAuthorizationUnitOfWork;

	public constructor(clock: FixedClock = new FixedClock()) {
		this.clock = clock;
		this.policySimulations = new InMemoryPolicySimulations(clock);
		this.uow = new InMemoryAuthorizationUnitOfWork(this);
	}

	public get scope(): AuthorizationScope {
		return {
			roles: new InMemoryRoles(this.rbac),
			permissions: new InMemoryPermissions(this.rbac),
			userAuthorizations: new InMemoryUserAuthorizations(this.rbac),
			rbacGraph: new InMemoryRbacGraph(this.rbac),
			rbacLock: this.lock,
			permissionAudit: this.permissionAudit,
			identitySessions: this.identitySessions,
			catalog: this.catalog,
			policyDrafts: this.policyDrafts,
			policyVersions: this.policyVersions,
			policySimulations: this.policySimulations,
			policyPrincipals: this.principals,
			policyAudit: this.policyAudit,
			supportGrants: this.supportGrants,
			supportTenants: this.tenants,
			tenantAudit: this.tenants,
			events: this.events,
		};
	}

	/** Snapshots every stored row and recorded write; the returned function puts them back (a rollback). */
	public checkpoint(): () => void {
		const restorers: (() => void)[] = [
			restorableMap(this.rbac.roles),
			restorableMap(this.rbac.rolePermissions),
			restorableMap(this.rbac.permissions),
			restorableMap(this.rbac.users),
			restorableMap(this.policyDrafts.rows),
			restorableMap(this.supportGrants.rows),
			restorableArray(this.permissionAudit.entries),
			restorableArray(this.identitySessions.revocations),
			restorableArray(this.policyVersions.versions),
			restorableArray(this.policySimulations.recorded),
			restorableArray(this.policyAudit.records),
			restorableArray(this.tenants.audits),
		];
		const pendingEvents: number = this.events.pendingCount();
		return (): void => {
			for (const restore of restorers) {
				restore();
			}
			const collected = this.events.take();
			for (const event of collected.slice(0, pendingEvents)) {
				this.events.collect(event);
			}
		};
	}

	/** Names of the events collected so far, in order (and clears them). */
	public eventNames(): readonly string[] {
		return this.events.take().map((event): string => event.eventName);
	}

	/** The policy-published events collected so far. */
	public publishedEvents(): readonly PolicyPublished[] {
		return this.events.take().flatMap((event): PolicyPublished[] => (event instanceof PolicyPublished ? [event] : []));
	}
}

/** A unit of work over {@link InMemoryAuthorizationStore} that rolls it back when the work throws, as Postgres does. */
export class InMemoryAuthorizationUnitOfWork implements UnitOfWork<AuthorizationScope> {
	public readonly committed: { readonly actor: ActorContext; readonly operation: SystemOperationName | null }[] = [];
	public readonly rolledBack: ActorContext[] = [];

	public constructor(private readonly store: InMemoryAuthorizationStore) {}

	public run<TResult>(actor: ActorContext, work: (scope: AuthorizationScope) => Promise<TResult>): Promise<TResult> {
		return this.execute(actor, null, work);
	}

	public runSystemOperation<TResult>(operation: SystemOperationName, actor: ActorContext, work: (scope: AuthorizationScope) => Promise<TResult>): Promise<TResult> {
		return this.execute(actor, operation, work);
	}

	private async execute<TResult>(actor: ActorContext, operation: SystemOperationName | null, work: (scope: AuthorizationScope) => Promise<TResult>): Promise<TResult> {
		const rollback: () => void = this.store.checkpoint();
		try {
			const result: TResult = await work(this.store.scope);
			this.committed.push({ actor, operation });
			return result;
		} catch (error) {
			rollback();
			this.rolledBack.push(actor);
			throw error;
		}
	}
}

const REQUEST = { requestId: "req-1", ip: "198.51.100.7", userAgent: "Firefox", deviceLabel: null, endpoint: null };

export function adminActor(userId: string, overrides: { readonly isSuperAdmin?: boolean; readonly impersonatorUserId?: string | null } = {}): ActorContext {
	return {
		kind: "user",
		userId,
		sessionId: "session-1",
		tenantId: null,
		isSuperAdmin: overrides.isSuperAdmin ?? false,
		accessScope: "tenant",
		impersonatorUserId: overrides.impersonatorUserId ?? null,
		request: REQUEST,
	};
}

export function anonymousActor(): ActorContext {
	return { kind: "anonymous", tenantId: null, request: REQUEST };
}

/** The tenant's active Cedar policy version is fixed; evaluation is not part of these tests. */
export class FixedPolicyVersion implements CedarPolicyEvaluatorPort {
	public constructor(private readonly version = 7) {}

	public getActivePolicyVersion(): Promise<number> {
		return Promise.resolve(this.version);
	}

	public evaluate(): Promise<CedarAuthorizationDecision> {
		return Promise.reject(new Error("Cedar evaluation is not scripted in this test"));
	}
}
