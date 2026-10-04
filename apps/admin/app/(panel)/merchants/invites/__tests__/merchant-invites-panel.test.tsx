// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "@workspace/client/lib/api/api-request";
import { CapabilitiesProvider } from "@workspace/client/lib/auth/can";
import { EmailPreviewSchema, PERMISSION, type AdminCreateMerchantInviteInput, type CapabilitySlug, type EmailPreview } from "@workspace/shared";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import MerchantInvitesPage from "../page";
import MerchantInvitesPanel from "../merchant-invites-panel";

interface MutationCallbacks<TResponse> {
	readonly onSuccess?: (response: TResponse) => void;
}

interface MutationOptions {
	readonly onError?: (error: Error) => void;
}

/** The options the panel last passed to a mutation hook. */
interface MutationOptionsHolder {
	current: MutationOptions | undefined;
}

const { previewMutate, createMutate, previewOptions, createOptions } = vi.hoisted(() => {
	const preview: MutationOptionsHolder = { current: undefined };
	const create: MutationOptionsHolder = { current: undefined };
	return { previewMutate: vi.fn(), createMutate: vi.fn(), previewOptions: preview, createOptions: create };
});

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({
		api: {
			rewardsAdmin: {
				previewInviteEmail: {
					useMutation: (options: MutationOptions): object => {
						previewOptions.current = options;
						return { mutate: previewMutate, isPending: false };
					},
				},
				createInvite: {
					useMutation: (options: MutationOptions): object => {
						createOptions.current = options;
						return { mutate: createMutate, isPending: false };
					},
				},
			},
		},
	}),
}));

const PREVIEW: EmailPreview = EmailPreviewSchema.parse({
	key: "merchant-invite",
	label: "Merchant invite",
	description: "Onboarding invite for a new merchant",
	to: "owner@cafe.demo",
	subject: "You're invited",
	previewText: "Join the pilot",
	html: "<p>Hello</p>",
	text: "Hello",
	props: {},
});

function renderPanel(capabilities: readonly CapabilitySlug[] = [PERMISSION.MERCHANT_ORG.MANAGE]): void {
	render(
		<CapabilitiesProvider capabilities={capabilities}>
			<MerchantInvitesPanel />
		</CapabilitiesProvider>,
	);
}

function fillForm(email: string, businessName: string): void {
	fireEvent.change(screen.getByLabelText("Contact email"), { target: { value: email } });
	fireEvent.change(screen.getByLabelText("Business name"), { target: { value: businessName } });
}

beforeEach(() => {
	previewMutate.mockImplementation((_input: AdminCreateMerchantInviteInput, callbacks: MutationCallbacks<{ readonly data: EmailPreview }>) => {
		callbacks.onSuccess?.({ data: PREVIEW });
	});
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
	vi.restoreAllMocks();
});

/** Clicks `element`, then lets the form's async submit (validation + onSubmit) settle. */
async function clickAndSettle(element: HTMLElement): Promise<void> {
	fireEvent.click(element);
	await act(() => Promise.resolve());
}

describe("MerchantInvitesPage", () => {
	it("prefetches nothing, so it never needs EMAIL READ", () => {
		expect(MerchantInvitesPage().type).toBe(MerchantInvitesPanel);
	});
});

describe("MerchantInvitesPanel", () => {
	it("blocks the preview with the shared schema's errors when the form is invalid", async () => {
		renderPanel();
		fillForm("not-an-email", "");
		await clickAndSettle(screen.getByRole("button", { name: "Preview email" }));

		expect(previewMutate).not.toHaveBeenCalled();
		expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
	});

	it("previews with the parsed form values and the first pilot city by default", async () => {
		renderPanel();
		fillForm("owner@cafe.demo", "Sunrise Café");
		await clickAndSettle(screen.getByRole("button", { name: "Preview email" }));

		expect(previewMutate.mock.lastCall?.[0]).toEqual({ email: "owner@cafe.demo", businessName: "Sunrise Café", city: "KUALA_LUMPUR" });
		expect(screen.getByText("Kuala Lumpur")).toBeTruthy();
	});

	it("enables sending only for the exact values that were previewed", async () => {
		renderPanel();
		fillForm("owner@cafe.demo", "Sunrise Café");
		const send = screen.getByRole("button", { name: "Create & send invite" });
		expect(send.hasAttribute("disabled")).toBe(true);

		await clickAndSettle(screen.getByRole("button", { name: "Preview email" }));
		expect(send.hasAttribute("disabled")).toBe(false);

		fireEvent.change(screen.getByLabelText("Business name"), { target: { value: "Another Café" } });
		expect(send.hasAttribute("disabled")).toBe(true);
	});

	it("surfaces a failed send as an error toast with the API reason", () => {
		const errorToast = vi.spyOn(toastMessage, "error").mockImplementation(() => "toast-id");
		renderPanel();
		createOptions.current?.onError?.(new ApiError({ error: "CONFLICT", message: "An open invite already exists for this email", statusCode: 409 }));

		expect(errorToast).toHaveBeenCalledWith({ title: "Invite failed", description: "An open invite already exists for this email" });
	});

	it("links the template browser only for admins with EMAIL READ", async () => {
		renderPanel([PERMISSION.MERCHANT_ORG.MANAGE]);
		expect(screen.queryByRole("link", { name: "Open in Email Templates" })).toBeNull();
		cleanup();

		renderPanel([PERMISSION.MERCHANT_ORG.MANAGE, PERMISSION.EMAIL.READ]);
		await waitFor(() => {
			expect(screen.getByRole("link", { name: "Open in Email Templates" }).getAttribute("href")).toBe("/emails/templates?key=merchant-invite");
		});
	});
});
