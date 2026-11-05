// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import {
	epochMs,
	type CompletePasskeyRegistrationInput,
	type Envelope,
	type Passkey,
	type PasskeyList,
	type PasskeyMessageResponse,
	type PasskeyPath,
	type PasskeyRegistrationOptionsResponse,
	type PasskeyRegistrationResponse,
	type RenamePasskeyInput,
	type StartPasskeyRegistrationInput,
} from "@workspace/shared";
import type { JSX, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { envelopeFixture } from "../../../../../test/auth-fixtures";
import { ClientTestProviders } from "../../../../../testing/client-test-providers";
import { PasskeysSection } from "../passkeys-section";

const mocks = vi.hoisted(() => ({
	list: vi.fn<() => Envelope<PasskeyList> | undefined>(),
	registrationOptions: vi.fn<(input: StartPasskeyRegistrationInput) => Promise<Envelope<PasskeyRegistrationOptionsResponse>>>(),
	registration: vi.fn<(input: CompletePasskeyRegistrationInput) => Promise<Envelope<Passkey>>>(),
	rename: vi.fn<(input: RenamePasskeyInput) => Promise<Envelope<Passkey>>>(),
	remove: vi.fn<(input: PasskeyPath) => Promise<Envelope<PasskeyMessageResponse>>>(),
	browserSupportsWebAuthn: vi.fn<() => boolean>(),
	startRegistration: vi.fn<() => Promise<PasskeyRegistrationResponse>>(),
}));

vi.mock("@simplewebauthn/browser", async (importOriginal) => ({
	...(await importOriginal<typeof import("@simplewebauthn/browser")>()),
	browserSupportsWebAuthn: mocks.browserSupportsWebAuthn,
	startRegistration: mocks.startRegistration,
}));

vi.mock("../../index", () => {
	const mutation = <TMutate,>(
		mutateAsync: TMutate,
	): { readonly useMutation: () => { readonly mutateAsync: TMutate; readonly isPending: boolean; readonly error: null; readonly reset: () => void } } => ({
		useMutation: () => ({ mutateAsync, isPending: false, error: null, reset: (): void => undefined }),
	});
	const api = {
		auth: {
			passkeys: {
				useQuery: (): { readonly data: Envelope<PasskeyList> | undefined; readonly isPending: boolean; readonly isError: boolean; readonly error: null } => ({
					data: mocks.list(),
					isPending: false,
					isError: false,
					error: null,
				}),
			},
			passkeyRegistrationOptions: mutation(mocks.registrationOptions),
			passkeyRegistration: mutation(mocks.registration),
			renamePasskey: mutation(mocks.rename),
			removePasskey: mutation(mocks.remove),
		},
	};
	return { useAuth: (): { readonly api: typeof api } => ({ api }) };
});

const PHONE: Passkey = {
	id: "019b76da-a810-7000-8000-0000000000a1",
	name: "Pixel 9",
	deviceType: "MULTI_DEVICE",
	backedUp: true,
	transports: ["hybrid", "internal"],
	createdAt: epochMs(1_786_000_000_000),
	lastUsedAt: null,
};
const KEY: Passkey = { ...PHONE, id: "019b76da-a810-7000-8000-0000000000b2", name: "YubiKey", deviceType: "SINGLE_DEVICE", backedUp: false, transports: ["usb"] };
const CHALLENGE_ID = "019b76da-a810-7000-8000-00000000c0de";
const CREDENTIAL: PasskeyRegistrationResponse = {
	id: "Y3JlZA",
	rawId: "Y3JlZA",
	response: { clientDataJSON: "Y2xpZW50", attestationObject: "YXR0" },
	clientExtensionResults: {},
	type: "public-key",
};

let queryClient: QueryClient;

function Providers({ children }: { readonly children: ReactNode }): JSX.Element {
	return (
		<QueryClientProvider client={queryClient}>
			<ClientTestProviders>{children}</ClientTestProviders>
		</QueryClientProvider>
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	queryClient = new QueryClient();
	mocks.browserSupportsWebAuthn.mockReturnValue(true);
	mocks.list.mockReturnValue(envelopeFixture({ passkeys: [PHONE, KEY] }));
});

afterEach(() => {
	cleanup();
});

describe("PasskeysSection", () => {
	it("lists each passkey with how it is kept", () => {
		render(<PasskeysSection />, { wrapper: Providers });

		const list = screen.getByRole("list", { name: "Your passkeys" });
		expect(within(list).getByText("Pixel 9")).toBeDefined();
		expect(within(list).getByText("Synced")).toBeDefined();
		expect(within(list).getByText("YubiKey")).toBeDefined();
		expect(within(list).getByText("This device only")).toBeDefined();
		expect(within(list).getAllByText("Not used yet")).toHaveLength(2);
	});

	it("says there are none yet", () => {
		mocks.list.mockReturnValue(envelopeFixture({ passkeys: [] }));
		render(<PasskeysSection />, { wrapper: Providers });

		expect(screen.getByText("No passkeys yet. Add one to sign in without typing a code.")).toBeDefined();
	});

	it("adds a passkey: the password, the device's credential with the challenge it answers, then reloads the list", async () => {
		mocks.registrationOptions.mockResolvedValue(
			envelopeFixture<PasskeyRegistrationOptionsResponse>({
				challengeId: CHALLENGE_ID,
				options: {
					rp: { name: "Starter" },
					user: { id: "dXNlcg", name: "a@example.com", displayName: "A" },
					challenge: "Y2hhbGxlbmdl",
					pubKeyCredParams: [{ type: "public-key", alg: -7 }],
				},
			}),
		);
		mocks.startRegistration.mockResolvedValue(CREDENTIAL);
		mocks.registration.mockResolvedValue(envelopeFixture(PHONE));
		const invalidate = vi.spyOn(queryClient, "invalidateQueries");
		render(<PasskeysSection />, { wrapper: Providers });

		fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Work laptop" } });
		fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Secret@123" } });
		fireEvent.click(screen.getByRole("button", { name: "Add passkey" }));

		await waitFor((): void => {
			expect(mocks.registration).toHaveBeenCalledWith({ challengeId: CHALLENGE_ID, name: "Work laptop", response: CREDENTIAL });
		});
		expect(mocks.registrationOptions).toHaveBeenCalledWith({ password: "Secret@123" });
		await waitFor((): void => {
			expect(invalidate).toHaveBeenCalledWith({ queryKey: ["auth", "passkeys"] });
		});
	});

	it("adds nothing when the person closes the device's prompt, and says so", async () => {
		mocks.registrationOptions.mockResolvedValue(
			envelopeFixture<PasskeyRegistrationOptionsResponse>({
				challengeId: CHALLENGE_ID,
				options: {
					rp: { name: "Starter" },
					user: { id: "dXNlcg", name: "a@example.com", displayName: "A" },
					challenge: "Y2hhbGxlbmdl",
					pubKeyCredParams: [{ type: "public-key", alg: -7 }],
				},
			}),
		);
		// A browser's DOMException is an Error named NotAllowedError; jsdom's DOMException does not extend Error.
		mocks.startRegistration.mockRejectedValue(Object.assign(new Error("not allowed"), { name: "NotAllowedError" }));
		render(<PasskeysSection />, { wrapper: Providers });

		fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Secret@123" } });
		fireEvent.click(screen.getByRole("button", { name: "Add passkey" }));

		expect(await screen.findByText("The passkey prompt was closed before it finished. Try again when you're ready.")).toBeDefined();
		expect(mocks.registration).not.toHaveBeenCalled();
	});

	it("explains that this browser can't add one, and still lists them", () => {
		mocks.browserSupportsWebAuthn.mockReturnValue(false);
		render(<PasskeysSection />, { wrapper: Providers });

		expect(screen.getByText("This browser doesn't support passkeys.")).toBeDefined();
		expect(screen.queryByRole("button", { name: "Add passkey" })).toBeNull();
		expect(screen.getByText("Pixel 9")).toBeDefined();
	});

	it("renames a passkey", async () => {
		mocks.rename.mockResolvedValue(envelopeFixture({ ...PHONE, name: "Phone" }));
		render(<PasskeysSection />, { wrapper: Providers });

		const [renamePhone] = screen.getAllByRole("button", { name: "Rename" });
		if (renamePhone === undefined) {
			throw new Error("no Rename button");
		}
		fireEvent.click(renamePhone);
		fireEvent.change(screen.getByDisplayValue("Pixel 9"), { target: { value: "Phone" } });
		fireEvent.click(screen.getByRole("button", { name: "Save" }));

		await waitFor((): void => {
			expect(mocks.rename).toHaveBeenCalledWith({ passkeyId: PHONE.id, name: "Phone" });
		});
	});

	it("removes a passkey only after the person confirms", async () => {
		mocks.remove.mockResolvedValue(envelopeFixture({ message: "Passkey removed" }));
		render(<PasskeysSection />, { wrapper: Providers });

		fireEvent.click(screen.getByRole("button", { name: "Remove passkey YubiKey" }));
		expect(mocks.remove).not.toHaveBeenCalled();
		const dialog = await screen.findByRole("alertdialog");
		fireEvent.click(within(dialog).getByRole("button", { name: "Remove passkey" }));

		await waitFor((): void => {
			expect(mocks.remove).toHaveBeenCalledWith({ passkeyId: KEY.id });
		});
	});
});
