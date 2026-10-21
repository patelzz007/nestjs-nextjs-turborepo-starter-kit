// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ImpersonationBannerBar } from "../impersonation-banner-bar";

/** What the mocked hook was given and answers with. */
interface ImpersonationStub {
	isPending: boolean;
	onIdentityChanged: (() => void) | null;
}

const { stop, refresh, impersonation } = vi.hoisted(() => {
	const stub: ImpersonationStub = { isPending: false, onIdentityChanged: null };
	return { stop: vi.fn<() => void>(), refresh: vi.fn<() => void>(), impersonation: stub };
});

vi.mock("next/navigation", () => ({ useRouter: (): { readonly refresh: typeof refresh } => ({ refresh }) }));

vi.mock("../../session/use-impersonation", () => ({
	useImpersonation: (options: { readonly onIdentityChanged: () => void }): { readonly stop: typeof stop; readonly isPending: boolean } => {
		impersonation.onIdentityChanged = options.onIdentityChanged;
		return { stop, isPending: impersonation.isPending };
	},
}));

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
	impersonation.isPending = false;
});

describe("ImpersonationBannerBar", () => {
	it("shows the app's message and links, and stops impersonating on click", () => {
		render(<ImpersonationBannerBar message="Actions run as the impersonated account." links={<a href="/elsewhere">Merchant portal</a>} />);

		expect(screen.getByText("Actions run as the impersonated account.")).toBeTruthy();
		expect(screen.getByRole("link", { name: "Merchant portal" })).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Stop impersonation" }));
		expect(stop).toHaveBeenCalledTimes(1);
	});

	it("refreshes the server-rendered page once the identity is back", () => {
		render(<ImpersonationBannerBar message="Impersonating" />);

		impersonation.onIdentityChanged?.();
		expect(refresh).toHaveBeenCalledTimes(1);
	});

	it("locks the button while stopping", () => {
		impersonation.isPending = true;
		render(<ImpersonationBannerBar message="Impersonating" />);

		expect(screen.getByRole("button", { name: "Stopping…" })).toHaveProperty("disabled", true);
	});
});
