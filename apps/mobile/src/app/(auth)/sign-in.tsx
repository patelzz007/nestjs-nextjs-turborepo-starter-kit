// ============================================
// Sign in (§10.1) — email and password, with the shared LoginSchema
// ============================================

import { useForm } from "@tanstack/react-form";
import { LoginSchema, type LoginInput } from "@workspace/shared";
import { useRouter } from "expo-router";
import * as React from "react";
import { View } from "react-native";

import { AuthPage } from "../../components/auth-page";
import { Banner } from "../../components/banner";
import { Button } from "../../components/button";
import { TextField } from "../../components/text-field";
import { QuickSignIn, type QuickSignInChoice } from "../../components/quick-sign-in";
import { TextLink } from "../../components/text-link";
import { useDemoAccounts, type DemoAccount } from "../../features/auth/demo-accounts";
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
	const demoAccounts = useDemoAccounts();

	const form = useForm({
		defaultValues: EMPTY_LOGIN,
		validators: { onChange: LoginSchema },
		onSubmit: async ({ value }): Promise<void> => {
			setRequestError(null);
			try {
				const response = await login.mutateAsync(LoginSchema.parse(value));
				setRequestError(await handleStep(response.data));
			} catch (error) {
				setRequestError(errorMessageOf(error instanceof Error ? error : null));
			}
		},
	});

	const submit = React.useCallback((): void => {
		void form.handleSubmit();
	}, [form]);
	/** A demo login (development builds only): fill the fields so the user sees what is sent, then sign in — as the web does. */
	const signInAsDemo = React.useCallback(
		(email: string): void => {
			const account = demoAccounts.find((candidate: DemoAccount): boolean => candidate.email === email);
			if (account === undefined) {
				return;
			}
			form.setFieldValue("email", account.email);
			form.setFieldValue("password", account.password);
			void form.handleSubmit();
		},
		[demoAccounts, form],
	);
	const demoChoices = React.useMemo(
		(): readonly QuickSignInChoice[] => demoAccounts.map((account: DemoAccount): QuickSignInChoice => ({ key: account.email, label: account.label })),
		[demoAccounts],
	);
	const openForgotPassword = React.useCallback((): void => {
		router.push(ROUTES.forgotPassword);
	}, [router]);
	const openSignUp = React.useCallback((): void => {
		router.push(ROUTES.signUp);
	}, [router]);

	const notice = signedOutReason === null ? null : SIGNED_OUT_NOTICES[signedOutReason];

	return (
		<AuthPage title="Welcome back" description="Sign in to continue." footer={<TextLink leadIn="Don't have an account?" label="Create one" onPress={openSignUp} />}>
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
			<View className="-mt-2 items-end">
				<TextLink label="Forgot password?" onPress={openForgotPassword} />
			</View>
			<Button label="Sign in" onPress={submit} loading={login.isPending} />
			{demoChoices.length === 0 ? null : (
				<QuickSignIn title="Quick sign-in (development)" choices={demoChoices} onSelect={signInAsDemo} disabled={login.isPending} testID="quick-sign-in" />
			)}
		</AuthPage>
	);
}
