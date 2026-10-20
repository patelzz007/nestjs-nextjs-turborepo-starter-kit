// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { epochMs, type ImageRules } from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ImagePick, UseImagePickOptions } from "../../../../storage/use-image-pick";
import { ProfileAvatarEditor } from "../profile-avatar-editor";
import type { UseProfileAvatarOptions } from "../use-profile-avatar";

const USER_ID = "7f5f0f0e-7a53-4f5c-9d0a-0d6a6b8f2c11";
const FILE_ID = "4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a7b";

/** The options the editor last passed to each hook — so a test can play the hook's part. */
interface CapturedOptions {
	upload: UseProfileAvatarOptions | null;
	remove: UseProfileAvatarOptions | null;
	pick: UseImagePickOptions | null;
}

const { uploadMutate, removeMutate, captured, pick } = vi.hoisted(() => {
	const options: CapturedOptions = { upload: null, remove: null, pick: null };
	return { uploadMutate: vi.fn(), removeMutate: vi.fn(), captured: options, pick: vi.fn<(file: File) => void>() };
});

vi.mock("../use-profile-avatar", () => ({
	useUploadProfileAvatar: (options: UseProfileAvatarOptions): object => {
		captured.upload = options;
		return { mutate: uploadMutate, isPending: false };
	},
	useRemoveProfileAvatar: (options: UseProfileAvatarOptions): object => {
		captured.remove = options;
		return { mutate: removeMutate, isPending: false };
	},
}));

vi.mock("../../../../storage/use-image-pick", () => ({
	useImagePick: (options: UseImagePickOptions): ImagePick => {
		captured.pick = options;
		return { pick, cropSource: null, isReading: false, handleCropped: vi.fn(), handleSkip: vi.fn() };
	},
}));

interface Outcomes {
	readonly onSuccess: ReturnType<typeof vi.fn<(title: string) => void>>;
	readonly onError: ReturnType<typeof vi.fn<(title: string, error: Error) => void>>;
}

function renderEditor(avatar: { readonly fileId: string; readonly url: string } | null, isReadOnly = false): Outcomes {
	const onSuccess = vi.fn<(title: string) => void>();
	const onError = vi.fn<(title: string, error: Error) => void>();
	render(
		<ProfileAvatarEditor
			profile={{ id: USER_ID, fullName: "Rina Usman", avatar: avatar === null ? null : { ...avatar, sources: [], updatedAt: epochMs(1_790_000_000_000) } }}
			isReadOnly={isReadOnly}
			onSuccess={onSuccess}
			onError={onError}
		/>,
		{ wrapper: UiKitTestProviders },
	);
	return { onSuccess, onError };
}

beforeEach((): void => {
	uploadMutate.mockReset();
	removeMutate.mockReset();
	pick.mockReset();
});

afterEach((): void => {
	cleanup();
});

describe("ProfileAvatarEditor", () => {
	it("crops a picked photo to the square avatar rules before anything is uploaded", () => {
		renderEditor(null);
		const photo = new File([new Uint8Array(4)], "me.jpg", { type: "image/jpeg" });

		fireEvent.change(screen.getByLabelText("Profile picture"), { target: { files: [photo] } });

		expect(pick).toHaveBeenCalledWith(photo);
		const rules: ImageRules | undefined = captured.pick?.rules;
		expect(rules).toMatchObject({ aspectWidth: 1, aspectHeight: 1, minWidth: 256 });
		expect(uploadMutate).not.toHaveBeenCalled();
	});

	it("uploads the prepared photo as the person's own avatar", () => {
		renderEditor(null);
		const prepared = new File([new Uint8Array(4)], "me.webp", { type: "image/webp" });

		captured.pick?.onPrepared(prepared);

		expect(uploadMutate).toHaveBeenCalledWith({ userId: USER_ID, file: prepared });
	});

	it("reports a photo that cannot be used", () => {
		const { onError } = renderEditor(null);

		captured.pick?.onRefused("Images must be at least 256 × 256 pixels so they stay sharp on every screen.");

		expect(onError).toHaveBeenCalledWith("Could not use this photo", new Error("Images must be at least 256 × 256 pixels so they stay sharp on every screen."));
	});

	it("removes the live avatar by its file id", () => {
		renderEditor({ fileId: FILE_ID, url: "https://cdn.example.com/me.webp" });

		fireEvent.click(screen.getByRole("button", { name: "Remove" }));

		expect(removeMutate).toHaveBeenCalledWith({ fileId: FILE_ID });
	});

	it("reports each outcome with its own title", () => {
		const { onSuccess, onError } = renderEditor(null);
		const failure = new Error("The upload failed.");

		captured.upload?.onSuccess?.();
		captured.remove?.onSuccess?.();
		captured.upload?.onError(failure);
		captured.remove?.onError(failure);

		expect(onSuccess.mock.calls).toEqual([["Profile picture updated"], ["Profile picture removed"]]);
		expect(onError.mock.calls).toEqual([
			["Could not update your profile picture", failure],
			["Could not remove your profile picture", failure],
		]);
	});

	it("shows the initials and disables the controls while read-only", () => {
		renderEditor(null, true);

		expect(screen.getByText("RU")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Upload photo" }).hasAttribute("disabled")).toBe(true);
	});
});
