import { Query } from "@nestjs/cqrs";
import type { PasskeyList } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface ListMyPasskeysInput {
	readonly userId: string;
}

/** The signed-in user's live passkeys, newest first. */
export class ListMyPasskeysQuery extends Query<PasskeyList> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: ListMyPasskeysInput,
	) {
		super();
	}
}
