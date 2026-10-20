import { FileDeleted } from "../../../../files/public-api";
import type { DomainEvent } from "../../../../../platform/domain/domain-event";
import type { InTransactionEventHandler } from "../../../../../platform/application/events/in-transaction-event-handler";
import type { UserAvatarFileScope } from "../../ports/user-avatar-bindings.port";

/** A deleted avatar file stops being anyone's avatar, in the deletion transaction. */
export class ReleaseUserAvatarOnFileDeleted implements InTransactionEventHandler<FileDeleted, UserAvatarFileScope> {
	public accepts(event: DomainEvent): event is FileDeleted {
		return event instanceof FileDeleted && event.category === "USER_AVATAR";
	}

	public async handle(event: FileDeleted, scope: UserAvatarFileScope): Promise<void> {
		await scope.avatars.releaseFile(event.fileId, event.deletedBy, event.occurredAt);
	}
}
