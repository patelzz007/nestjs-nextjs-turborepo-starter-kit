import type { Condition, FlagGroup, FlagGroupDefinition, FlagGroupMember, FlagGroupMemberListQuery, RolloutUnit } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Written } from "./flag-admin.store";

export interface NewFlagGroup {
	readonly key: string;
	readonly name: string;
	readonly description: string;
	readonly definition: FlagGroupDefinition;
	readonly reason: string;
}

export interface FlagGroupChange {
	readonly name: string;
	readonly description: string;
	/** New conditions for a condition group; null keeps them (and is the only value a listed group takes). */
	readonly conditions: readonly Condition[] | null;
	readonly reason: string;
}

export type MemberChangeOutcome =
	| { readonly kind: "CHANGED"; readonly written: Written<{ readonly changed: number; readonly memberCount: number }> }
	| { readonly kind: "NOT_FOUND" }
	| { readonly kind: "NOT_LISTED" }
	| { readonly kind: "TOO_MANY"; readonly limit: number }
	/** Ids of the group's unit that don't exist (users, tenants, locations; devices are not checked). */
	| { readonly kind: "UNKNOWN_SUBJECTS"; readonly unit: RolloutUnit; readonly subjectIds: readonly string[] };

export interface MemberPage {
	readonly items: readonly FlagGroupMember[];
	readonly total: number;
}

/** Flag groups, under `feature_flags.read` / `feature_flags.write`. */
export interface FlagGroupStore {
	list(actor: ActorContext): Promise<readonly FlagGroup[]>;
	find(actor: ActorContext, groupId: string): Promise<FlagGroup | null>;
	/** Null: a live group already has that key. */
	create(actor: ActorContext, group: NewFlagGroup): Promise<Written<FlagGroup> | null>;
	/** Null: no such group. */
	update(actor: ActorContext, groupId: string, change: FlagGroupChange): Promise<Written<FlagGroup> | null>;
	/** Soft-deletes the group and its members. Null: no such group. */
	remove(actor: ActorContext, groupId: string, at: number): Promise<Written<true> | null>;
	changeMembers(actor: ActorContext, groupId: string, action: "ADD" | "REMOVE", subjectIds: readonly string[], maxMembers: number, at: number): Promise<MemberChangeOutcome>;
	/** One page of a group's live members, newest first. Null: no such group. */
	members(actor: ActorContext, groupId: string, query: FlagGroupMemberListQuery): Promise<MemberPage | null>;
}

export const FLAG_GROUP_STORE = Symbol("FLAG_GROUP_STORE");
