import { buildCleanObjectPath, buildQuarantineObjectPath } from "../../storage/utils/storage-path.util";

const KYB_STORAGE_NAMESPACE = "kyb";

export function buildKybQuarantinePath(organizationId: string, submissionId: string, fileName: string): string {
	return buildQuarantineObjectPath(KYB_STORAGE_NAMESPACE, organizationId, submissionId, fileName);
}

export function buildKybCleanPath(organizationId: string, submissionId: string, fileName: string): string {
	return buildCleanObjectPath(KYB_STORAGE_NAMESPACE, organizationId, submissionId, fileName);
}
