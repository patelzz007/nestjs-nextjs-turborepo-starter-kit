// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CapabilitiesProvider } from "@workspace/client/lib/auth/can";
import {
	EmailPreviewListResponseSchema,
	epochMs,
	EmailPreviewSchema,
	EmailTemplateKeySchema,
	PERMISSION,
	type CapabilitySlug,
	type EmailPreview,
	type EmailPreviewListResponse,
	type Envelope,
} from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import EmailPreviewView from "../email-templates";

interface AuthStub {
	readonly api: {
		readonly email: {
			readonly previewList: { readonly useQuery: () => { readonly data: { readonly data: EmailPreviewListResponse }; readonly isLoading: boolean; readonly error: null } };
			readonly previewDetail: {
				readonly useQuery: (input: { readonly key: string }) => { readonly data: { readonly data: EmailPreview }; readonly isLoading: boolean; readonly isPending: boolean };
				readonly usePrefetch: () => (input: { readonly key: string }) => void;
			};
			readonly previewSend: { readonly useMutation: () => { readonly isPending: boolean } };
		};
	};
}

/** The template whose preview the query currently holds — `undefined` echoes the requested one (already loaded). */
interface LoadedKeyHolder {
	current: string | undefined;
}

const { LIST, PREVIEW, previewDetailQuery, prefetchDetail, loadedKey } = vi.hoisted(() => {
	const holder: LoadedKeyHolder = { current: undefined };
	return {
		previewDetailQuery: vi.fn(),
		prefetchDetail: vi.fn<(input: { readonly key: string }) => void>(),
		loadedKey: holder,
		LIST: {
			templates: [
				{ key: "verification", label: "Verify email", description: "Account verification", sampleTo: "user@example.com", sampleSubject: "Your subject" },
				{ key: "welcome", label: "Welcome", description: "Sent after sign-up", sampleTo: "user@example.com", sampleSubject: "Your subject" },
			],
		},
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
	};
});

// The view reads `?key=` from the address bar, as Next.js's `useSearchParams`
// does once the History API integration has synced it.
vi.mock("next/navigation", () => ({
	useSearchParams: (): URLSearchParams => new URLSearchParams(window.location.search),
}));

vi.mock("@workspace/client/lib/auth", () => {
	const list = EmailPreviewListResponseSchema.parse(LIST);
	const preview = EmailPreviewSchema.parse(PREVIEW);
	const auth: AuthStub = {
		api: {
			email: {
				previewList: { useQuery: () => ({ data: { data: list }, isLoading: false, error: null }) },
				previewDetail: {
					useQuery: (input: { readonly key: string }) => {
						previewDetailQuery(input);
						const key = EmailTemplateKeySchema.parse(loadedKey.current ?? input.key);
						return { data: { data: { ...preview, key, label: `${key} label` } }, isLoading: false, isPending: false };
					},
					usePrefetch: () => prefetchDetail,
				},
				previewSend: { useMutation: () => ({ isPending: false }) },
			},
		},
	};
	return { useAuth: (): AuthStub => auth };
});

const PATH = "/emails/templates";

/** The prefetched list as the API returns it — a fixed, real-shaped meta. */
const LIST_ENVELOPE: Envelope<EmailPreviewListResponse> = {
	success: true,
	data: EmailPreviewListResponseSchema.parse(LIST),
	meta: { correlationId: "test-correlation", timestamp: epochMs(1_786_300_000_000) },
};

function view(capabilities: readonly CapabilitySlug[]): React.JSX.Element {
	return (
		<CapabilitiesProvider capabilities={capabilities}>
			<EmailPreviewView initialList={LIST_ENVELOPE} />
		</CapabilitiesProvider>
	);
}

function renderView(capabilities: readonly CapabilitySlug[]): ReturnType<typeof render> {
	return render(view(capabilities));
}

beforeEach(() => {
	window.history.replaceState(null, "", PATH);
});

