// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
	BACKUP_CODE_CHARSET,
	BACKUP_CODE_COUNT,
	TwoFactorSetupResponseSchema,
	type BackupCodesRemainingResponse,
	type EnableTwoFactorInput,
	type Envelope,
	type StartTwoFactorSetupInput,
	type TwoFactorMessageResponse,
	type TwoFactorSetupResponse,
	type UserResponse,
} from "@workspace/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { envelopeFixture, userFixture } from "../../../test/auth-fixtures";
import { ApiError } from "../../api/use-api";
import { SecuritySettingsPanel } from "./security-settings-panel";

interface QueryStub<Data> {
	readonly data: Data | undefined;
	readonly refetch: () => Promise<void>;
}

const mocks = vi.hoisted(() => ({
	twoFactorSetup: vi.fn<(input: StartTwoFactorSetupInput) => Promise<Envelope<TwoFactorSetupResponse>>>(),
	/** Records any attempt to READ the setup as a query — setup must only ever be a POST mutation. */
	twoFactorSetupQuery: vi.fn<() => { readonly data: Envelope<TwoFactorSetupResponse> | undefined }>(),
	twoFactorEnable: vi.fn<(input: EnableTwoFactorInput) => Promise<Envelope<TwoFactorMessageResponse>>>(),
	refetchRemaining: vi.fn<() => Promise<void>>(),
	noop: vi.fn<() => Promise<void>>(),
	meData: vi.fn<() => Envelope<UserResponse> | undefined>(),
}));

vi.mock("../index", () => {
	const idleMutation = (): { readonly mutateAsync: typeof mocks.noop; readonly isPending: boolean } => ({ mutateAsync: mocks.noop, isPending: false });
	const api = {
		auth: {
			me: { useQuery: (): QueryStub<Envelope<UserResponse>> => ({ data: mocks.meData(), refetch: mocks.noop }) },
			mfaRecoveryStatus: { useQuery: (): QueryStub<Envelope<BackupCodesRemainingResponse>> => ({ data: undefined, refetch: mocks.noop }) },
			mfaRecoveryInitiate: { useMutation: idleMutation },
			resendVerification: { useMutation: idleMutation },
			changePassword: { useMutation: idleMutation },
			twoFactorSetup: {
				useMutation: (): { readonly mutateAsync: typeof mocks.twoFactorSetup; readonly isPending: boolean } => ({ mutateAsync: mocks.twoFactorSetup, isPending: false }),
				useQuery: mocks.twoFactorSetupQuery,
			},
			twoFactorEnable: {
				useMutation: (): { readonly mutateAsync: typeof mocks.twoFactorEnable; readonly isPending: boolean } => ({ mutateAsync: mocks.twoFactorEnable, isPending: false }),
			},
			twoFactorRotate: { useMutation: idleMutation },
			twoFactorBackupCodesRemaining: {
				useQuery: (): QueryStub<Envelope<BackupCodesRemainingResponse>> => ({ data: undefined, refetch: mocks.refetchRemaining }),
			},
		},
	};
	return {
		useAuth: (): { readonly user: null; readonly api: typeof api } => ({ user: null, api }),
	};
});

/** A valid setup answer: ten distinct 16-character codes from the shared alphabet. */
function setupResponseFixture(): TwoFactorSetupResponse {
	return TwoFactorSetupResponseSchema.parse({
		secret: "JBSWY3DPEHPK3PXP",
		qrCodeDataUrl: "data:image/png;base64,iVBORw0KGgo=",
		backupCodes: Array.from({ length: BACKUP_CODE_COUNT }, (_, index): string => `ABCDEFGH2345678${BACKUP_CODE_CHARSET.charAt(index)}`),
	});
}

const SETUP_BUTTON = "Set up authenticator app";
const SAVED_CODES_LABEL = "I saved my backup codes in a secure place";

async function startSetup(): Promise<TwoFactorSetupResponse> {
	const setup = setupResponseFixture();
	mocks.twoFactorSetup.mockResolvedValue(envelopeFixture(setup));
	render(<SecuritySettingsPanel />);
	fireEvent.click(screen.getByRole("button", { name: SETUP_BUTTON }));
	await screen.findByRole("img", { name: "2FA QR code" });
	return setup;
}

function enableButton(): HTMLButtonElement {
	return screen.getByRole<HTMLButtonElement>("button", { name: "Enable 2FA" });
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.meData.mockReturnValue(envelopeFixture(userFixture({ twoFactorEnabled: false })));
	mocks.noop.mockResolvedValue(undefined);
	mocks.refetchRemaining.mockResolvedValue(undefined);
	mocks.twoFactorSetupQuery.mockReturnValue({ data: envelopeFixture(setupResponseFixture()) });
});

afterEach(() => {
	cleanup();
	window.sessionStorage.clear();
});

