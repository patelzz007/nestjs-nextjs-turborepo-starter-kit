// ============================================
// Sign in (§10.1) — email and password, with the shared LoginSchema
// ============================================

import { useForm } from "@tanstack/react-form";
import { LoginSchema, type LoginInput } from "@workspace/shared";
import { useRouter } from "expo-router";
import * as React from "react";
import { View } from "react-native";

import { Banner } from "../../components/banner";
import { Button } from "../../components/button";
import { Screen } from "../../components/screen";
import { TextField } from "../../components/text-field";
import { useSignInStepHandler } from "../../features/auth/use-sign-in-step";
import { useSignedOutReason } from "../../features/session/facade";
import type { SignedOutReason } from "../../features/session/state";
import { useApi } from "../../lib/api-context";
import { errorMessageOf } from "../../lib/error-messages";
import { visibleFieldError } from "../../lib/form";
import { ROUTES } from "../../runtime/routes";

/** Why the user is here, when it is not a first visit (§6.4, §11.2). */
const SIGNED_OUT_NOTICES: Readonly<Record<SignedOutReason, string | null>> = {
	none: null,
	signedOut: null,
	sessionExpired: "Your session has ended. Please sign in again.",
	appLockReset: "The biometrics on this device changed, so the app lock was turned off. Sign in with your password to continue.",
	passwordChanged: "Your password was changed and every device was signed out. Sign in with your new password.",
};

const EMPTY_LOGIN: LoginInput = { email: "", password: "" };

export default function SignInScreen(): React.JSX.Element {
	const api = useApi();
	const router = useRouter();
	const signedOutReason = useSignedOutReason();
	const handleStep = useSignInStepHandler();
	const login = api.auth.login.useMutation();
	const [requestError, setRequestError] = React.useState<string | null>(null);

	const form = useForm({
		defaultValues: EMPTY_LOGIN,
		validators: { onChange: LoginSchema },
		onSubmit: async ({ value }): Promise<void> => {
			setRequestError(null);
			try {
				const response = await login.mutateAsync(LoginSchema.parse(value));
				// eslint-disable-next-line no-console
				console.log("Login Response", response);
				setRequestError(await handleStep(response.data));
			} catch (error) {
				setRequestError(errorMessageOf(error instanceof Error ? error : null));
			}
		},
	});

	const submit = React.useCallback((): void => {
		void form.handleSubmit();
	}, [form]);
	const openForgotPassword = React.useCallback((): void => {
		router.push(ROUTES.forgotPassword);
	}, [router]);
	const openSignUp = React.useCallback((): void => {
		router.push(ROUTES.signUp);
	}, [router]);

	const notice = signedOutReason === null ? null : SIGNED_OUT_NOTICES[signedOutReason];

	return (
		<Screen title="Sign in" description="Welcome back. Sign in to continue.">
			{notice === null ? null : <Banner tone="info" message={notice} testID="signed-out-notice" />}
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
						returnKeyType="next"
					/>
				)}
			</form.Field>
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
						returnKeyType="go"
						onSubmitEditing={submit}
					/>
				)}
			</form.Field>
			<Button label="Sign in" onPress={submit} loading={login.isPending} />
			<View className="gap-1">
				<Button label="Forgot password?" variant="ghost" onPress={openForgotPassword} />
				<Button label="Create an account" variant="ghost" onPress={openSignUp} />
			</View>
		</Screen>
	);
}
