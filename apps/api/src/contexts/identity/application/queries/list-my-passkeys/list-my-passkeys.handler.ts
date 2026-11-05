import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { PasskeyList } from "@workspace/shared";

import type { IdentityReadPort } from "../../ports/identity-read.port";
import { IDENTITY_READ } from "../../ports/identity.tokens";
import { ListMyPasskeysQuery } from "./list-my-passkeys.query";

@QueryHandler(ListMyPasskeysQuery)
export class ListMyPasskeysHandler implements IQueryHandler<ListMyPasskeysQuery, PasskeyList> {
	public constructor(@Inject(IDENTITY_READ) private readonly reads: IdentityReadPort) {}

	public async execute(query: ListMyPasskeysQuery): Promise<PasskeyList> {
		return { passkeys: [...(await this.reads.listPasskeys(query.actor, query.input.userId))] };
	}
}
