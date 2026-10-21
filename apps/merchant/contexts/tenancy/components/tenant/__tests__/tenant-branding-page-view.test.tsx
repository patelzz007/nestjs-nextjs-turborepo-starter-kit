// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { ApiError } from "@workspace/client/lib/api/api-request";
import type { UseImagePickOptions } from "@workspace/client/lib/storage/use-image-pick";
import { TenantContextResponseSchema, type TenantContextResponse, type MembershipRole } from "@workspace/shared";
import { toastMessage } from "@workspace/ui/components/toast";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TenantBrandingPageView } from "@/contexts/tenancy/components/tenant/tenant-branding-page-view";
import type { StoreLogoUploadInput, UseStoreLogoOptions } from "@/contexts/tenancy/lib/tenant/use-store-logo";
import { renderWithAuthorization, TEST_ORG_SLUG } from "@/test/authorization";
import { testEnvelope } from "@/test/envelope";
import { tenantContextFixture } from "@/test/tenant-context";

const LOGO_FILE_ID = "4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a7b";
const LOGO_URL = `https://cdn.example.com/stores/logo/${LOGO_FILE_ID}.webp`;

interface ViewState {
	context: TenantContextResponse | undefined;
	isError: boolean;
	upload: UseStoreLogoOptions | null;
	remove: UseStoreLogoOptions | null;
	pick: UseImagePickOptions | null;
}

const { state, uploadLogo, removeLogo } = vi.hoisted(() => {
	const initial: ViewState = { context: undefined, isError: false, upload: null, remove: null, pick: null };
	return { state: initial, uploadLogo: vi.fn<(input: StoreLogoUploadInput) => void>(), removeLogo: vi.fn<(input: { readonly fileId: string }) => void>() };
});

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		api: {
			tenants: {
				context: {
					useQuery: (): object => ({
						data: state.context === undefined ? undefined : testEnvelope(state.context),
						isLoading: state.context === undefined && !state.isError,
						isError: state.isError,
					}),
				},
			},
		},
	}),
}));

vi.mock("@/contexts/tenancy/lib/tenant/use-store-logo", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/contexts/tenancy/lib/tenant/use-store-logo")>();
	return {
		...actual,
		useUploadStoreLogo: (options: UseStoreLogoOptions): object => {
			state.upload = options;
			return { mutate: uploadLogo, isPending: false };
		},
		useRemoveStoreLogo: (options: UseStoreLogoOptions): object => {
			state.remove = options;
			return { mutate: removeLogo, isPending: false };
		},
	};
});

// A picked image that already meets the logo rules goes straight to the upload (the crop step has its own tests).
vi.mock("@workspace/client/lib/storage/use-image-pick", () => ({
	useImagePick: (options: UseImagePickOptions): object => {
		state.pick = options;
		return { pick: options.onPrepared, cropSource: null, isReading: false, handleCropped: vi.fn(), handleSkip: vi.fn() };
	},
}));

function contextWithLogo(logo: TenantContextResponse["tenant"]["logo"]): TenantContextResponse {
	const context = tenantContextFixture({ locations: [] });
	return TenantContextResponseSchema.parse({ ...context, tenant: { ...context.tenant, logo } });
}

function renderAs(role: MembershipRole): void {
	renderWithAuthorization(<TenantBrandingPageView tenantSlug={TEST_ORG_SLUG} />, { role });
}

beforeEach((): void => {
	state.context = contextWithLogo(null);
	state.isError = false;
	uploadLogo.mockReset();
	removeLogo.mockReset();
});

afterEach((): void => {
	cleanup();
	vi.restoreAllMocks();
});

describe("TenantBrandingPageView", () => {
	it("shows the store's initials until it has a logo, and uploads a picked logo for the tenant", () => {
		renderAs("OWNER");
		expect(screen.getByText("AC")).toBeTruthy();
		const logo = new File([new Uint8Array(8)], "logo.png", { type: "image/png" });

		fireEvent.change(screen.getByLabelText("Store logo"), { target: { files: [logo] } });

		expect(uploadLogo).toHaveBeenCalledWith({ file: logo });
		expect(state.pick?.rules).toMatchObject({ aspectWidth: 1, aspectHeight: 1, minWidth: 256 });
		expect(state.upload?.tenantSlug).toBe(TEST_ORG_SLUG);
	});

	it("replaces or removes the live logo by its file id", () => {
		state.context = contextWithLogo({ fileId: LOGO_FILE_ID, url: LOGO_URL, sources: [{ width: 128, url: LOGO_URL }] });
		renderAs("OWNER");

		expect(screen.getByRole("button", { name: "Replace logo" })).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Remove" }));

		expect(removeLogo).toHaveBeenCalledWith({ fileId: LOGO_FILE_ID });
	});

	it("lets a member without merchant:manage_locations see the logo but not change it", () => {
		state.context = contextWithLogo({ fileId: LOGO_FILE_ID, url: LOGO_URL, sources: [{ width: 128, url: LOGO_URL }] });
		renderAs("CASHIER");

		expect(screen.getByText("Your role can see the store logo but not change it.")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Replace logo" }).hasAttribute("disabled")).toBe(true);
		expect(screen.getByRole("button", { name: "Remove" }).hasAttribute("disabled")).toBe(true);
	});

	it("shows a loading state, then a load failure", () => {
		state.context = undefined;
		const view = renderWithAuthorization(<TenantBrandingPageView tenantSlug={TEST_ORG_SLUG} />, { role: "OWNER" });
		expect(screen.getByRole("status")).toBeTruthy();

		state.isError = true;
		view.rerender(<TenantBrandingPageView tenantSlug={TEST_ORG_SLUG} />);

		expect(screen.getByText("Could not load store branding")).toBeTruthy();
		expect(screen.queryByLabelText("Store logo")).toBeNull();
	});

	it("toasts each outcome, with failures in words for the merchant", () => {
		const success = vi.spyOn(toastMessage, "success").mockImplementation(() => "toast-id");
		const failure = vi.spyOn(toastMessage, "error").mockImplementation(() => "toast-id");
		renderAs("OWNER");

		state.upload?.onSuccess();
		state.remove?.onSuccess();
		state.pick?.onRefused("Images must be at least 256 × 256 pixels so they stay sharp on every screen.");
		state.upload?.onError(new ApiError({ message: "Your tenant role cannot change store branding", error: "FORBIDDEN", statusCode: 403 }));

		expect(success.mock.calls).toEqual([[{ title: "Logo updated" }], [{ title: "Logo removed" }]]);
		expect(failure).toHaveBeenNthCalledWith(1, {
			title: "Could not use this image",
			description: "Images must be at least 256 × 256 pixels so they stay sharp on every screen.",
		});
		expect(failure).toHaveBeenNthCalledWith(2, { title: "Could not update the logo", description: "Your tenant role cannot change store branding" });
	});
});
