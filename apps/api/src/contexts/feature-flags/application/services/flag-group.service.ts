import {
	FLAG_GROUP_MAX_MEMBERS,
	type ChangeFlagGroupMembersInput,
	type ChangeFlagGroupMembersResult,
	type CreateFlagGroupInput,
	type FlagGroup,
	type FlagGroupList,
	type FlagGroupMember,
	type FlagGroupMemberListQuery,
	type PaginatedServiceResult,
	type UpdateFlagGroupInput,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import { FlagGroupInUseError, FlagGroupInvalidError, FlagGroupKeyTakenError, FlagGroupNotFoundError } from "../../domain/errors/feature-flag.errors";
import type { FlagCatalogSource } from "../ports/flag-catalog.port";
import type { FlagGroupStore } from "../ports/flag-group.store";

const FIRST_PAGE = 1;

/** The console's Flag groups pages (ADR 087). A group a live or pending rule names can't be removed. */
export class FlagGroupService {
	public constructor(
		private readonly store: FlagGroupStore,
		private readonly catalog: FlagCatalogSource,
		private readonly clock: Clock,
	) {}

	public async list(actor: ActorContext): Promise<FlagGroupList> {
		return { groups: [...(await this.store.list(actor))] };
	}

	public async find(actor: ActorContext, groupId: string): Promise<FlagGroup> {
		const group = await this.store.find(actor, groupId);
		if (group === null) {
			throw new FlagGroupNotFoundError(groupId);
		}
		return group;
	}

	public async create(actor: ActorContext, input: CreateFlagGroupInput): Promise<FlagGroup> {
		const written = await this.store.create(actor, { key: input.key, name: input.name, description: input.description, definition: input.definition, reason: input.reason });
		if (written === null) {
			throw new FlagGroupKeyTakenError(input.key);
		}
		await this.announce(written.version);
		return written.value;
	}

	public async update(actor: ActorContext, groupId: string, input: UpdateFlagGroupInput): Promise<FlagGroup> {
		const current = await this.find(actor, groupId);
		if (current.definition.kind === "LIST" && input.conditions !== null) {
			throw new FlagGroupInvalidError(current.key, "A listed group has members, not conditions.");
		}
		if (current.definition.kind === "CONDITIONS" && input.conditions === null) {
			throw new FlagGroupInvalidError(current.key, "A condition group needs its conditions.");
		}
		const written = await this.store.update(actor, groupId, { name: input.name, description: input.description, conditions: input.conditions, reason: input.reason });
		if (written === null) {
			throw new FlagGroupNotFoundError(groupId);
		}
		await this.announce(written.version);
		return written.value;
	}

	public async remove(actor: ActorContext, groupId: string): Promise<void> {
		const current = await this.find(actor, groupId);
		if (current.usedBy.length > 0) {
			throw new FlagGroupInUseError(current.key, current.usedBy.map((usage) => usage.key).join(", "));
		}
		const written = await this.store.remove(actor, groupId, this.clock.now());
		if (written === null) {
			throw new FlagGroupNotFoundError(groupId);
		}
		await this.announce(written.version);
	}

	public async changeMembers(actor: ActorContext, groupId: string, input: ChangeFlagGroupMembersInput): Promise<ChangeFlagGroupMembersResult> {
		const outcome = await this.store.changeMembers(actor, groupId, input.action, input.subjectIds, FLAG_GROUP_MAX_MEMBERS, this.clock.now());
		switch (outcome.kind) {
			case "NOT_FOUND":
				throw new FlagGroupNotFoundError(groupId);
			case "NOT_LISTED":
				throw new FlagGroupInvalidError(groupId, "A condition group has conditions, not members.");
			case "TOO_MANY":
				throw new FlagGroupInvalidError(groupId, `A group holds at most ${String(outcome.limit)} subjects.`);
			case "UNKNOWN_SUBJECTS":
				throw new FlagGroupInvalidError(groupId, `These ${outcome.unit.toLowerCase()} ids don't exist: ${outcome.subjectIds.join(", ")}.`);
			case "CHANGED":
				await this.announce(outcome.written.version);
				return outcome.written.value;
		}
	}

	public async members(actor: ActorContext, groupId: string, query: FlagGroupMemberListQuery): Promise<PaginatedServiceResult<FlagGroupMember>> {
		const found = await this.store.members(actor, groupId, query);
		if (found === null) {
			throw new FlagGroupNotFoundError(groupId);
		}
		const { page } = query;
		const totalPages = Math.max(FIRST_PAGE, Math.ceil(found.total / query.limit));
		return {
			items: [...found.items],
			limit: query.limit,
			total: found.total,
			page,
			totalPages,
			nextCursor: null,
			hasNext: page < totalPages,
			hasPrevious: page > FIRST_PAGE,
		};
	}

	private async announce(version: number | null): Promise<void> {
		if (version !== null) {
			await this.catalog.changed(version);
		}
	}
}
