"use client";

import { useMerchantAuthorizationStatus } from "@/components/access/merchant-authorization-provider";
import { MerchantReadOnlyNotice } from "@/components/access/merchant-capability-gate";
import { StoreLogoSkeleton, MERCHANT_BRANDING_LOADING_LABELS } from "@/components/loading/merchant-page-skeletons";
import { MerchantPageHeader } from "@/components/merchant-ui/page-header";
import { MerchantSurfacePanel } from "@/components/merchant-ui/surface-panel";
import { STORE_LOGO_FILE_RULES, STORE_LOGO_HINT, STORE_LOGO_IMAGE_RULES, useRemoveStoreLogo, useUploadStoreLogo } from "@/lib/org/use-store-logo";
import { useAuth } from "@workspace/client/lib/auth";
import { useAuthorization } from "@workspace/client/lib/auth/can";
import { resolveAuthErrorMessage } from "@workspace/client/lib/auth/errors";
import { ImageCropDialog } from "@workspace/client/lib/storage/image-crop-dialog";
import { ImageSlotField, type ImageSlotFieldLabels } from "@workspace/client/lib/storage/image-slot-field";
import { useImagePick } from "@workspace/client/lib/storage/use-image-pick";
import { MERCHANT_CAPABILITY, type OrganizationContextSummaryResponse } from "@workspace/shared";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { toastMessage } from "@workspace/ui/components/toast";
import { getUserInitials } from "@workspace/ui/lib/core/user-initials";
import * as React from "react";

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
	readonly orgSlug: string;
	readonly organization: OrganizationContextSummaryResponse;
	readonly canManage: boolean;
}

/** The logo with its upload / replace / remove controls and the crop step. */
function StoreLogoPanel({ orgSlug, organization, canManage }: StoreLogoPanelProps): React.JSX.Element {
	const upload = useUploadStoreLogo({
		orgSlug,
		onSuccess: (): void => {
			toastMessage.success({ title: "Logo updated" });
		},
		onError: (error: Error): void => {
			showError("Could not update the logo", error);
		},
	});
	const remove = useRemoveStoreLogo({
		orgSlug,
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
			uploadLogo({ organizationId: organization.id, file });
		},
		[organization.id, uploadLogo],
	);
	const handleRefused = React.useCallback((message: string): void => {
		toastMessage.error({ title: "Could not use this image", description: message });
	}, []);
	const picker = useImagePick({ rules: STORE_LOGO_IMAGE_RULES, onPrepared: handlePrepared, onRefused: handleRefused });

	const handleRemove = React.useCallback((): void => {
		if (organization.logo !== null) {
			removeLogo({ fileId: organization.logo.fileId });
		}
	}, [organization.logo, removeLogo]);

	return (
		<MerchantSurfacePanel className="flex flex-col gap-4 p-5 sm:p-6">
			<div>
				<h2 className="font-medium text-foreground">Logo</h2>
				<p className="mt-1 text-sm text-muted-foreground">Shown with your rewards in Reward Hub. Without one, the initials of your store are shown.</p>
			</div>
			<ImageSlotField
				imageUrl={organization.logo?.url ?? null}
				imageSources={organization.logo?.sources}
				fallback={getUserInitials(organization.displayName)}
				shape="rounded"
				labels={LOGO_LABELS}
				accept={STORE_LOGO_FILE_RULES.accept}
				hint={STORE_LOGO_HINT}
				isBusy={upload.isPending || remove.isPending || picker.isReading}
				isReadOnly={!canManage}
				onPick={picker.pick}
				onRemove={handleRemove}
			/>
			<ImageCropDialog
				source={picker.cropSource}
				rules={STORE_LOGO_IMAGE_RULES}
				title="Crop your logo"
				description={CROP_DESCRIPTION}
				confirmLabel="Use logo"
				cancelLabel="Cancel"
				onCropped={picker.handleCropped}
				onSkip={picker.handleSkip}
			/>
		</MerchantSurfacePanel>
	);
}

export interface OrganizationBrandingPageViewProps {
	readonly orgSlug: string;
}

/**
 * Store branding route — the logo is readable with `merchant:view_locations`;
 * changing it needs `merchant:manage_locations` (the API enforces it on every
 * upload and delete; the controls are only disabled here for convenience).
 */
export function OrganizationBrandingPageView({ orgSlug }: OrganizationBrandingPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const { can } = useAuthorization();
	const canManage = can(MERCHANT_CAPABILITY.manageLocations);
	const { isLoading: isAuthorizationLoading } = useMerchantAuthorizationStatus();
	const contextQuery = api.organizations.context.useQuery({ orgSlug });
	const organization = contextQuery.data?.data.organization;

	return (
		<div className="space-y-8">
			<MerchantPageHeader title="Store branding" description="How your store appears to customers." />

			{canManage || isAuthorizationLoading ? null : <MerchantReadOnlyNotice>Your role can see the store logo but not change it.</MerchantReadOnlyNotice>}

			{contextQuery.isError ? (
				<MerchantSurfacePanel className="border-destructive/30 bg-destructive/5 p-5">
					<p className="font-medium text-foreground">Could not load store branding</p>
					<p className="mt-1 text-sm text-muted-foreground">Verify you have access to this organization workspace.</p>
				</MerchantSurfacePanel>
			) : null}

			{contextQuery.isLoading ? (
				<SkeletonRegion labels={MERCHANT_BRANDING_LOADING_LABELS} className="flex flex-col gap-8">
					<StoreLogoSkeleton />
				</SkeletonRegion>
			) : null}

			{organization !== undefined ? <StoreLogoPanel orgSlug={orgSlug} organization={organization} canManage={canManage} /> : null}
		</div>
	);
}
