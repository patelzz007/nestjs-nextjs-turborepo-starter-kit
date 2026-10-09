// ============================================
// Forgot password (§10.6) — requests the reset email; the reset finishes on the web
// ============================================
// The answer is the same whether or not the account exists (no account
// enumeration), and so is this screen's confirmation.

import { useForm } from "@tanstack/react-form";
import { ForgotPasswordSchema, type ForgotPasswordInput } from "@workspace/shared";
import { useRouter } from "expo-router";
import * as React from "react";

import { Banner } from "../../components/banner";
import { Button } from "../../components/button";
import { Screen } from "../../components/screen";
import { BodyText } from "../../components/text";
import { TextField } from "../../components/text-field";
import { useApi } from "../../lib/api-context";
import { errorMessageOf } from "../../lib/error-messages";
import { visibleFieldError } from "../../lib/form";
import { ROUTES } from "../../runtime/routes";

const EMPTY_REQUEST: ForgotPasswordInput = { email: "" };

export default function ForgotPasswordScreen(): React.JSX.Element {
	const api = useApi();
	const router = useRouter();
	const forgotPassword = api.auth.forgotPassword.useMutation();
	const [requestError, setRequestError] = React.useState<string | null>(null);
	const [requestedEmail, setRequestedEmail] = React.useState<string | null>(null);

	const form = useForm({
		defaultValues: EMPTY_REQUEST,
		validators: { onChange: ForgotPasswordSchema },
		onSubmit: async ({ value }): Promise<void> => {
			setRequestError(null);
			const input = ForgotPasswordSchema.parse(value);
			try {
				await forgotPassword.mutateAsync(input);
				setRequestedEmail(input.email);
			} catch (error) {
				setRequestError(errorMessageOf(error instanceof Error ? error : null));
			}
		},
	});
	const submit = React.useCallback((): void => {
		void form.handleSubmit();
	}, [form]);
	const backToSignIn = React.useCallback((): void => {
		router.replace(ROUTES.signIn);
	}, [router]);

	if (requestedEmail !== null) {
		return (
			<Screen title="Check your email">
				<BodyText>{`If an account exists for ${requestedEmail}, we sent a reset link. Open it on any device to choose a new password, then come back and sign in.`}</BodyText>
				<Button label="Back to sign in" onPress={backToSignIn} />
			</Screen>
		);
	}

	return (
		<Screen title="Reset your password" description="Enter your account's email and we'll send you a link to choose a new password.">
			{requestError === null ? null : <Banner tone="error" message={requestError} />}
			<form.Field name="email">
				{(field): React.JSX.Element => (
					<TextField
						label="Email"
						value={field.state.value}
						onChange={field.handleChange}
						onBlur={field.handleBlur}
						error={visibleFieldError(field.state.meta)}
						keyboardType="email-address"
						autoCapitalize="none"
						autoCorrect={false}
						autoComplete="email"
						textContentType="emailAddress"
						onSubmitEditing={submit}
					/>
				)}
			</form.Field>
			<Button label="Send reset link" onPress={submit} loading={forgotPassword.isPending} />
			<Button label="Back to sign in" variant="ghost" onPress={backToSignIn} />
		</Screen>
	);
}
