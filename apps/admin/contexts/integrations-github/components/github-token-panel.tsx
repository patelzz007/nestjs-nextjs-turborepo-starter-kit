"use client";

import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { initialDataOption } from "@workspace/client/lib/api/envelope";
import { resolveAuthErrorMessage } from "@workspace/client/lib/api/error-messages";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { GITHUB_NEW_TOKEN_URL, GITHUB_TOKEN_REQUIRED_PERMISSIONS, LinkGithubAccountSchema, type Envelope, type GithubAccountStatus } from "@workspace/shared";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Badge } from "@workspace/ui/components/badge";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { toastMessage } from "@workspace/ui/components/toast";
import { cn } from "@workspace/ui/lib/core/utils";
import { ExternalLink } from "lucide-react";
import * as React from "react";

import { useResourceDeleteDialog } from "@/components/common/resource-delete-dialog";
import { TextField, useFormSubmitHandler } from "@/components/common/form-fields";
import { GithubTokenPageSkeleton } from "@/components/loading/account-skeletons";
import { githubTokenSummary, TOKEN_LINKED_MESSAGE, TOKEN_UNLINKED_MESSAGE } from "@/contexts/integrations-github/lib/github-token-copy";
import { toastMutationError } from "@/lib/api/mutation-error";

export interface GithubTokenPanelProps {
	/** The server-prefetched `GET /github/account` envelope, or `undefined` when the client should load it. */
	readonly initialAccount?: Envelope<GithubAccountStatus> | undefined;
}

/**
 * `/account/github` — the signed-in admin's own GitHub token (ADR 052), the same link the phone's
 * Profile → GitHub token screen manages: what is linked, the token's required permissions, a link
 * to GitHub's token page, the token field (checked with the shared schema the API checks), and
 * removing the token. The token is sent once and never shown again.
 */
export function GithubTokenPanel({ initialAccount }: GithubTokenPanelProps): React.JSX.Element {
	const { api } = useAuth();
	const accountQuery = api.githubPullRequests.account.useQuery(undefined, initialDataOption(initialAccount));
	const status = accountQuery.data?.data;

	if (status === undefined) {
		return accountQuery.isError ? (
			<p role="alert" className="text-sm text-destructive">
				{resolveAuthErrorMessage(accountQuery.error)}
			</p>
		) : (
			<GithubTokenPageSkeleton />
		);
	}
	if (status.status === "off") {
		return (
			<Alert variant="info">
				<AlertDescription>{githubTokenSummary(status)}</AlertDescription>
			</Alert>
		);
	}
	return (
		<div className="grid items-start gap-6 lg:grid-cols-2">
			{status.status === "linked" ? <LinkedTokenCard status={status} /> : <UnlinkedTokenCard status={status} />}
			<LinkTokenCard replacing={status.status === "linked"} />
		</div>
	);
}

/** Every view that reads the link or the pull requests it opens, refreshed after a change. */
function useRefreshGithubAccount(): () => Promise<void> {
	const queryClient = useQueryClient();
	return React.useCallback(async (): Promise<void> => {
		await queryClient.invalidateQueries({ queryKey: apiRouter.githubPullRequests.account.scopeKey(undefined) });
	}, [queryClient]);
}

function UnlinkedTokenCard({ status }: { readonly status: Extract<GithubAccountStatus, { readonly status: "unlinked" }> }): React.JSX.Element {
	return (
		<Card>
			<CardHeader>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<CardTitle className="text-lg">GitHub token</CardTitle>
					<Badge variant="secondary">Not linked</Badge>
				</div>
				<CardDescription>{githubTokenSummary(status)}</CardDescription>
			</CardHeader>
		</Card>
	);
}

/** The account the token belongs to, and removing the token. */
function LinkedTokenCard({ status }: { readonly status: Extract<GithubAccountStatus, { readonly status: "linked" }> }): React.JSX.Element {
	const { api } = useAuth();
	const refresh = useRefreshGithubAccount();
	const unlink = api.githubPullRequests.unlinkAccount.useMutation({
		onError: (error): void => {
			toastMutationError("Token not removed", error);
		},
	});
	const { mutateAsync: unlinkAccount } = unlink;
	const { requestDelete, resourceDeleteDialog } = useResourceDeleteDialog();
	const rejected = status.health === "rejected";

	const handleRemove = React.useCallback((): void => {
		void requestDelete({
			title: "Remove your GitHub token?",
			description: "The server forgets it. You can link a token again at any time.",
			// A failed removal rejects, so the dialog stays open (the mutation's `onError` already said why).
			onConfirm: async (): Promise<void> => {
				await unlinkAccount(undefined);
				toastMessage.success({ title: TOKEN_UNLINKED_MESSAGE });
				await refresh();
			},
		});
	}, [refresh, requestDelete, unlinkAccount]);

	return (
		<Card>
			<CardHeader>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<CardTitle className="text-lg">{status.login}</CardTitle>
					<Badge variant={rejected ? "destructive" : "default"}>{rejected ? "Needs a new token" : "Linked"}</Badge>
				</div>
				<CardDescription>{githubTokenSummary(status)}</CardDescription>
			</CardHeader>
			<CardContent>
				<Button type="button" variant="destructive" onClick={handleRemove} disabled={unlink.isPending}>
					Remove token
				</Button>
				{resourceDeleteDialog}
			</CardContent>
		</Card>
	);
}

/** The token field; on success the field clears and the link above reloads. */
function LinkTokenCard({ replacing }: { readonly replacing: boolean }): React.JSX.Element {
	const { api } = useAuth();
	const refresh = useRefreshGithubAccount();
	const link = api.githubPullRequests.linkAccount.useMutation({
		onError: (error): void => {
			toastMutationError("Token not linked", error);
		},
	});
	const { mutate: linkAccount } = link;
	const form = useForm({
		defaultValues: { personalAccessToken: "" },
		validators: { onChange: LinkGithubAccountSchema },
		onSubmit: ({ value, formApi }): void => {
			linkAccount(LinkGithubAccountSchema.parse(value), {
				onSuccess: (): void => {
					formApi.reset();
					toastMessage.success({ title: TOKEN_LINKED_MESSAGE });
					void refresh();
				},
			});
		},
	});
	const submit = React.useCallback((): Promise<void> => form.handleSubmit(), [form]);
	const handleFormSubmit = useFormSubmitHandler(submit);

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-lg">{replacing ? "Replace the token" : "Link a token"}</CardTitle>
				<CardDescription>A fine-grained personal access token, for the repositories you want here, with:</CardDescription>
			</CardHeader>
			<CardContent className="space-y-5">
				<ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
					{GITHUB_TOKEN_REQUIRED_PERMISSIONS.map((permission: string): React.JSX.Element => (
						<li key={permission}>{permission}</li>
					))}
				</ul>
				<a href={GITHUB_NEW_TOKEN_URL} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "outline" }))}>
					<ExternalLink className="size-4" aria-hidden="true" />
					Create a token on GitHub
				</a>
				<form noValidate className="space-y-4" onSubmit={handleFormSubmit}>
					<form.Field name="personalAccessToken">
						{(field) => (
							<TextField
								id="github-personal-access-token"
								label="Personal access token"
								type="password"
								value={field.state.value}
								onChange={field.handleChange}
								onBlur={field.handleBlur}
								errors={field.state.meta.isTouched ? field.state.meta.errors : []}
								placeholder="github_pat_…"
							/>
						)}
					</form.Field>
					<Button type="submit" disabled={link.isPending}>
						{link.isPending ? "Checking with GitHub…" : replacing ? "Replace token" : "Link token"}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
