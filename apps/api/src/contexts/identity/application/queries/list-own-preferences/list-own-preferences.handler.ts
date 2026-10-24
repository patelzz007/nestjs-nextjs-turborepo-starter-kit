import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { UserPreferences } from "@workspace/shared";

import type { IdentityReadPort } from "../../ports/identity-read.port";
import { IDENTITY_READ } from "../../ports/identity.tokens";
import { ListOwnPreferencesQuery } from "./list-own-preferences.query";

/** The signed-in user's preferences the registry still accepts (a stale value reads as unset). */
@QueryHandler(ListOwnPreferencesQuery)
export class ListOwnPreferencesHandler implements IQueryHandler<ListOwnPreferencesQuery, UserPreferences> {
	public constructor(@Inject(IDENTITY_READ) private readonly reads: IdentityReadPort) {}

	public execute(query: ListOwnPreferencesQuery): Promise<UserPreferences> {
		return this.reads.listOwnPreferences(query.actor, query.userId);
	}
}
