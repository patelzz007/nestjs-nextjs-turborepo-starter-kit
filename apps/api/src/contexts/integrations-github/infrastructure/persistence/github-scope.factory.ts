import type { Prisma } from "@prisma/client";

import type { ScopeFactory } from "../../../../platform/application/events/in-transaction-event-handler";
import type { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import type { GithubScope } from "../../application/github-scope";
import { PrismaGithubAccountLinkRepository } from "./prisma-github-account-link.repository";

/** Builds integrations-github repositories bound to the unit-of-work transaction. Never cached. */
export class GithubScopeFactory implements ScopeFactory<GithubScope, Prisma.TransactionClient> {
	public create(db: Prisma.TransactionClient, events: TransactionalEventCollector): GithubScope {
		return { accountLinks: new PrismaGithubAccountLinkRepository(db), events };
	}
}
