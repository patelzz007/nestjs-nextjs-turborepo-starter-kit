// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ProfileAvatarEditorProps } from "@workspace/client/lib/auth/profile/profile-avatar-editor";
import { ApiError } from "@workspace/client/lib/api/api-request";
import { epochMs, type OwnProfile } from "@workspace/shared";
import { toastMessage } from "@workspace/ui/components/toast";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProfilePictureSection } from "@/components/rewardhub/shared/profile-picture-section";

interface SectionState {
	sessionScope: "full" | "restricted" | "pending";
	profile: { readonly data: OwnProfile } | undefined;
	isError: boolean;
	isImpersonating: boolean;
	editor: ProfileAvatarEditorProps | null;
}

const state = vi.hoisted((): SectionState => ({ sessionScope: "full", profile: undefined, isError: false, isImpersonating: false, editor: null }));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({
		user: { sessionScope: state.sessionScope },
		api: { auth: { permissions: { useQuery: (): object => ({ data: { data: { isImpersonating: state.isImpersonating } } }) } } },
	}),
}));

const { useOwnProfile } = vi.hoisted(() => ({ useOwnProfile: vi.fn() }));

vi.mock("@workspace/client/lib/auth/profile/use-own-profile", () => ({ useOwnProfile }));

// The editor (crop, upload, remove) has its own tests; here it shows what it was given.
vi.mock("@workspace/client/lib/auth/profile/profile-avatar-editor", () => ({
	ProfileAvatarEditor: (props: ProfileAvatarEditorProps): React.JSX.Element => {
		state.editor = props;
		return <p>Editing the picture of {props.profile.fullName}</p>;
	},
}));

const PROFILE: OwnProfile = {
	id: "4f0b7c62-3f7a-4c0e-9d8e-2f6a1b3c5d7e",
	email: "ali@example.com",
	fullName: "Ali Hassan",
	avatar: null,
	version: 1,
	createdAt: epochMs(1_788_000_000_000),
	updatedAt: epochMs(1_788_000_000_000),
};

beforeEach((): void => {
	state.sessionScope = "full";
	useOwnProfile.mockReset();
	useOwnProfile.mockImplementation((): object => ({ data: state.profile, isError: state.isError }));
	state.profile = undefined;
	state.isError = false;
	state.isImpersonating = false;
	state.editor = null;
});

afterEach((): void => {
	cleanup();
	vi.restoreAllMocks();
});

describe("ProfilePictureSection", () => {
	it("holds the picture's place while the profile loads, then shows the editor for it", () => {
		const { rerender } = render(<ProfilePictureSection />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("heading", { name: "Profile picture" })).toBeTruthy();
		expect(screen.queryByText(/Editing the picture/)).toBeNull();

		state.profile = { data: PROFILE };
		rerender(<ProfilePictureSection />);

		expect(screen.getByText("Editing the picture of Ali Hassan")).toBeTruthy();
		expect(state.editor?.isReadOnly).toBe(false);
	});

	it("says when the profile could not be loaded", () => {
		state.isError = true;
		render(<ProfilePictureSection />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("alert").textContent).toBe("Could not load your profile picture. Reload the page to try again.");
	});

	it("is read-only while an admin impersonates the account", () => {
		state.profile = { data: PROFILE };
		state.isImpersonating = true;
		render(<ProfilePictureSection />, { wrapper: UiKitTestProviders });

		expect(screen.getByText("You are impersonating this user: the profile picture is read-only.")).toBeTruthy();
		expect(state.editor?.isReadOnly).toBe(true);
	});

	it("toasts each outcome, with the failure in words for the member", () => {
		state.profile = { data: PROFILE };
		const success = vi.spyOn(toastMessage, "success").mockImplementation(() => "toast-id");
		const failure = vi.spyOn(toastMessage, "error").mockImplementation(() => "toast-id");
		render(<ProfilePictureSection />, { wrapper: UiKitTestProviders });

		state.editor?.onSuccess("Profile picture updated");
		state.editor?.onError("Could not use this photo", new Error("Images must be 1:1 (square)."));
		state.editor?.onError("Could not update your profile picture", new ApiError({ message: "The file is too large", error: "FILE_TOO_LARGE", statusCode: 400 }));

		expect(success).toHaveBeenCalledWith({ title: "Profile picture updated" });
		expect(failure).toHaveBeenNthCalledWith(1, { title: "Could not use this photo", description: "Images must be 1:1 (square)." });
		expect(failure).toHaveBeenNthCalledWith(2, { title: "Could not update your profile picture", description: "The file is too large" });
	});

	it("tells a restricted session to finish securing the account first, without asking for the profile", () => {
		state.sessionScope = "restricted";
		render(<ProfilePictureSection />, { wrapper: UiKitTestProviders });

		expect(screen.getByText("You can set your profile picture once you have finished securing your account below.")).toBeTruthy();
		expect(useOwnProfile).not.toHaveBeenCalled();
	});

	it("holds the picture's place, without asking for the profile, until the session's scope is known", () => {
		state.sessionScope = "pending";
		render(<ProfilePictureSection />, { wrapper: UiKitTestProviders });

		expect(document.querySelector('[data-slot="profile-picture-skeleton"]')).not.toBeNull();
		expect(useOwnProfile).not.toHaveBeenCalled();
	});
});
