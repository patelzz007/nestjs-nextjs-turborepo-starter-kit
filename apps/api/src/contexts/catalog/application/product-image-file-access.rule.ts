import type { FileUploadRequest, FileCategory } from "@workspace/shared";

import type { AuthorizationKernelPort } from "../../authorization/public-api";
import { fileForbidden, uploaderOnly, type FileAccessAction, type FileAccessSubject, type FileActor, type FileCategoryAccessRule } from "../../files/public-api";

/** The one kernel call the rule makes: the audited decision, throwing a 403 on DENY. */
export type KernelAuthorizeCheck = Pick<AuthorizationKernelPort, "authorize">;

/** PRODUCT_IMAGE: upload needs `PRODUCT:UPDATE` on that product (authorization kernel); afterwards only the uploader. */
export class ProductImageFileAccessRule implements FileCategoryAccessRule {
	public readonly categories: readonly FileCategory[] = ["PRODUCT_IMAGE"];

	public constructor(private readonly kernel: KernelAuthorizeCheck) {}

	public async assertCanUpload(actor: FileActor, request: FileUploadRequest): Promise<void> {
		if (request.productId === undefined) {
			throw fileForbidden("upload", "A product is required for product images");
		}
		await this.kernel.authorize({ subject: { userId: actor.userId, isSuperAdmin: false }, action: "UPDATE", resource: "PRODUCT", resourceId: request.productId });
	}

	public assertCanAct(actor: FileActor, file: FileAccessSubject, action: FileAccessAction): Promise<void> {
		return uploaderOnly(actor, file, action);
	}
}
