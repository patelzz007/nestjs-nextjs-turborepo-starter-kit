"use client";

import { useAbility } from "@workspace/client/lib/contexts/authorization";
import { MerchantKybVerificationView } from "@workspace/client/lib/contexts/tenancy/kyb/verification-view";
import * as React from "react";

export interface MerchantKybVerificationEditorProps {
	readonly tenantSlug: string;
}

/**
 * The business verification for a member who may see it (`merchant:view_verification`, kyb.read): editable with
 * `merchant:manage_verification` (kyb.update, the Owner's by default), read-only otherwise. The API decides every call.
 */
export function MerchantKybVerificationEditor({ tenantSlug }: MerchantKybVerificationEditorProps): React.JSX.Element {
	const canEdit = useAbility().can("UPDATE", "KYB");
	return <MerchantKybVerificationView tenantSlug={tenantSlug} canEdit={canEdit} />;
}
