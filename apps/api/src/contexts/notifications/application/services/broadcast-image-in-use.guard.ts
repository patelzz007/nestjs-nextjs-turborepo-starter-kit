import type { FileCategory } from "@workspace/shared";

import type { FileDeletionScope, FileReferenceBlock, FileReferenceGuard, FileReferenceSubject } from "../../../files/public-api";
import type { BroadcastImageUseScope } from "../ports/broadcast-image-uses.port";

/**
 * A picture a broadcast still names is refused deletion (enhancement 5.4). The guard runs after the file row is
 * locked, and broadcast saves lock it too, so a save and a delete never interleave. `Broadcast` is bypass-only,
 * so the deletion runs as the allowlisted `files.delete` operation.
 */
export class BroadcastImageInUseGuard implements FileReferenceGuard<BroadcastImageUseScope> {
	public readonly categories: readonly FileCategory[] = ["BROADCAST_IMAGE", "PLATFORM_BROADCAST_IMAGE"];
	public readonly deletionScope: FileDeletionScope = "system-operation";

	public async blockDelete(subject: FileReferenceSubject, scope: BroadcastImageUseScope): Promise<FileReferenceBlock | null> {
		return (await scope.broadcastImageUses.countLiveUses(subject.fileId)) > 0 ? "BROADCAST_IMAGE" : null;
	}
}
