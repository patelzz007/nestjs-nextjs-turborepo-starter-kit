import type { Prisma } from "@prisma/client";

import type { PublicUrlResolve } from "../../../../config/public-url.resolver";
import { IMAGE_RENDITIONS_SELECT, toImageSources, type FileReferencePort } from "../../../files/public-api";
import type { BroadcastImageFilesPort, BroadcastImageOwner } from "../../application/ports/broadcast-image-files.port";
import { ValidationError } from "../../../../platform/application/errors/app-error";

/** The pictures of broadcast bodies over Prisma: locked through the files context, addressed by their renditions. */
export class PrismaBroadcastImageFiles implements BroadcastImageFilesPort {
	public constructor(
		private readonly db: Prisma.TransactionClient,
		private readonly files: FileReferencePort,
		private readonly resolve: PublicUrlResolve,
	) {}

	public async lockUsable(owner: BroadcastImageOwner, fileIds: readonly string[]): Promise<void> {
		if (fileIds.length === 0) {
			return;
		}
		const locked = await this.files.lockForBinding(
			owner.kind === "tenant"
				? { category: "BROADCAST_IMAGE", tenantId: owner.tenantId, uploadedById: null, fileIds }
				: { category: "PLATFORM_BROADCAST_IMAGE", tenantId: null, uploadedById: null, fileIds },
		);
		const ready = new Set(locked.filter((file) => file.status === "READY").map((file) => file.id));
		const refused = fileIds.filter((fileId) => !ready.has(fileId));
		if (refused.length > 0) {
			throw new ValidationError({
				message: "A picture in the message isn't one of this sender's uploaded images, or isn't ready yet. Upload it again.",
				details: { fileIds: refused },
			});
		}
	}

	public async sources(fileIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
		if (fileIds.length === 0) {
			return new Map();
		}
		const files = await this.db.storedFile.findMany({
			where: { id: { in: [...fileIds] }, isDeleted: false, status: "READY", category: { in: ["BROADCAST_IMAGE", "PLATFORM_BROADCAST_IMAGE"] } },
			select: { id: true, publicPath: true, variants: IMAGE_RENDITIONS_SELECT },
		});
		return new Map(
			files.flatMap((file): [string, string][] => {
				// The largest rendition when the category makes them; otherwise the file's own public copy.
				const url = toImageSources(file.variants, this.resolve).at(-1)?.url ?? this.resolve(file.publicPath);
				return url === null ? [] : [[file.id, url]];
			}),
		);
	}
}
