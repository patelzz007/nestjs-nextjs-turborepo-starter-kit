// ============================================
// two-factor-enrollment.tsx - turning on 2FA on a phone (§10.5)
// ============================================
// Used by the forced enrollment during sign-in and by Security settings (turn
// on, and "generate new backup codes", which rotates the secret like the web).
// A phone cannot scan its own screen, so the order is:
// 1. POST /auth/2fa/setup (the user starts it — one pending secret per tap), or
//    POST /auth/2fa/rotate with the password and a current code;
// 2. "Open in authenticator app" (the `otpauth://` link), the setup key with
//    Copy, and the QR code for a second device;
// 3. the code from the authenticator → POST /auth/2fa/enable;
// 4. the backup codes: Copy all, Share, and "I saved my backup codes" before
//    continuing.
// Smart component: it owns the two mutations; the caller decides what
// "continue" means (refresh the restricted session, or go back to Security).

import { useForm } from "@tanstack/react-form";
import {
	BackupCodeSchema,
	BACKUP_CODE_LENGTH,
	EnableTwoFactorSchema,
	normalizeBackupCodeInput,
	RotateTwoFactorSchema,
	TOTP_CODE_LENGTH,
	TotpCodeSchema,
	type TwoFactorSetupResponse,
} from "@workspace/shared";
import * as Clipboard from "expo-clipboard";
import * as React from "react";
import { Image, Linking, Text, View } from "react-native";
import { z } from "zod";

import { Banner } from "../../components/banner";
import { BackupCodes } from "../../components/backup-codes";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { MutedText } from "../../components/text";
import { TextField } from "../../components/text-field";
import { useApi } from "../../lib/api-context";
import { sanitizeCodeInput } from "../../lib/code-input";
import { errorMessageOf, GENERIC_ERROR_MESSAGE } from "../../lib/error-messages";
import { visibleFieldError } from "../../lib/form";
import { groupSetupKey } from "./setup-key";
import { useBackupCodeActions } from "./use-backup-code-actions";

/** Side of the QR code image, in points. */
const QR_CODE_SIZE = 200;

export const NO_AUTHENTICATOR_MESSAGE =
	"No authenticator app on this phone opened the link. Install one (for example Microsoft Authenticator or Google Authenticator), or add the account by hand with the setup key below.";

type EnrollmentStep =
	{ readonly step: "start" } | { readonly step: "verify"; readonly setup: TwoFactorSetupResponse } | { readonly step: "backupCodes"; readonly codes: readonly string[] };

/** `setup` turns 2FA on; `rotate` replaces the secret and the backup codes of an enabled 2FA. */
export const TwoFactorEnrollmentModeSchema = z.enum(["setup", "rotate"]);

export type TwoFactorEnrollmentMode = z.output<typeof TwoFactorEnrollmentModeSchema>;

export interface TwoFactorEnrollmentProps {
	readonly mode: TwoFactorEnrollmentMode;
	/**
	 * Enabling and rotating bump the account's token version, which makes the
	 * current access token stale (`TOKEN_VERSION_MISMATCH`). A FULL session
	 * passes its refresh here so it stays signed in; a restricted (forced
	 * enrollment) session omits it and refreshes in `onComplete`, after the
	 * backup codes were saved. Resolves an error message, or `null`.
	 */
	readonly afterTokenVersionBump?: () => Promise<string | null>;
	/** After the backup codes were saved. Resolves an error message to show, or `null`. */
	readonly onComplete: () => Promise<string | null>;
	readonly completeLabel: string;
}

const START: EnrollmentStep = { step: "start" };

export function TwoFactorEnrollment({ mode, afterTokenVersionBump, onComplete, completeLabel }: TwoFactorEnrollmentProps): React.JSX.Element {
	const api = useApi();
	const setupMutation = api.auth.twoFactorSetup.useMutation();
	const [state, setState] = React.useState<EnrollmentStep>(START);
	const [requestError, setRequestError] = React.useState<string | null>(null);

	const begin = React.useCallback((): void => {
		setRequestError(null);
		setupMutation
			.mutateAsync({})
			.then((response): void => {
				setState({ step: "verify", setup: response.data });
			})
			.catch((error: unknown): void => {
				setRequestError(errorMessageOf(error instanceof Error ? error : null));
			});
	}, [setupMutation]);

	const syncSession = React.useCallback(async (): Promise<void> => {
		setRequestError(afterTokenVersionBump === undefined ? null : await afterTokenVersionBump());
	}, [afterTokenVersionBump]);

	const handleRotated = React.useCallback(
		async (setup: TwoFactorSetupResponse): Promise<void> => {
			await syncSession();
			setState({ step: "verify", setup });
		},
		[syncSession],
	);

	const handleEnabled = React.useCallback(
		async (codes: readonly string[]): Promise<void> => {
			await syncSession();
			setState({ step: "backupCodes", codes });
		},
		[syncSession],
	);

	return (
		<View className="gap-5">
			{requestError === null ? null : <Banner tone="error" message={requestError} />}
			{state.step === "start" && mode === "rotate" ? <RotateStart onRotated={handleRotated} /> : null}
			{state.step === "start" && mode === "setup" ? (
				<>
					<MutedText>Two-factor authentication asks for a code from an authenticator app every time you sign in on a new device.</MutedText>
					<Button label="Set up authenticator app" onPress={begin} loading={setupMutation.isPending} />
				</>
			) : null}
			{state.step === "verify" ? <VerifyStep setup={state.setup} onEnabled={handleEnabled} /> : null}
			{state.step === "backupCodes" ? <BackupCodesStep codes={state.codes} onComplete={onComplete} completeLabel={completeLabel} /> : null}
		</View>
	);
}

