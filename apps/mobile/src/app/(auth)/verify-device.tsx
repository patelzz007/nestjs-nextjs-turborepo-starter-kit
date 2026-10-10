// ============================================
// Verify device (§10.2) — the code the API emailed for an unrecognized device
// ============================================
// The API has no resend endpoint (the web has none either): signing in again
// sends a new code, so "Didn't get it?" leads back to sign-in.

import { useForm } from "@tanstack/react-form";
import { TOTP_CODE_LENGTH, VerifyLoginSchema } from "@workspace/shared";
import { useRouter } from "expo-router";
import * as React from "react";

import { AuthPage } from "../../components/auth-page";
import { Banner } from "../../components/banner";
import { Button } from "../../components/button";
import { MutedText } from "../../components/text";
import { TextField } from "../../components/text-field";
import { TextLink } from "../../components/text-link";
import { EXPIRED_STEP_MESSAGE, VerifyDeviceRouteParamsSchema } from "../../features/auth/sign-in-steps";
import { useSignInStepHandler } from "../../features/auth/use-sign-in-step";
import { useApi } from "../../lib/api-context";
import { sanitizeCodeInput } from "../../lib/code-input";
import { errorMessageOf } from "../../lib/error-messages";
import { visibleFieldError } from "../../lib/form";
import { useRouteParams } from "../../lib/route-params";
import { ROUTES } from "../../runtime/routes";

const VerificationCodeFormSchema = VerifyLoginSchema.pick({ code: true });

export default function VerifyDeviceScreen(): React.JSX.Element {
	const params = useRouteParams(VerifyDeviceRouteParamsSchema);
	const router = useRouter();
	const startOver = React.useCallback((): void => {
		router.replace(ROUTES.signIn);
	}, [router]);

	if (params === null) {
		return (
			<AuthPage title="Verify this device">
				<Banner tone="error" message={EXPIRED_STEP_MESSAGE} />
				<Button label="Back to sign in" onPress={startOver} />
			</AuthPage>
		);
	}
	return <DeviceVerification verificationId={params.verificationId} onStartOver={startOver} />;
}

interface DeviceVerificationProps {
	readonly verificationId: string;
	readonly onStartOver: () => void;
}

function DeviceVerification({ verificationId, onStartOver }: DeviceVerificationProps): React.JSX.Element {
	const api = useApi();
	const handleStep = useSignInStepHandler();
	const verifyLogin = api.auth.verifyLogin.useMutation();
	const [requestError, setRequestError] = React.useState<string | null>(null);

	const form = useForm({
		defaultValues: { code: "" },
		validators: { onChange: VerificationCodeFormSchema },
		onSubmit: async ({ value }): Promise<void> => {
			setRequestError(null);
			try {
				const response = await verifyLogin.mutateAsync({ verificationId, code: VerificationCodeFormSchema.parse(value).code });
				setRequestError(await handleStep(response.data));
			} catch (error) {
				setRequestError(errorMessageOf(error instanceof Error ? error : null));
			}
		},
	});
	const submit = React.useCallback((): void => {
		void form.handleSubmit();
	}, [form]);

	return (
		<AuthPage
			title="Verify this device"
			description="We emailed you a 6-digit code because this device is new to your account. Enter it to finish signing in."
			footer={<TextLink leadIn="Not you?" label="Use a different account" onPress={onStartOver} />}>
			{requestError === null ? null : <Banner tone="error" message={requestError} />}
			<form.Field name="code">
				{(field): React.JSX.Element => (
					<TextField
						label="Verification code"
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
			<Button label="Verify and sign in" onPress={submit} loading={verifyLogin.isPending} />
			<MutedText>Didn&apos;t get a code? Sign in again to send a new one.</MutedText>
		</AuthPage>
	);
}