describe("SecuritySettingsPanel two-factor setup", () => {
	it("starts setup with the POST mutation on click — never by reading it as a query", async () => {
		render(<SecuritySettingsPanel />);

		// Nothing is generated just by viewing the page: no QR until the member asks for one.
		expect(screen.queryByRole("img", { name: "2FA QR code" })).toBeNull();
		expect(mocks.twoFactorSetup).not.toHaveBeenCalled();

		mocks.twoFactorSetup.mockResolvedValue(envelopeFixture(setupResponseFixture()));
		fireEvent.click(screen.getByRole("button", { name: SETUP_BUTTON }));

		await screen.findByRole("img", { name: "2FA QR code" });
		expect(mocks.twoFactorSetup).toHaveBeenCalledTimes(1);
		expect(mocks.twoFactorSetup).toHaveBeenCalledWith({});
		expect(mocks.twoFactorSetupQuery).not.toHaveBeenCalled();
	});

	it("renders the QR code, the manual-entry secret and every backup code from the setup answer", async () => {
		const setup = await startSetup();

		expect(screen.getByRole("img", { name: "2FA QR code" }).getAttribute("src")).toBe(setup.qrCodeDataUrl);
		expect(screen.getByText(setup.secret)).toBeDefined();
		for (const code of setup.backupCodes) {
			expect(screen.getByText(code)).toBeDefined();
		}
		expect(screen.queryByRole("button", { name: SETUP_BUTTON })).toBeNull();
	});

	it("shows the error when setup fails and renders no QR code", async () => {
		mocks.twoFactorSetup.mockRejectedValue(new ApiError({ message: "Two-factor authentication is already enabled", statusCode: 409 }));
		render(<SecuritySettingsPanel />);

		fireEvent.click(screen.getByRole("button", { name: SETUP_BUTTON }));

		expect(await screen.findByText("Two-factor authentication is already enabled")).toBeDefined();
		expect(screen.queryByRole("img", { name: "2FA QR code" })).toBeNull();
		expect(screen.getByRole("button", { name: SETUP_BUTTON })).toBeDefined();
	});
});

describe("SecuritySettingsPanel enabling two-factor", () => {
	it("keeps Enable disabled until a full six-digit code AND the saved-codes confirmation are given", async () => {
		await startSetup();
		const codeInput = screen.getByLabelText<HTMLInputElement>("Verification code");
		expect(enableButton().disabled).toBe(true);

		fireEvent.change(codeInput, { target: { value: "12a345" } });
		expect(codeInput.value).toBe("12345");
		expect(enableButton().disabled).toBe(true);

		fireEvent.change(codeInput, { target: { value: "123456" } });
		expect(enableButton().disabled).toBe(true);

		fireEvent.click(screen.getByRole("checkbox", { name: SAVED_CODES_LABEL }));
		await waitFor((): void => {
			expect(enableButton().disabled).toBe(false);
		});

		fireEvent.change(codeInput, { target: { value: "12345" } });
		expect(enableButton().disabled).toBe(true);
	});

	it("does not enable without the saved-codes confirmation, even with a valid code", async () => {
		await startSetup();
		const codeInput = screen.getByLabelText("Verification code");

		fireEvent.change(codeInput, { target: { value: "123456" } });
		fireEvent.click(enableButton());

		expect(enableButton().disabled).toBe(true);
		expect(mocks.twoFactorEnable).not.toHaveBeenCalled();
	});

	it("enables 2FA with the code, shows the confirmation, hides the secret and refreshes the remaining-codes count", async () => {
		const setup = await startSetup();
		mocks.twoFactorEnable.mockResolvedValue(envelopeFixture({ message: "Two-factor authentication enabled" }));

		fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: "654321" } });
		fireEvent.click(screen.getByRole("checkbox", { name: SAVED_CODES_LABEL }));
		await waitFor((): void => {
			expect(enableButton().disabled).toBe(false);
		});
		fireEvent.click(enableButton());

		expect(await screen.findByText("Two-factor authentication enabled")).toBeDefined();
		expect(mocks.twoFactorEnable).toHaveBeenCalledWith({ token: "654321" });
		expect(mocks.refetchRemaining).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole("img", { name: "2FA QR code" })).toBeNull();
		expect(screen.queryByText(setup.secret)).toBeNull();
	});

	it("shows the API error when the code is rejected and keeps the setup on screen", async () => {
		const setup = await startSetup();
		mocks.twoFactorEnable.mockRejectedValue(new ApiError({ message: "Invalid verification code", statusCode: 400 }));

		fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: "000000" } });
		fireEvent.click(screen.getByRole("checkbox", { name: SAVED_CODES_LABEL }));
		await waitFor((): void => {
			expect(enableButton().disabled).toBe(false);
		});
		fireEvent.click(enableButton());

		expect(await screen.findByText("Invalid verification code")).toBeDefined();
		expect(screen.getByText(setup.secret)).toBeDefined();
		expect(mocks.refetchRemaining).not.toHaveBeenCalled();
	});
});
