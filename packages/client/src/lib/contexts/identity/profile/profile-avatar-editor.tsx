"use client";

import type { OwnProfile } from "@workspace/shared";
import { getUserInitials } from "@workspace/ui/lib/core/user-initials";
import * as React from "react";

import ImageCropDialogClientOnly from "../../../storage/image-crop-dialog.client-only";
import { ImageSlotField, type ImageSlotFieldLabels } from "../../../storage/image-slot-field";
import { useImagePick } from "../../../storage/use-image-pick";
import { AVATAR_ACCEPT, AVATAR_HINT, AVATAR_IMAGE_RULES } from "./profile-avatar";
import { useRemoveProfileAvatar, useUploadProfileAvatar } from "./use-profile-avatar";

const LABELS: ImageSlotFieldLabels = {
	input: "Profile picture",
	image: "Your profile picture",
	upload: "Upload photo",
	replace: "Replace photo",
	remove: "Remove",
	busy: "Working…",
};

const CROP_DESCRIPTION =
	"Your profile picture is square and shown in a circle. Drag the photo or use the sliders to choose what shows. Zoom all the way out to show the whole photo, with a soft blur of it filling the space around it.";

export interface ProfileAvatarEditorProps {
	readonly profile: Pick<OwnProfile, "id" | "fullName" | "avatar">;
	/** No changes (an impersonation session): the picture shows, the controls are disabled. */
	readonly isReadOnly: boolean;
	/** A change went through — the app shows `title` (a toast). */
	readonly onSuccess: (title: string) => void;
	/** A change failed — the app shows `title` with the error (its own API-code messages first). */
	readonly onError: (title: string, error: Error) => void;
}

/**
 * The signed-in person's own profile picture, the same in every app: pick a
 * photo, crop any that is not square (zoomed all the way out it keeps the
 * whole photo), upload it through the file pipeline, or remove it. Smart: it
 * owns the crop session and the mutations; the app owns how outcomes are shown.
 */
export function ProfileAvatarEditor({ profile, isReadOnly, onSuccess, onError }: ProfileAvatarEditorProps): React.JSX.Element {
	const upload = useUploadProfileAvatar({
		onSuccess: (): void => {
			onSuccess("Profile picture updated");
		},
		onError: (error: Error): void => {
			onError("Could not update your profile picture", error);
		},
	});
	const remove = useRemoveProfileAvatar({
		onSuccess: (): void => {
			onSuccess("Profile picture removed");
		},
		onError: (error: Error): void => {
			onError("Could not remove your profile picture", error);
		},
	});
	const { mutate: uploadAvatar } = upload;
	const { mutate: removeAvatar } = remove;

	const handlePrepared = React.useCallback(
		(file: File): void => {
			uploadAvatar({ userId: profile.id, file });
		},
		[profile.id, uploadAvatar],
	);
	const handleRefused = React.useCallback(
		(message: string): void => {
			onError("Could not use this photo", new Error(message));
		},
		[onError],
	);
	const picker = useImagePick({ rules: AVATAR_IMAGE_RULES, onPrepared: handlePrepared, onRefused: handleRefused });

	const handleRemove = React.useCallback((): void => {
		if (profile.avatar !== null) {
			removeAvatar({ fileId: profile.avatar.fileId });
		}
	}, [profile.avatar, removeAvatar]);

	return (
		<>
			<ImageSlotField
				imageUrl={profile.avatar?.url ?? null}
				imageSources={profile.avatar?.sources}
				fallback={getUserInitials(profile.fullName)}
				shape="circle"
				labels={LABELS}
				accept={AVATAR_ACCEPT}
				hint={AVATAR_HINT}
				isBusy={upload.isPending || remove.isPending || picker.isReading}
				isReadOnly={isReadOnly}
				onPick={picker.pick}
				onRemove={handleRemove}
			/>
			<ImageCropDialogClientOnly
				source={picker.cropSource}
				rules={AVATAR_IMAGE_RULES}
				title="Crop your profile picture"
				description={CROP_DESCRIPTION}
				confirmLabel="Use photo"
				cancelLabel="Cancel"
				onCropped={picker.handleCropped}
				onSkip={picker.handleSkip}
			/>
		</>
	);
}
