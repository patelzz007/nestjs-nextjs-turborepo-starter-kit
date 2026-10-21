"use client";

import { useMerchantAuthorizationStatus } from "@/contexts/tenancy/components/access/merchant-authorization-provider";
import { MerchantReadOnlyNotice } from "@/contexts/tenancy/components/access/merchant-capability-gate";
import { StoreLogoSkeleton, MERCHANT_BRANDING_LOADING_LABELS } from "@/components/loading/merchant-page-skeletons";
import { MerchantPageHeader } from "@/components/merchant-ui/page-header";
import { STORE_LOGO_FILE_RULES, STORE_LOGO_HINT, STORE_LOGO_IMAGE_RULES, useRemoveStoreLogo, useUploadStoreLogo } from "@/contexts/tenancy/lib/tenant/use-store-logo";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { useAuthorization } from "@workspace/client/lib/contexts/authorization";
import { resolveAuthErrorMessage } from "@workspace/client/lib/api/error-messages";
import ImageCropDialogClientOnly from "@workspace/client/lib/storage/image-crop-dialog.client-only";
import { ImageSlotField, type ImageSlotFieldLabels } from "@workspace/client/lib/storage/image-slot-field";
import { useImagePick } from "@workspace/client/lib/storage/use-image-pick";
import { MERCHANT_CAPABILITY, type TenantContextSummaryResponse } from "@workspace/shared";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { toastMessage } from "@workspace/ui/components/toast";
import { getUserInitials } from "@workspace/ui/lib/core/user-initials";
import { Card } from "@workspace/ui/components/card";
import * as React from "react";
import { BRAND_NAME } from "@workspace/tokens";

const LOGO_LABELS: ImageSlotFieldLabels = {
	input: "Store logo",
	image: "Your store logo",
	upload: "Upload logo",
	replace: "Replace logo",
	remove: "Remove",
	busy: "Working…",
};

const CROP_DESCRIPTION =
	"Your logo is square. Drag the image or use the sliders to choose what shows. Zoom all the way out to keep a wide logo whole, with a soft blur of it filling the space around it.";

function showError(title: string, error: Error): void {
	toastMessage.error({ title, description: resolveAuthErrorMessage(error) });
}

interface StoreLogoPanelProps {
	readonly tenantSlug: string;
	readonly tenant: TenantContextSummaryResponse;
	readonly canManage: boolean;
}

/** The logo with its upload / replace / remove controls and the crop step. */
function StoreLogoPanel({ tenantSlug, tenant, canManage }: StoreLogoPanelProps): React.JSX.Element {
	const upload = useUploadStoreLogo({
		tenantSlug,
		onSuccess: (): void => {
			toastMessage.success({ title: "Logo updated" });
		},
		onError: (error: Error): void => {
			showError("Could not update the logo", error);
		},
	});
	const remove = useRemoveStoreLogo({
		tenantSlug,
		onSuccess: (): void => {
			toastMessage.success({ title: "Logo removed" });
		},
		onError: (error: Error): void => {
			showError("Could not remove the logo", error);
		},
	});
	const { mutate: uploadLogo } = upload;
	const { mutate: removeLogo } = remove;

	const handlePrepared = React.useCallback(
		(file: File): void => {
			uploadLogo({ file });
		},
		[uploadLogo],
	);
	const handleRefused = React.useCallback((message: string): void => {
		toastMessage.error({ title: "Could not use this image", description: message });
	}, []);
	const picker = useImagePick({ rules: STORE_LOGO_IMAGE_RULES, onPrepared: handlePrepared, onRefused: handleRefused });

	const handleRemove = React.useCallback((): void => {
		if (tenant.logo !== null) {
			removeLogo({ fileId: tenant.logo.fileId });
		}
	}, [tenant.logo, removeLogo]);

	return (
		<Card className="gap-4 p-5 sm:p-6">
			<div>
				<h2 className="font-medium text-foreground">Logo</h2>
				<p className="mt-1 text-sm text-muted-foreground">Shown with your rewards in {BRAND_NAME}. Without one, the initials of your store are shown.</p>
			</div>
			<ImageSlotField
				imageUrl={tenant.logo?.url ?? null}
				imageSources={tenant.logo?.sources}
				fallback={getUserInitials(tenant.displayName)}
				shape="rounded"
				labels={LOGO_LABELS}
				accept={STORE_LOGO_FILE_RULES.accept}
				hint={STORE_LOGO_HINT}
				isBusy={upload.isPending || remove.isPending || picker.isReading}
				isReadOnly={!canManage}
				onPick={picker.pick}
				onRemove={handleRemove}
			/>
			<ImageCropDialogClientOnly
				source={picker.cropSource}
				rules={STORE_LOGO_IMAGE_RULES}
				title="Crop your logo"
				description={CROP_DESCRIPTION}
				confirmLabel="Use logo"
				cancelLabel="Cancel"
				onCropped={picker.handleCropped}
				onSkip={picker.handleSkip}
			/>
		</Card>
	);
}

export interface TenantBrandingPageViewProps {
	readonly tenantSlug: string;
}

/**
 * Store branding route — the logo is readable with `merchant:view_locations`;
 * changing it needs `merchant:manage_locations` (the API enforces it on every
 * upload and delete; the controls are only disabled here for convenience).
 */
export function TenantBrandingPageView({ tenantSlug }: TenantBrandingPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const { can } = useAuthorization();
	const canManage = can(MERCHANT_CAPABILITY.manageLocations);
	const { isLoading: isAuthorizationLoading } = useMerchantAuthorizationStatus();
	const contextQuery = api.tenants.context.useQuery({ tenantSlug });
	const tenant = contextQuery.data?.data.tenant;

	return (
		<div className="space-y-8">
			<MerchantPageHeader title="Store branding" description="How your store appears to customers." />

			{canManage || isAuthorizationLoading ? null : <MerchantReadOnlyNotice>Your role can see the store logo but not change it.</MerchantReadOnlyNotice>}

			{contextQuery.isError ? (
				<Card className="gap-0 bg-destructive/5 p-5 ring-destructive/30">
					<p className="font-medium text-foreground">Could not load store branding</p>
					<p className="mt-1 text-sm text-muted-foreground">Verify you have access to this tenant workspace.</p>
				</Card>
			) : null}

			{contextQuery.isLoading ? (
				<SkeletonRegion labels={MERCHANT_BRANDING_LOADING_LABELS} className="flex flex-col gap-8">
					<StoreLogoSkeleton />
				</SkeletonRegion>
			) : null}

			{tenant !== undefined ? <StoreLogoPanel tenantSlug={tenantSlug} tenant={tenant} canManage={canManage} /> : null}
		</div>
	);
}
