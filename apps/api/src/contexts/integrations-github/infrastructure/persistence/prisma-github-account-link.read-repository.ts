import type { Prisma } from "@prisma/client";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { PrismaReadExecutor } from "../../../../platform/infrastructure/unit-of-work/prisma-read-executor";
import type { GithubAccountLinkReadPort, GithubAccountLinkRecord } from "../../application/ports/github-account-link.port";
import { findLiveGithubAccountLink } from "./prisma-github-account-link.repository";

/** Reads the caller's own link under their RLS session (`app_owns(user_id)`). */
export class PrismaGithubAccountLinkReadRepository implements GithubAccountLinkReadPort {
	public constructor(private readonly reads: PrismaReadExecutor<Prisma.TransactionClient>) {}

	public findLive(actor: ActorContext, userId: string): Promise<GithubAccountLinkRecord | null> {
		return this.reads.read(actor, (db: Prisma.TransactionClient): Promise<GithubAccountLinkRecord | null> => findLiveGithubAccountLink(db, userId));
	}
}
