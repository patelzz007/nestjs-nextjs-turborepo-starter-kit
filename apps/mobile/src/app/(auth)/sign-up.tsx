// ============================================
// Sign up (§10.4) — a native form for POST /auth/signup with the shared SignupSchema
// ============================================
// Email verification finishes on the web page the emailed link opens (deep
// links are out of scope), so success shows a confirmation, not a session.

import { useForm } from "@tanstack/react-form";
import { SignupSchema, type SignupInput } from "@workspace/shared";
import { useRouter } from "expo-router";
import * as React from "react";

import { AuthPage } from "../../components/auth-page";
import { Banner } from "../../components/banner";
import { Button } from "../../components/button";
import { TextField } from "../../components/text-field";
import { TextLink } from "../../components/text-link";
import { useApi } from "../../lib/api-context";
import { errorMessageOf } from "../../lib/error-messages";
import { visibleFieldError } from "../../lib/form";
import { ROUTES } from "../../runtime/routes";

const EMPTY_SIGNUP: SignupInput = { fullName: "", email: "", password: "" };

export default function SignUpScreen(): React.JSX.Element {
	const api = useApi();
	const router = useRouter();
	const signup = api.auth.signup.useMutation();
	const [requestError, setRequestError] = React.useState<string | null>(null);
	const [registeredEmail, setRegisteredEmail] = React.useState<string | null>(null);

	const form = useForm({
		defaultValues: EMPTY_SIGNUP,
		validators: { onChange: SignupSchema },
		onSubmit: async ({ value }): Promise<void> => {
			setRequestError(null);
			const input = SignupSchema.parse(value);
			try {
				await signup.mutateAsync(input);
				setRegisteredEmail(input.email);
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

	if (registeredEmail !== null) {
		return (
			<AuthPage title="Check your email" description={`We sent a verification link to ${registeredEmail}. Open it on any device, then come back and sign in.`}>
				<Button label="Back to sign in" onPress={backToSignIn} />
			</AuthPage>
		);
	}

	return (
		<AuthPage
			title="Create an account"
			description="Enter your details to get started."
			footer={<TextLink leadIn="Already have an account?" label="Sign in" onPress={backToSignIn} />}>
			{requestError === null ? null : <Banner tone="error" message={requestError} />}
			<form.Field name="fullName">
				{(field): React.JSX.Element => (
					<TextField
						label="Full name"
						value={field.state.value}
						onChange={field.handleChange}
						onBlur={field.handleBlur}
						error={visibleFieldError(field.state.meta)}
						autoComplete="name"
						textContentType="name"
					/>
				)}
			</form.Field>
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
						hint="At least 8 characters with upper- and lower-case letters, a number and a symbol."
						secureTextEntry
						autoCapitalize="none"
						autoComplete="new-password"
						textContentType="newPassword"
					/>
				)}
			</form.Field>
			<Button label="Create account" onPress={submit} loading={signup.isPending} />
		</AuthPage>
	);
}
