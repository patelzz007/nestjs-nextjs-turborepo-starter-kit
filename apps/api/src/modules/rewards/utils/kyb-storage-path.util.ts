import { buildCleanObjectPath, buildQuarantineObjectPath } from "../../storage/utils/storage-path.util";

const KYB_STORAGE_NAMESPACE = "kyb";

export function buildKybQuarantinePath(merchantOrgId: string, submissionId: string, fileName: string): string {
	return buildQuarantineObjectPath(KYB_STORAGE_NAMESPACE, merchantOrgId, submissionId, fileName);
}

export function buildKybCleanPath(merchantOrgId: string, submissionId: string, fileName: string): string {
	return buildCleanObjectPath(KYB_STORAGE_NAMESPACE, merchantOrgId, submissionId, fileName);
}
