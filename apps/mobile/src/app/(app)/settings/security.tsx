// ============================================
// Security (§10.10) — the same capabilities as the web security panel
// ============================================
// Change password, two-factor authentication, backup codes, signed-in devices
// and sign out everywhere, on the same endpoints. The API has no "turn 2FA
// off" endpoint (the web offers none either), so an enabled 2FA shows as on.

import { useForm } from "@tanstack/react-form";
import { ChangePasswordSchema, type ChangePasswordInput } from "@workspace/shared";
import { useRouter } from "expo-router";
import * as React from "react";

import { Badge } from "../../../components/badge";
import { Banner } from "../../../components/banner";
import { Button } from "../../../components/button";
import { Card } from "../../../components/card";
import { ListRow } from "../../../components/list-row";
import { Screen } from "../../../components/screen";
import { ErrorState, LoadingState } from "../../../components/states";
import { MutedText } from "../../../components/text";
import { TextField } from "../../../components/text-field";
import { SignOutEverywhere } from "../../../features/devices/sign-out-everywhere";
import { useSessionCommands } from "../../../features/session/facade";
import { backupCodesNotice } from "../../../features/two-factor/backup-codes-status";
import { useApi } from "../../../lib/api-context";
import { errorMessageOf } from "../../../lib/error-messages";
import { visibleFieldError } from "../../../lib/form";
import { ROUTES } from "../../../runtime/routes";
import { useReadyRuntime } from "../../../runtime/runtime-context";

const EMPTY_PASSWORD_CHANGE: ChangePasswordInput = { currentPassword: "", newPassword: "", confirmPassword: "" };

export default function SecurityScreen(): React.JSX.Element {
	const api = useApi();
	const router = useRouter();
	const me = api.auth.me.useQuery(undefined);
	const twoFactorEnabled = me.data?.data.twoFactorEnabled === true;
	const remaining = api.auth.twoFactorBackupCodesRemaining.useQuery(undefined, { enabled: twoFactorEnabled });

	const refetch = React.useCallback((): void => {
		void me.refetch();
	}, [me]);
	const openTwoFactorSetup = React.useCallback((): void => {
		router.push({ pathname: ROUTES.twoFactorSetup, params: { mode: "setup" } });
	}, [router]);
	const openBackupCodeRotation = React.useCallback((): void => {
		router.push({ pathname: ROUTES.twoFactorSetup, params: { mode: "rotate" } });
	}, [router]);
	const openDevices = React.useCallback((): void => {
		router.push(ROUTES.devices);
	}, [router]);

	const remainingCount = remaining.data?.data.remaining ?? null;
	const lowCodesNotice = remainingCount === null ? null : backupCodesNotice(remainingCount);

	return (
		<Screen title="Security" refreshing={me.isRefetching} onRefresh={refetch}>
			<Card title="Change password" description="Changing your password signs out every device, including this one.">
				<ChangePasswordForm />
			</Card>
			<Card title="Two-factor authentication" description="Protect your account with a code from an authenticator app.">
				{me.isPending ? <LoadingState label="Loading…" /> : null}
				{me.isError ? <ErrorState message={errorMessageOf(me.error)} retryLabel="Try again" onRetry={refetch} /> : null}
				{me.data === undefined ? null : twoFactorEnabled ? (
					<>
						<Badge label="On" tone="success" />
						{remainingCount === null ? null : <MutedText>{`${String(remainingCount)} unused backup ${remainingCount === 1 ? "code" : "codes"} remaining.`}</MutedText>}
						{lowCodesNotice === null ? null : <Banner tone="warning" message={lowCodesNotice} />}
						<Button label="Generate new backup codes" variant="secondary" onPress={openBackupCodeRotation} />
					</>
				) : (
					<>
						<Badge label="Off" />
						<Button label="Turn on two-factor authentication" onPress={openTwoFactorSetup} />
					</>
				)}
			</Card>
			<Card title="Devices">
				<ListRow label="Signed-in devices" description="See and sign out the devices on your account" onPress={openDevices} />
				<SignOutEverywhere />
			</Card>
		</Screen>
	);
}

/** Current + new password with the shared schema; success signs this device out (the API revokes every session). */
function ChangePasswordForm(): React.JSX.Element {
	const api = useApi();
	const { tokenProvider } = useReadyRuntime();
	const session = useSessionCommands();
	const changePassword = api.auth.changePassword.useMutation();
	const [requestError, setRequestError] = React.useState<string | null>(null);

	const form = useForm({
		defaultValues: EMPTY_PASSWORD_CHANGE,
		validators: { onChange: ChangePasswordSchema },
		onSubmit: async ({ value }): Promise<void> => {
			setRequestError(null);
			try {
				await changePassword.mutateAsync(ChangePasswordSchema.parse(value));
			} catch (error) {
				setRequestError(errorMessageOf(error instanceof Error ? error : null));
				return;
			}
			await tokenProvider.clearTokens();
			session.signedOut("passwordChanged");
		},
	});
	const submit = React.useCallback((): void => {
		void form.handleSubmit();
	}, [form]);

	return (
		<>
			{requestError === null ? null : <Banner tone="error" message={requestError} />}
			<form.Field name="currentPassword">
				{(field): React.JSX.Element => (
					<TextField
						label="Current password"
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
			<form.Field name="newPassword">
				{(field): React.JSX.Element => (
					<TextField
						label="New password"
						value={field.state.value}
						onChange={field.handleChange}
						onBlur={field.handleBlur}
						error={visibleFieldError(field.state.meta)}
						secureTextEntry
						autoCapitalize="none"
						autoComplete="new-password"
						textContentType="newPassword"
					/>
				)}
			</form.Field>
			<form.Field name="confirmPassword">
				{(field): React.JSX.Element => (
					<TextField
						label="Confirm new password"
						value={field.state.value}
						onChange={field.handleChange}
						onBlur={field.handleBlur}
						error={visibleFieldError(field.state.meta)}
						secureTextEntry
						autoCapitalize="none"
						autoComplete="new-password"
						textContentType="newPassword"
					/>
				)}
			</form.Field>
			<Button label="Change password" onPress={submit} loading={changePassword.isPending} />
		</>
	);
}
