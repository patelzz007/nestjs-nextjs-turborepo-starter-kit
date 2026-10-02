// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { CapabilitiesProvider } from "@workspace/client/lib/auth/can";
import { EmailPreviewListResponseSchema, EmailPreviewSchema, PERMISSION, type CapabilitySlug, type EmailPreview, type EmailPreviewListResponse } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { successEnvelope, stubApiMeta } from "@workspace/client/lib/api/envelope";

import EmailPreviewView from "../email-templates";

interface AuthStub {
	readonly api: {
		readonly email: {
			readonly previewList: { readonly useQuery: () => { readonly data: { readonly data: EmailPreviewListResponse }; readonly isLoading: boolean; readonly error: null } };
			readonly previewDetail: { readonly useQuery: () => { readonly data: { readonly data: EmailPreview }; readonly isLoading: boolean; readonly isPending: boolean } };
			readonly previewSend: { readonly useMutation: () => { readonly isPending: boolean } };
		};
	};
}

const { LIST, PREVIEW } = vi.hoisted(() => ({
	LIST: { templates: [{ key: "verification", label: "Verify email", description: "Account verification", sampleTo: "user@example.com" }] },
	PREVIEW: {
		key: "verification",
		label: "Verify email",
		description: "Account verification",
		subject: "Verify your email",
		to: "user@example.com",
		previewText: "Confirm your address",
		html: "<p>Hello</p>",
		text: "Hello",
		props: {},
	},
}));

vi.mock("@workspace/client/lib/auth", () => {
	const list = EmailPreviewListResponseSchema.parse(LIST);
	const preview = EmailPreviewSchema.parse(PREVIEW);
	const auth: AuthStub = {
		api: {
			email: {
				previewList: { useQuery: () => ({ data: { data: list }, isLoading: false, error: null }) },
				previewDetail: { useQuery: () => ({ data: { data: preview }, isLoading: false, isPending: false }) },
				previewSend: { useMutation: () => ({ isPending: false }) },
			},
		},
	};
	return { useAuth: (): AuthStub => auth };
});

function renderView(capabilities: readonly CapabilitySlug[]): void {
	render(
		<CapabilitiesProvider capabilities={capabilities}>
			<EmailPreviewView initialList={successEnvelope(EmailPreviewListResponseSchema.parse(LIST), stubApiMeta())} />
		</CapabilitiesProvider>,
	);
}

afterEach(() => {
	cleanup();
});

describe("Email templates authorization", () => {
	it("enables Send test email with EMAIL create", () => {
		renderView([PERMISSION.EMAIL.READ, PERMISSION.EMAIL.CREATE]);
		const button = screen.getByRole("button", { name: "Send test email" });
		expect(button.hasAttribute("disabled")).toBe(false);
	});

	it("shows Send test email disabled with a reason for read-only sessions", () => {
		renderView([PERMISSION.EMAIL.READ]);
		const button = screen.getByRole("button", { name: "Send test email" });
		expect(button.hasAttribute("disabled")).toBe(true);
		expect(screen.getByText("Sending test emails requires the email create permission.")).toBeDefined();
	});
});
