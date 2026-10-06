// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "@workspace/client/lib/api/api-request";
import { epochMs, type OwnProfile, type UpdateOwnProfileInput } from "@workspace/shared";
import { toastMessage } from "@workspace/ui/components/toast";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileView, toastAvatarError, UPDATE_PROFILE_ERROR_MESSAGES } from "../profile-view";

interface UpdateOptionsStub {
	readonly onSuccess?: (profile: OwnProfile) => void;
	readonly onError: (error: Error) => void;
}

interface ViewState {
	profile: { readonly data: OwnProfile } | undefined;
	isError: boolean;
	isImpersonating: boolean;
	isPending: boolean;
	readonly mutate: ReturnType<typeof vi.fn<(input: UpdateOwnProfileInput) => void>>;
	readonly options: { current: UpdateOptionsStub | null };
	readonly uploadAvatar: ReturnType<typeof vi.fn<(input: { readonly userId: string; readonly file: File }) => void>>;
	readonly removeAvatar: ReturnType<typeof vi.fn<(input: { readonly fileId: string }) => void>>;
}

const state = vi.hoisted((): ViewState => ({
	profile: undefined,
	isError: false,
	isImpersonating: false,
	isPending: false,
	mutate: vi.fn<(input: UpdateOwnProfileInput) => void>(),
	options: { current: null },
	uploadAvatar: vi.fn<(input: { readonly userId: string; readonly file: File }) => void>(),
	removeAvatar: vi.fn<(input: { readonly fileId: string }) => void>(),
}));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({
		api: { auth: { permissions: { useQuery: (): object => ({ data: { data: { isImpersonating: state.isImpersonating } } }) } } },
	}),
}));

vi.mock("@workspace/client/lib/auth/profile/use-profile-avatar", () => ({
	useUploadProfileAvatar: (): object => ({ mutate: state.uploadAvatar, isPending: false }),
	useRemoveProfileAvatar: (): object => ({ mutate: state.removeAvatar, isPending: false }),
}));

vi.mock("@workspace/client/lib/auth/profile/use-own-profile", () => ({
	useOwnProfile: (): object => ({ data: state.profile, isError: state.isError }),
	useUpdateOwnProfile: (options: UpdateOptionsStub): object => {
		state.options.current = options;
		return { mutate: state.mutate, isPending: state.isPending };
	},
}));

const AVATAR_FILE_ID = "9a1c2e4b-6d8f-4a0b-8c2d-4e6f8a0b2c4d";

const PROFILE: OwnProfile = {
	id: "4f0b7c62-3f7a-4c0e-9d8e-2f6a1b3c5d7e",
	email: "superadmin@example.com",
	fullName: "Super Admin",
	avatar: null,
	version: 3,
	createdAt: epochMs(1_788_000_000_000),
	updatedAt: epochMs(1_788_253_200_000),
};

describe("ProfileView", () => {
	beforeEach(() => {
		state.profile = { data: PROFILE };
		state.isError = false;
		state.isImpersonating = false;
		state.isPending = false;
		state.mutate.mockReset();
		state.uploadAvatar.mockReset();
		state.removeAvatar.mockReset();
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("shows the loading state, then the error state, until the profile is there", () => {
		state.profile = undefined;
		const { rerender } = render(<ProfileView />);
		expect(screen.getByText("Loading profile…")).toBeTruthy();

		state.isError = true;
		rerender(<ProfileView />);
		expect(screen.getByRole("alert").textContent).toBe("Could not load your profile.");
	});

	it("shows the profile's identity", () => {
		render(<ProfileView />);

		expect(screen.getByText("superadmin@example.com")).toBeTruthy();
		expect(screen.getByText("SA")).toBeTruthy();
	});

	it("saves the edit with the version the form was loaded at (optimistic lock)", async () => {
		render(<ProfileView />);

		fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Platform Owner" } });
		fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

		await waitFor(() => {
			expect(state.mutate).toHaveBeenCalledWith({ fullName: "Platform Owner", version: 3 });
		});
	});

	it("toasts the API's failure with the profile-specific message (409, impersonation)", () => {
		const errorToast = vi.spyOn(toastMessage, "error").mockImplementation(() => "toast-id");
		render(<ProfileView />);

		state.options.current?.onError(new ApiError({ message: "changed", error: "CONFLICT", statusCode: 409 }));

		expect(errorToast).toHaveBeenCalledWith({ title: "Could not save your profile", description: UPDATE_PROFILE_ERROR_MESSAGES.CONFLICT });
	});

	it("toasts success with the saved name", () => {
		const successToast = vi.spyOn(toastMessage, "success").mockImplementation(() => "toast-id");
		render(<ProfileView />);

		state.options.current?.onSuccess?.({ ...PROFILE, fullName: "Platform Owner", version: 4 });

		expect(successToast).toHaveBeenCalledWith({ title: "Profile saved", description: "Platform Owner" });
	});

	it("uploads a picked image as the caller's own avatar", () => {
		render(<ProfileView />);
		const image = new File([new Uint8Array(8)], "me.png", { type: "image/png" });

		fireEvent.change(screen.getByLabelText("Avatar image"), { target: { files: [image] } });

		expect(state.uploadAvatar).toHaveBeenCalledWith({ userId: PROFILE.id, file: image });
	});

	it("removes the live avatar by its file id", () => {
		state.profile = { data: { ...PROFILE, avatar: { fileId: AVATAR_FILE_ID, url: "https://cdn.example.com/a.png", updatedAt: epochMs(1_788_253_200_000) } } };
		render(<ProfileView />);

		fireEvent.click(screen.getByRole("button", { name: "Remove" }));

		expect(state.removeAvatar).toHaveBeenCalledWith({ fileId: AVATAR_FILE_ID });
	});

	it("toasts a typed upload failure with its own message, and an API failure through the code map", () => {
		const errorToast = vi.spyOn(toastMessage, "error").mockImplementation(() => "toast-id");

		toastAvatarError("Could not update your avatar", new Error("Object storage could not be reached."));
		toastAvatarError("Could not update your avatar", new ApiError({ message: "Too many", error: "RATE_LIMITED", statusCode: 429 }));

		expect(errorToast).toHaveBeenNthCalledWith(1, { title: "Could not update your avatar", description: "Object storage could not be reached." });
		expect(errorToast).toHaveBeenNthCalledWith(2, { title: "Could not update your avatar", description: "Too many requests. Wait a moment and try again." });
	});

	it("is read-only during impersonation", () => {
		state.isImpersonating = true;
		render(<ProfileView />);

		expect(screen.getByText("You are impersonating this user: the profile is read-only.")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Save changes" }).hasAttribute("disabled")).toBe(true);
		expect(screen.getByRole("button", { name: "Upload avatar" }).hasAttribute("disabled")).toBe(true);
	});
});
