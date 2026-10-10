// ============================================
// Two-factor challenge (§10.3) — an authenticator code, or a backup code
// ============================================

import { useForm } from "@tanstack/react-form";
import {
	BACKUP_CODE_LENGTH,
	LoginTwoFactorSchema,
	normalizeBackupCodeInput,
	TOTP_CODE_LENGTH,
	VerifyBackupCodeLoginSchema,
	type LoginClientResponse,
} from "@workspace/shared";
import { useRouter } from "expo-router";
import * as React from "react";

import { AuthPage } from "../../components/auth-page";
import { Banner } from "../../components/banner";
import { Button } from "../../components/button";
import { TextField } from "../../components/text-field";
import { TextLink } from "../../components/text-link";
import { EXPIRED_STEP_MESSAGE, TwoFactorRouteParamsSchema } from "../../features/auth/sign-in-steps";
import { useSignInStepHandler } from "../../features/auth/use-sign-in-step";
import { useApi } from "../../lib/api-context";
import { errorMessageOf } from "../../lib/error-messages";
import { visibleFieldError } from "../../lib/form";
import { useRouteParams } from "../../lib/route-params";
import { sanitizeCodeInput } from "../../lib/code-input";
import { ROUTES } from "../../runtime/routes";

const TotpFormSchema = LoginTwoFactorSchema.pick({ token: true });
const BackupCodeFormSchema = VerifyBackupCodeLoginSchema.pick({ backupCode: true });

export default function TwoFactorScreen(): React.JSX.Element {
	const params = useRouteParams(TwoFactorRouteParamsSchema);
	const router = useRouter();
	const startOver = React.useCallback((): void => {
		router.replace(ROUTES.signIn);
	}, [router]);

	if (params === null) {
		return (
			<AuthPage title="Two-factor authentication">
				<Banner tone="error" message={EXPIRED_STEP_MESSAGE} />
				<Button label="Back to sign in" onPress={startOver} />
			</AuthPage>
		);
	}
	return <TwoFactorChallenge tempToken={params.tempToken} onStartOver={startOver} />;
}

interface TwoFactorChallengeProps {
	readonly tempToken: string;
	readonly onStartOver: () => void;
}

function TwoFactorChallenge({ tempToken, onStartOver }: TwoFactorChallengeProps): React.JSX.Element {
	const api = useApi();
	const handleStep = useSignInStepHandler();
	const totpMutation = api.auth.loginTwoFactor.useMutation();
	const backupMutation = api.auth.loginBackupCode.useMutation();
	const [useBackupCode, setUseBackupCode] = React.useState(false);
	const [requestError, setRequestError] = React.useState<string | null>(null);

	const runStep = React.useCallback(
		async (request: () => Promise<{ readonly data: LoginClientResponse }>): Promise<void> => {
			setRequestError(null);
			try {
				const response = await request();
				setRequestError(await handleStep(response.data));
			} catch (error) {
				setRequestError(errorMessageOf(error instanceof Error ? error : null));
			}
		},
		[handleStep],
	);

	const totpForm = useForm({
		defaultValues: { token: "" },
		validators: { onChange: TotpFormSchema },
		onSubmit: ({ value }): Promise<void> => runStep(() => totpMutation.mutateAsync({ tempToken, token: TotpFormSchema.parse(value).token })),
	});
	const backupForm = useForm({
		defaultValues: { backupCode: "" },
		validators: { onChange: BackupCodeFormSchema },
		onSubmit: ({ value }): Promise<void> => runStep(() => backupMutation.mutateAsync({ tempToken, backupCode: BackupCodeFormSchema.parse(value).backupCode })),
	});

	const submitTotp = React.useCallback((): void => {
		void totpForm.handleSubmit();
	}, [totpForm]);
	const submitBackupCode = React.useCallback((): void => {
		void backupForm.handleSubmit();
	}, [backupForm]);
	const switchToBackupCode = React.useCallback((): void => {
		setRequestError(null);
		setUseBackupCode(true);
	}, []);
	const switchToAuthenticator = React.useCallback((): void => {
		setRequestError(null);
		setUseBackupCode(false);
	}, []);

	return (
		<AuthPage
			title="Two-factor authentication"
			description={useBackupCode ? "Enter one of your unused backup codes. Each code works once." : "Enter the 6-digit code from your authenticator app."}
			footer={<TextLink leadIn="Not you?" label="Use a different account" onPress={onStartOver} />}>
			{requestError === null ? null : <Banner tone="error" message={requestError} />}
			{useBackupCode ? (
				<>
					<backupForm.Field name="backupCode">
						{(field): React.JSX.Element => (
							<TextField
								label="Backup code"
								value={field.state.value}
								onChange={field.handleChange}
								normalize={normalizeBackupCodeInput}
								onBlur={field.handleBlur}
								error={visibleFieldError(field.state.meta)}
								autoCapitalize="characters"
								autoCorrect={false}
								maxLength={BACKUP_CODE_LENGTH}
								hint={`${String(BACKUP_CODE_LENGTH)} characters, letters and digits`}
								onSubmitEditing={submitBackupCode}
							/>
						)}
					</backupForm.Field>
					<Button label="Verify backup code" onPress={submitBackupCode} loading={backupMutation.isPending} />
					<Button label="Use authenticator code instead" variant="ghost" onPress={switchToAuthenticator} />
				</>
			) : (
				<>
					<totpForm.Field name="token">
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
								onSubmitEditing={submitTotp}
							/>
						)}
					</totpForm.Field>
					<Button label="Verify" onPress={submitTotp} loading={totpMutation.isPending} />
					<Button label="Use a backup code" variant="ghost" onPress={switchToBackupCode} />
				</>
			)}
		</AuthPage>
	);
}
