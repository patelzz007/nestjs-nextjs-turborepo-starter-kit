// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { UiKitLanguageProvider } from "@workspace/ui/components/ui-kit-labels-provider";
import { PLATFORM_UI_KIT_LANGUAGE } from "@workspace/client/lib/i18n/ui-kit-language";
import { epochMs, GITHUB_NEW_TOKEN_URL, type Envelope, type GithubAccountStatus, type LinkGithubAccountInput } from "@workspace/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GithubTokenPanel } from "../github-token-panel";

const VALID_TOKEN = "github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz";

interface LinkOptions {
	readonly onSuccess: () => Promise<void>;
}

const { account, link, unlink, toastSuccess } = vi.hoisted(() => {
	const current: { current: GithubAccountStatus } = { current: { status: "unlinked" } };
	return {
		account: current,
		link: vi.fn<(input: LinkGithubAccountInput) => void>(),
		unlink: vi.fn<() => Promise<object>>(),
		toastSuccess: vi.fn<(message: { readonly title: string }) => void>(),
	};
});

vi.mock("@workspace/ui/components/toast", () => ({ toastMessage: { success: toastSuccess, error: vi.fn() } }));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		api: {
			githubPullRequests: {
				account: { useQuery: (): object => ({ data: { success: true, data: account.current }, isError: false, error: null }) },
				linkAccount: {
					useMutation: (): object => ({
						mutate: (input: LinkGithubAccountInput, options: LinkOptions): void => {
							link(input);
							void options.onSuccess();
						},
						isPending: false,
					}),
				},
				unlinkAccount: { useMutation: (): object => ({ mutateAsync: unlink, isPending: false }) },
			},
		},
	}),
}));

const LINKED: GithubAccountStatus = {
	status: "linked",
	login: "octocat",
	avatarUrl: null,
	health: "active",
	linkedAt: epochMs(1_786_300_000_000),
	tokenExpiresAt: null,
};

function renderPanel(initialAccount?: Envelope<GithubAccountStatus>): void {
	render(
		<UiKitLanguageProvider language={PLATFORM_UI_KIT_LANGUAGE}>
			<QueryClientProvider client={new QueryClient()}>
				<GithubTokenPanel initialAccount={initialAccount} />
			</QueryClientProvider>
		</UiKitLanguageProvider>,
	);
}

beforeEach(() => {
	account.current = { status: "unlinked" };
	unlink.mockResolvedValue({});
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("GithubTokenPanel", () => {
	it("says pull requests are off and offers no token field when the server has none set up", () => {
		account.current = { status: "off" };
		renderPanel();

		expect(screen.getByText("Pull requests are not set up on this server.")).toBeTruthy();
		expect(screen.queryByLabelText("Personal access token")).toBeNull();
	});

	it("lists the token's permissions and links to GitHub's token page", () => {
		renderPanel();

		expect(screen.getByText("Not linked")).toBeTruthy();
		expect(screen.getByText("Pull requests: Read and write")).toBeTruthy();
		expect(screen.getByRole("link", { name: "Create a token on GitHub" }).getAttribute("href")).toBe(GITHUB_NEW_TOKEN_URL);
		expect(screen.getByLabelText("Personal access token").getAttribute("type")).toBe("password");
	});

	it("refuses a token that is not fine-grained, in the shared schema's words, without calling the API", async () => {
		renderPanel();
		const field = screen.getByLabelText("Personal access token");

		fireEvent.change(field, { target: { value: "ghp_classic_token_value" } });
		fireEvent.blur(field);
		fireEvent.click(screen.getByRole("button", { name: "Link token" }));

		expect(await screen.findByText(/must be a fine-grained personal access token/)).toBeTruthy();
		expect(link).not.toHaveBeenCalled();
	});

	it("links a fine-grained token, clears the field and says so", async () => {
		renderPanel();
		const field = screen.getByLabelText("Personal access token");

		fireEvent.change(field, { target: { value: `  ${VALID_TOKEN}  ` } });
		fireEvent.click(screen.getByRole("button", { name: "Link token" }));

		await waitFor(() => {
			expect(link).toHaveBeenCalledWith({ personalAccessToken: VALID_TOKEN });
		});
		await waitFor(() => {
			expect(toastSuccess).toHaveBeenCalledWith({ title: "GitHub token linked." });
		});
		expect(screen.getByLabelText<HTMLInputElement>("Personal access token").value).toBe("");
	});

	it("shows the linked account, offers a replacement, and removes the token after confirmation", async () => {
		account.current = LINKED;
		renderPanel();

		expect(screen.getByText("octocat")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Replace token" })).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Remove token" }));
		const dialog = await screen.findByRole("alertdialog");
		expect(within(dialog).getByText("Remove your GitHub token?")).toBeTruthy();
		const [confirm] = within(dialog)
			.getAllByRole("button")
			.filter((button) => button.textContent !== "Cancel");
		expect(confirm).toBeDefined();
		if (confirm !== undefined) {
			fireEvent.click(confirm);
		}

		await waitFor(() => {
			expect(unlink).toHaveBeenCalledTimes(1);
		});
		await waitFor(() => {
			expect(toastSuccess).toHaveBeenCalledWith({ title: "GitHub token removed." });
		});
	});

	it("marks a token GitHub rejected as needing a new one", () => {
		account.current = { ...LINKED, health: "rejected" };
		renderPanel();

		expect(screen.getByText("Needs a new token")).toBeTruthy();
		expect(screen.getByText("GitHub no longer accepts the token of octocat. Link a new one to continue.")).toBeTruthy();
	});
});
