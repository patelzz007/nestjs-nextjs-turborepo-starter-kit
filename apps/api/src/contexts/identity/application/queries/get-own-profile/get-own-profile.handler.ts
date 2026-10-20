import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { OwnProfile } from "@workspace/shared";

import { ProfileNotFoundError } from "../../../domain/errors/identity.errors";
import type { IdentityReadPort } from "../../ports/identity-read.port";
import { IDENTITY_READ } from "../../ports/identity.tokens";
import { GetOwnProfileQuery } from "./get-own-profile.query";

@QueryHandler(GetOwnProfileQuery)
export class GetOwnProfileHandler implements IQueryHandler<GetOwnProfileQuery, OwnProfile> {
	public constructor(@Inject(IDENTITY_READ) private readonly reads: IdentityReadPort) {}

	public async execute(query: GetOwnProfileQuery): Promise<OwnProfile> {
		const profile: OwnProfile | null = await this.reads.findOwnProfile(query.actor, query.input.userId);
		if (profile === null) {
			throw new ProfileNotFoundError(query.input.userId);
		}
		return profile;
	}
}
