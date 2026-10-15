// ============================================
// The admin's GitHub token (ADR 052) — link, replace or remove it
// ============================================
// What the link is (account, expiry, or that GitHub stopped accepting it),
// what a token needs (fine-grained, with the permissions listed), a button to
// GitHub's page that creates one, and the token field — validated with the
// same shared schema the API checks. The token is sent once and never shown
// again; the API checks it with GitHub before storing it.

import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { LinkGithubAccountSchema, type GithubAccountStatus } from "@workspace/shared";
import * as React from "react";
import { Linking, Text, View } from "react-native";

import { Avatar } from "../../components/avatar";
import { Banner } from "../../components/banner";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { Screen } from "../../components/screen";
import { SkeletonGroup, SkeletonText } from "../../components/skeleton";
import { ErrorState } from "../../components/states";
import { MutedText } from "../../components/text";
import { TextField } from "../../components/text-field";
import { useApi } from "../../lib/api-context";
import { errorMessageOf } from "../../lib/error-messages";
import { visibleFieldError } from "../../lib/form";
import { useNow } from "../../lib/use-now";
import { useToast } from "../toast/facade";
import { accountSummary, REQUIRED_TOKEN_PERMISSIONS, TOKEN_LINKED_MESSAGE, TOKEN_UNLINKED_MESSAGE } from "./labels";
import { refreshAllPullRequests } from "./refresh";

/** GitHub's page that creates a fine-grained personal access token. */
export const GITHUB_NEW_TOKEN_URL = "https://github.com/settings/personal-access-tokens/new";
export const OPEN_GITHUB_TOKENS_FAILED_MESSAGE = "Couldn't open GitHub. Create the token on github.com and paste it here.";

/** "Linked as … 3 days ago" is re-read this often. */
const RELATIVE_TIME_REFRESH_MS = 60_000;

export function GithubAccountScreen(): React.JSX.Element {
	const api = useApi();
	const account = api.githubPullRequests.account.useQuery(undefined);
	const nowMs = useNow({ intervalMs: RELATIVE_TIME_REFRESH_MS, running: true });
	const retry = React.useCallback((): void => {
		void account.refetch();
	}, [account]);
	return (
		<Screen refreshing={account.isRefetching} onRefresh={retry} testID="github-account">
			{account.isPending ? (
				<SkeletonGroup accessibilityLabel="Loading your GitHub token" className="gap-3">
					<SkeletonText size="lg" widthClassName="w-2/3" />
					<SkeletonText size="sm" widthClassName="w-full" />
				</SkeletonGroup>
			) : null}
			{account.isError ? <ErrorState message={errorMessageOf(account.error)} retryLabel="Try again" onRetry={retry} /> : null}
			{account.data === undefined ? null : <AccountView status={account.data.data} nowMs={nowMs} />}
		</Screen>
	);
}

function AccountView({ status, nowMs }: { readonly status: GithubAccountStatus; readonly nowMs: number }): React.JSX.Element {
	if (status.status === "off") {
		return <Banner tone="info" message={accountSummary(status, nowMs)} />;
	}
	return (
		<>
			{status.status === "linked" ? <LinkedAccount status={status} nowMs={nowMs} /> : <MutedText>{accountSummary(status, nowMs)}</MutedText>}
			<LinkTokenForm replacing={status.status === "linked"} />
		</>
	);
}

