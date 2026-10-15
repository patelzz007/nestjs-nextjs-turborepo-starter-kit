// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ApiError } from "@workspace/client/lib/api/api-request";
import { epochMs, type OwnProfile, type UpdateOwnProfileInput } from "@workspace/shared";
import { toastMessage } from "@workspace/ui/components/toast";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
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
		api: {
			auth: {
				permissions: {
					useQuery: (): object => ({
						data: {
							data: {
								isImpersonating: state.isImpersonating,
								roles: [{ id: "role-1", name: "Super Admin", description: "Full access to the platform." }],
								permissions: [
									{ id: "perm-1", action: "LIST", resource: "USER", description: null, group: "Users" },
									{ id: "perm-2", action: "LIST", resource: "AUDIT_LOG", description: null, group: "Audit" },
									{ id: "perm-3", action: "UPDATE", resource: "USER", description: null, group: "Users" },
								],
							},
						},
					}),
				},
			},
		},
	}),
}));

vi.mock("@workspace/client/lib/auth/profile/use-profile-avatar", () => ({
	useUploadProfileAvatar: (): object => ({ mutate: state.uploadAvatar, isPending: false }),
	useRemoveProfileAvatar: (): object => ({ mutate: state.removeAvatar, isPending: false }),
}));

// A picked photo that already meets the avatar rules goes straight to the upload (the crop step has its own tests).
vi.mock("@workspace/client/lib/storage/use-image-pick", () => ({
	useImagePick: ({ onPrepared }: { readonly onPrepared: (file: File) => void }): object => ({
		pick: onPrepared,
		cropSource: null,
		isReading: false,
		handleCropped: vi.fn(),
		handleSkip: vi.fn(),
	}),
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
		const { container, rerender } = render(<ProfileView />, { wrapper: UiKitTestProviders });
		const status = screen.getByRole("status");
		expect(status.getAttribute("aria-busy")).toBe("true");
		expect(status.textContent).toBe("Loading profile…");
		// Shaped like the personal-details card: the name field's bones, no real form yet.
		expect(container.querySelector('[data-slot="form-skeleton"]')).not.toBeNull();
		expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();

		state.isError = true;
		rerender(<ProfileView />);
		expect(screen.getByRole("alert").textContent).toBe("Could not load your profile.");
		expect(screen.queryByRole("status")).toBeNull();
	});

	it("shows the profile's identity", () => {
		render(<ProfileView />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(screen.getByLabelText("Full name").getAttribute("value"));
		expect(screen.getByText("superadmin@example.com")).toBeTruthy();
		// The initials stand in for the missing picture in the header and in the photo editor.
		expect(screen.getAllByText("SA")).toHaveLength(2);
		expect(within(screen.getByRole("list", { name: "Your roles" })).getByText("Super Admin")).toBeTruthy();
	});

	it("shows what the roles allow: permissions, the areas they cover, and the way to sign-in security", () => {
		render(<ProfileView />, { wrapper: UiKitTestProviders });

		expect(screen.getByText("Full access to the platform.")).toBeTruthy();
		expect(screen.getByText("Permissions").nextElementSibling?.textContent).toBe("3");
		const areas = within(screen.getByRole("list", { name: "Areas you can work in" })).getAllByRole("listitem");
		expect(areas.map((area: HTMLElement): string => area.textContent)).toStrictEqual(["Audit", "Users"]);
		expect(screen.getByRole("link", { name: "Password and two-factor" }).getAttribute("href")).toBe("/account/security");
	});

	it("marks the impersonated session in the header", () => {
		state.isImpersonating = true;
		render(<ProfileView />, { wrapper: UiKitTestProviders });
		expect(within(screen.getByRole("list", { name: "Your roles" })).getByText("Impersonating")).toBeTruthy();
	});

	it("saves the edit with the version the form was loaded at (optimistic lock)", async () => {
		render(<ProfileView />, { wrapper: UiKitTestProviders });

		fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Platform Owner" } });
		fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

		await waitFor(() => {
			expect(state.mutate).toHaveBeenCalledWith({ fullName: "Platform Owner", version: 3 });
		});
	});

	it("toasts the API's failure with the profile-specific message (409, impersonation)", () => {
		const errorToast = vi.spyOn(toastMessage, "error").mockImplementation(() => "toast-id");
		render(<ProfileView />, { wrapper: UiKitTestProviders });

		state.options.current?.onError(new ApiError({ message: "changed", error: "CONFLICT", statusCode: 409 }));

		expect(errorToast).toHaveBeenCalledWith({ title: "Could not save your profile", description: UPDATE_PROFILE_ERROR_MESSAGES.CONFLICT });
	});

	it("toasts success with the saved name", () => {
		const successToast = vi.spyOn(toastMessage, "success").mockImplementation(() => "toast-id");
		render(<ProfileView />, { wrapper: UiKitTestProviders });

		state.options.current?.onSuccess?.({ ...PROFILE, fullName: "Platform Owner", version: 4 });

		expect(successToast).toHaveBeenCalledWith({ title: "Profile saved", description: "Platform Owner" });
	});

	it("uploads a picked image as the caller's own avatar", () => {
		render(<ProfileView />, { wrapper: UiKitTestProviders });
		const image = new File([new Uint8Array(8)], "me.png", { type: "image/png" });

		fireEvent.change(screen.getByLabelText("Profile picture"), { target: { files: [image] } });

		expect(state.uploadAvatar).toHaveBeenCalledWith({ userId: PROFILE.id, file: image });
	});

	it("removes the live avatar by its file id", () => {
		state.profile = { data: { ...PROFILE, avatar: { fileId: AVATAR_FILE_ID, url: "https://cdn.example.com/a.png", sources: [], updatedAt: epochMs(1_788_253_200_000) } } };
		render(<ProfileView />, { wrapper: UiKitTestProviders });

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
		render(<ProfileView />, { wrapper: UiKitTestProviders });

		expect(screen.getByText("You are impersonating this user: the profile is read-only.")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Save changes" }).hasAttribute("disabled")).toBe(true);
		expect(screen.getByRole("button", { name: "Upload photo" }).hasAttribute("disabled")).toBe(true);
	});
});
