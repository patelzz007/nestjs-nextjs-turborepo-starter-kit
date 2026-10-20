import { FileVerdictReached } from "../../../../files/public-api";
import type { DomainEvent } from "../../../../../platform/domain/domain-event";
import type { InTransactionEventHandler } from "../../../../../platform/application/events/in-transaction-event-handler";
import type { UserAvatarFileScope } from "../../ports/user-avatar-bindings.port";

/** A READY avatar becomes its uploader's avatar in the verdict transaction. */
export class BindUserAvatarOnFileVerdict implements InTransactionEventHandler<FileVerdictReached, UserAvatarFileScope> {
	public accepts(event: DomainEvent): event is FileVerdictReached {
		return event instanceof FileVerdictReached && event.outcome === "READY" && event.category === "USER_AVATAR";
	}

	public async handle(event: FileVerdictReached, scope: UserAvatarFileScope): Promise<void> {
		await scope.avatars.bindReadyAvatar(event.uploadedById, event.fileId, event.occurredAt);
	}
}