afterEach(() => {
	cleanup();
	previewDetailQuery.mockReset();
	prefetchDetail.mockReset();
	loadedKey.current = undefined;
	vi.restoreAllMocks();
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
		expect(button.getAttribute("aria-disabled")).toBe("true");
		expect(screen.getByText("Sending test emails requires the email create permission.")).toBeDefined();
	});
});

describe("Email templates selection (?key= is the only source)", () => {
	it("previews the first template when the URL selects none", () => {
		renderView([PERMISSION.EMAIL.READ]);
		expect(previewDetailQuery).toHaveBeenLastCalledWith({ key: "verification" });
	});

	it("previews the template named by ?key= and ignores an unknown key", () => {
		window.history.replaceState(null, "", `${PATH}?key=welcome`);
		const first = renderView([PERMISSION.EMAIL.READ]);
		expect(previewDetailQuery).toHaveBeenLastCalledWith({ key: "welcome" });
		first.unmount();

		window.history.replaceState(null, "", `${PATH}?key=not-a-template`);
		renderView([PERMISSION.EMAIL.READ]);
		expect(previewDetailQuery).toHaveBeenLastCalledWith({ key: "verification" });
	});

	it("writes the selection back to the URL as a history entry", () => {
		const pushState = vi.spyOn(window.history, "pushState");
		const rendered = renderView([PERMISSION.EMAIL.READ]);
		fireEvent.click(screen.getByRole("button", { name: /Welcome/ }));
		expect(pushState).toHaveBeenCalledTimes(1);
		expect(window.location.search).toBe("?key=welcome");
		rendered.rerender(view([PERMISSION.EMAIL.READ]));
		expect(previewDetailQuery).toHaveBeenLastCalledWith({ key: "welcome" });
	});

	it("follows the URL on back/forward", () => {
		window.history.replaceState(null, "", `${PATH}?key=welcome`);
		const rendered = renderView([PERMISSION.EMAIL.READ]);
		window.history.replaceState(null, "", PATH);
		rendered.rerender(view([PERMISSION.EMAIL.READ]));
		expect(previewDetailQuery).toHaveBeenLastCalledWith({ key: "verification" });
	});
});

describe("Email templates index", () => {
	it("shows each template's full description under its name", () => {
		renderView([PERMISSION.EMAIL.READ]);
		const row = screen.getByRole("button", { name: /Welcome/ });

		expect(row.textContent).toContain("Sent after sign-up");
		expect(row.className).toContain("whitespace-normal");
		expect(row.innerHTML).not.toContain("line-clamp");
	});

	it("warms a template's preview when the pointer or keyboard focus reaches its row", () => {
		renderView([PERMISSION.EMAIL.READ]);
		const row = screen.getByRole("button", { name: /Welcome/ });

		fireEvent.pointerEnter(row);
		fireEvent.focus(row);

		expect(prefetchDetail).toHaveBeenCalledTimes(2);
		expect(prefetchDetail).toHaveBeenLastCalledWith({ key: "welcome" });
	});
});

describe("Email templates preview while switching", () => {
	it("keeps the current email on screen while the next one renders, and switches the header at once", () => {
		window.history.replaceState(null, "", `${PATH}?key=welcome`);
		loadedKey.current = "verification";
		renderView([PERMISSION.EMAIL.READ]);

		expect(screen.getByTitle("verification label preview")).toBeTruthy();
		expect(screen.getByText("Rendering…")).toBeTruthy();
		expect(screen.getByText("Welcome", { selector: "[data-slot=card-title]" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Copy" }).hasAttribute("disabled")).toBe(true);
	});

	it("shows the selected email, with no loading state, once it has rendered", () => {
		window.history.replaceState(null, "", `${PATH}?key=welcome`);
		renderView([PERMISSION.EMAIL.READ]);

		expect(screen.getByTitle("welcome label preview")).toBeTruthy();
		expect(screen.queryByText("Rendering…")).toBeNull();
	});
});
