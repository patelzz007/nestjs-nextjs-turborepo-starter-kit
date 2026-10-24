import type { Prisma } from "@prisma/client";
import { DocumentMimeTypeSchema } from "@workspace/shared";

import type { BindableFile, FileBindingRequest, FileReferencePort, FilesTransactionalPorts } from "../../application/ports/file-binding.port";

class PrismaFileReferencePort implements FileReferencePort {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async lockForBinding(request: FileBindingRequest): Promise<readonly BindableFile[]> {
		if (request.fileIds.length === 0) {
			return [];
		}
		const ids = [...request.fileIds];
		await this.db.$queryRaw`SELECT id FROM "StoredFile" WHERE id = ANY(${ids}::text[]) FOR UPDATE`;
		const rows = await this.db.storedFile.findMany({
			where: {
				id: { in: ids },
				category: request.category,
				isDeleted: false,
				...(request.tenantId === null ? {} : { tenantId: request.tenantId }),
				...(request.uploadedById === null ? {} : { uploadedById: request.uploadedById }),
			},
			select: { id: true, category: true, status: true, tenantId: true, uploadedById: true, originalName: true, mimeType: true },
		});
		const byId = new Map(
			rows.flatMap((row): [string, BindableFile][] => {
				const mimeType = DocumentMimeTypeSchema.safeParse(row.mimeType);
				return mimeType.success ? [[row.id, { ...row, mimeType: mimeType.data }]] : [];
			}),
		);
		return ids.flatMap((id: string): BindableFile[] => {
			const row = byId.get(id);
			return row === undefined ? [] : [row];
		});
	}
}

/**
 * Transactional port factory (§5.4 cross-context scopes): an owner's scope
 * factory calls it with the SAME transaction client, so locking the files and
 * writing the owner's binding rows share one transaction.
 */
export function createFilesTransactionalPorts(db: Prisma.TransactionClient): FilesTransactionalPorts {
	return { fileReferences: new PrismaFileReferencePort(db) };
}