const RotateWithTotpFormSchema = z.object({ password: z.string().min(1, "Password is required"), code: TotpCodeSchema });
const RotateWithBackupCodeFormSchema = z.object({ password: z.string().min(1, "Password is required"), code: BackupCodeSchema });

interface RotateStartProps {
	readonly onRotated: (setup: TwoFactorSetupResponse) => Promise<void>;
}

/** Proves the account holder (password + a current authenticator or backup code) before a new secret is issued. */
function RotateStart({ onRotated }: RotateStartProps): React.JSX.Element {
	const api = useApi();
	const rotateMutation = api.auth.twoFactorRotate.useMutation();
	const [useBackupCode, setUseBackupCode] = React.useState(false);
	const [requestError, setRequestError] = React.useState<string | null>(null);

	const form = useForm({
		defaultValues: { password: "", code: "" },
		validators: { onChange: useBackupCode ? RotateWithBackupCodeFormSchema : RotateWithTotpFormSchema },
		onSubmit: async ({ value }): Promise<void> => {
			setRequestError(null);
			const input = RotateTwoFactorSchema.parse(useBackupCode ? { password: value.password, backupCode: value.code } : { password: value.password, token: value.code });
			try {
				const response = await rotateMutation.mutateAsync(input);
				await onRotated(response.data);
			} catch (error) {
				setRequestError(errorMessageOf(error instanceof Error ? error : null));
			}
		},
	});
	const submit = React.useCallback((): void => {
		void form.handleSubmit();
	}, [form]);
	const toggleCodeKind = React.useCallback((): void => {
		form.setFieldValue("code", "");
		setUseBackupCode((current: boolean): boolean => !current);
	}, [form]);

	return (
		<Card title="Confirm it's you" description="New backup codes come with a new authenticator secret: you will add the account to your authenticator again.">
			{requestError === null ? null : <Banner tone="error" message={requestError} />}
			<form.Field name="password">
				{(field): React.JSX.Element => (
					<TextField
						label="Password"
						value={field.state.value}
						onChange={field.handleChange}
						onBlur={field.handleBlur}
						error={visibleFieldError(field.state.meta)}
						secureTextEntry
						autoCapitalize="none"
						autoComplete="current-password"
						textContentType="password"
					/>
				)}
			</form.Field>
			<form.Field name="code">
				{(field): React.JSX.Element =>
					useBackupCode ? (
						<TextField
							label="Current backup code"
							value={field.state.value}
							onChange={field.handleChange}
							normalize={normalizeBackupCodeInput}
							onBlur={field.handleBlur}
							error={visibleFieldError(field.state.meta)}
							autoCapitalize="characters"
							autoCorrect={false}
							maxLength={BACKUP_CODE_LENGTH}
						/>
					) : (
						<TextField
							label="Current authenticator code"
							value={field.state.value}
							onChange={field.handleChange}
							normalize={sanitizeCodeInput}
							onBlur={field.handleBlur}
							error={visibleFieldError(field.state.meta)}
							keyboardType="number-pad"
							autoComplete="one-time-code"
							textContentType="oneTimeCode"
							maxLength={TOTP_CODE_LENGTH}
						/>
					)
				}
			</form.Field>
			<Button label={useBackupCode ? "Use authenticator code instead" : "Use a backup code instead"} variant="ghost" onPress={toggleCodeKind} />
			<Button label="Generate new codes" onPress={submit} loading={rotateMutation.isPending} />
		</Card>
	);
}

interface VerifyStepProps {
	readonly setup: TwoFactorSetupResponse;
	readonly onEnabled: (backupCodes: readonly string[]) => Promise<void>;
}