/** The account the token belongs to, and removing the token. */
function LinkedAccount({ status, nowMs }: { readonly status: Extract<GithubAccountStatus, { readonly status: "linked" }>; readonly nowMs: number }): React.JSX.Element {
	const api = useApi();
	const queryClient = useQueryClient();
	const toast = useToast();
	const unlink = api.githubPullRequests.unlinkAccount.useMutation();
	const [confirming, setConfirming] = React.useState(false);
	const [unlinkError, setUnlinkError] = React.useState<string | null>(null);
	const ask = React.useCallback((): void => {
		setUnlinkError(null);
		setConfirming(true);
	}, []);
	const cancel = React.useCallback((): void => {
		setConfirming(false);
	}, []);
	const confirm = React.useCallback((): void => {
		unlink
			.mutateAsync(undefined)
			.then(async (): Promise<void> => {
				setConfirming(false);
				toast.success(TOKEN_UNLINKED_MESSAGE);
				await refreshAllPullRequests(queryClient);
			})
			.catch((error: unknown): void => {
				setUnlinkError(errorMessageOf(error instanceof Error ? error : null));
			});
	}, [queryClient, toast, unlink]);
	return (
		<Card>
			<View className="flex-row items-center gap-3">
				<Avatar name={status.login} imageUrl={status.avatarUrl} size="md" />
				<Text className="font-sans-semibold flex-1 text-base text-foreground">{status.login}</Text>
			</View>
			{status.health === "rejected" ? <Banner tone="error" message={accountSummary(status, nowMs)} /> : <MutedText>{accountSummary(status, nowMs)}</MutedText>}
			<Button label="Remove token" variant="destructive" onPress={ask} accessibilityHint="Forgets your GitHub token on the server" />
			<ConfirmDialog
				visible={confirming}
				title="Remove your GitHub token?"
				description="The server forgets it. You can link a token again at any time."
				confirmLabel="Remove"
				cancelLabel="Keep"
				onConfirm={confirm}
				onCancel={cancel}
				pending={unlink.isPending}
				error={unlinkError}
				destructive
			/>
		</Card>
	);
}

/** The token field; on success the field clears and every pull-request view reloads. */
function LinkTokenForm({ replacing }: { readonly replacing: boolean }): React.JSX.Element {
	const api = useApi();
	const queryClient = useQueryClient();
	const toast = useToast();
	const link = api.githubPullRequests.linkAccount.useMutation();
	const [requestError, setRequestError] = React.useState<string | null>(null);
	const [openFailed, setOpenFailed] = React.useState(false);
	const form = useForm({
		defaultValues: { personalAccessToken: "" },
		validators: { onChange: LinkGithubAccountSchema },
		onSubmit: async ({ value, formApi }): Promise<void> => {
			setRequestError(null);
			try {
				await link.mutateAsync(LinkGithubAccountSchema.parse(value));
				formApi.reset();
				toast.success(TOKEN_LINKED_MESSAGE);
				await refreshAllPullRequests(queryClient);
			} catch (error) {
				setRequestError(errorMessageOf(error instanceof Error ? error : null));
			}
		},
	});
	const submit = React.useCallback((): void => {
		void form.handleSubmit();
	}, [form]);
	const openGithub = React.useCallback((): void => {
		setOpenFailed(false);
		Linking.openURL(GITHUB_NEW_TOKEN_URL).catch((): void => {
			setOpenFailed(true);
		});
	}, []);
	return (
		<Card title={replacing ? "Replace the token" : "Link a token"} description="A fine-grained personal access token, for the repositories you want here, with:">
			<View className="gap-1">
				{REQUIRED_TOKEN_PERMISSIONS.map((permission: string): React.JSX.Element => (
					<Text key={permission} className="font-sans text-sm text-foreground">
						{`• ${permission}`}
					</Text>
				))}
			</View>
			<Button label="Create a token on GitHub" variant="secondary" onPress={openGithub} accessibilityHint="Opens GitHub's token settings in your browser" />
			{openFailed ? <Banner tone="warning" message={OPEN_GITHUB_TOKENS_FAILED_MESSAGE} /> : null}
			{requestError === null ? null : <Banner tone="error" message={requestError} />}
			<form.Field name="personalAccessToken">
				{(field): React.JSX.Element => (
					<TextField
						label="Personal access token"
						value={field.state.value}
						onChange={field.handleChange}
						onBlur={field.handleBlur}
						error={visibleFieldError(field.state.meta)}
						placeholder="github_pat_…"
						secureTextEntry
						autoCapitalize="none"
						autoCorrect={false}
						returnKeyType="done"
						onSubmitEditing={submit}
						testID="github-token-field"
					/>
				)}
			</form.Field>
			<Button label={replacing ? "Replace token" : "Link token"} onPress={submit} loading={link.isPending} testID="github-token-submit" />
		</Card>
	);
}
