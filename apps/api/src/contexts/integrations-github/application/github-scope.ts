import type { TransactionalEventCollector } from "../../../platform/application/events/transactional-event-collector";
import type { GithubAccountLinkRepository } from "./ports/github-account-link.port";

/** Everything one integrations-github transaction can touch. Repositories are bound to that transaction. */
export interface GithubScope {
	readonly accountLinks: GithubAccountLinkRepository;
	readonly events: TransactionalEventCollector;
}