function VerifyStep({ setup, onEnabled }: VerifyStepProps): React.JSX.Element {
	const api = useApi();
	const enableMutation = api.auth.twoFactorEnable.useMutation();
	const [requestError, setRequestError] = React.useState<string | null>(null);
	const [linkFailed, setLinkFailed] = React.useState(false);
	const [keyCopied, setKeyCopied] = React.useState(false);

	const form = useForm({
		defaultValues: { token: "" },
		validators: { onChange: EnableTwoFactorSchema },
		onSubmit: async ({ value }): Promise<void> => {
			setRequestError(null);
			try {
				await enableMutation.mutateAsync(EnableTwoFactorSchema.parse(value));
				await onEnabled(setup.backupCodes);
			} catch (error) {
				setRequestError(errorMessageOf(error instanceof Error ? error : null));
			}
		},
	});
	const submit = React.useCallback((): void => {
		void form.handleSubmit();
	}, [form]);

	const openAuthenticator = React.useCallback((): void => {
		Linking.openURL(setup.otpAuthUrl)
			.then((): void => {
				setLinkFailed(false);
			})
			.catch((): void => {
				setLinkFailed(true);
			});
	}, [setup.otpAuthUrl]);

	const copySetupKey = React.useCallback((): void => {
		Clipboard.setStringAsync(setup.secret)
			.then((): void => {
				setKeyCopied(true);
			})
			.catch((): void => {
				setKeyCopied(false);
			});
	}, [setup.secret]);

	return (
		<>
			<Card title="1. Add the account to your authenticator">
				<Button label="Open in authenticator app" onPress={openAuthenticator} accessibilityHint="Opens your authenticator app to add this account" />
				{linkFailed ? <Banner tone="warning" message={NO_AUTHENTICATOR_MESSAGE} /> : null}
				<View className="gap-2">
					<MutedText>Setup key</MutedText>
					<Text selectable accessibilityLabel={`Setup key ${setup.secret.split("").join(" ")}`} className="font-mono text-base text-foreground">
						{groupSetupKey(setup.secret)}
					</Text>
					<Button label={keyCopied ? "Setup key copied" : "Copy setup key"} variant="secondary" onPress={copySetupKey} />
				</View>
				<View className="items-center gap-2">
					<MutedText>Or scan this code with another device:</MutedText>
					<View className="rounded-lg bg-qr-background p-3">
						<Image source={{ uri: setup.qrCodeDataUrl }} accessibilityLabel="QR code for your authenticator app" width={QR_CODE_SIZE} height={QR_CODE_SIZE} />
					</View>
				</View>
			</Card>
			<Card title="2. Enter the code it shows">
				{requestError === null ? null : <Banner tone="error" message={requestError} />}
				<form.Field name="token">
					{(field): React.JSX.Element => (
						<TextField
							label="Authentication code"
							value={field.state.value}
							onChange={field.handleChange}
							normalize={sanitizeCodeInput}
							onBlur={field.handleBlur}
							error={visibleFieldError(field.state.meta)}
							keyboardType="number-pad"
							autoComplete="one-time-code"
							textContentType="oneTimeCode"
							maxLength={TOTP_CODE_LENGTH}
							onSubmitEditing={submit}
						/>
					)}
				</form.Field>
				<Button label="Turn on two-factor authentication" onPress={submit} loading={enableMutation.isPending} />
			</Card>
		</>
	);
}

interface BackupCodesStepProps {
	readonly codes: readonly string[];
	readonly onComplete: () => Promise<string | null>;
	readonly completeLabel: string;
}

function BackupCodesStep({ codes, onComplete, completeLabel }: BackupCodesStepProps): React.JSX.Element {
	const actions = useBackupCodeActions(codes);
	const [confirmed, setConfirmed] = React.useState(false);
	const [completing, setCompleting] = React.useState(false);
	const [completeError, setCompleteError] = React.useState<string | null>(null);

	const complete = React.useCallback((): void => {
		setCompleting(true);
		setCompleteError(null);
		const settle = (error: string | null): void => {
			setCompleteError(error);
			setCompleting(false);
		};
		onComplete().then(settle, (): void => {
			settle(GENERIC_ERROR_MESSAGE);
		});
	}, [onComplete]);

	return (
		<Card title="3. Save your backup codes">
			<Banner tone="success" message="Two-factor authentication is on." />
			{actions.copied ? <Banner tone="info" message="Backup codes copied." /> : null}
			{completeError === null ? null : <Banner tone="error" message={completeError} />}
			<BackupCodes
				codes={codes}
				confirmed={confirmed}
				onConfirmedChange={setConfirmed}
				onCopy={actions.copy}
				onShare={actions.share}
				onContinue={complete}
				continueLabel={completeLabel}
				continuePending={completing}
			/>
		</Card>
	);
}
