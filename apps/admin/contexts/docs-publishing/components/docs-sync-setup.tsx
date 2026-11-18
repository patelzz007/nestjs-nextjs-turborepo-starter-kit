"use client";

import { useAbility } from "@workspace/client/lib/contexts/authorization";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import type { DocsSyncOverview } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { toastMessage } from "@workspace/ui/components/toast";
import { Copy, KeyRound } from "lucide-react";
import * as React from "react";

import { toastMutationError } from "@/lib/api/mutation-error";

interface SetupItem {
	readonly key: string;
	readonly label: string;
	readonly detail: string;
	readonly isReady: boolean;
}

/** What this server still needs, each in one line an operator can act on. */
function setupItems(overview: DocsSyncOverview): readonly SetupItem[] {
	return [
		{ key: "webhook", label: "Notion webhook", detail: "NOTION_WEBHOOK_SECRET verifies that page changes really came from Notion.", isReady: overview.webhookConfigured },
		{
			key: "dispatch",
			label: "Start a sync",
			detail: "DOCS_SYNC_GITHUB_TOKEN, _REPOSITORY and _REF let a change start the sync at once.",
			isReady: overview.dispatchConfigured,
		},
		{ key: "reporting", label: "Run reports", detail: "DOCS_SYNC_REPORT_TOKEN lets the sync report here.", isReady: overview.reportingConfigured },
	];
}

/** The verification token, once asked for. The operator pastes it into Notion, then sets NOTION_WEBHOOK_SECRET. */
function HandshakePanel(): React.JSX.Element {
	const { api } = useAuth();
	const ability = useAbility();
	const [token, setToken] = React.useState<string | null>(null);
	const reveal = api.docsPublishing.revealHandshake.useMutation({
		onSuccess: (result): void => {
			setToken(result.data.verificationToken);
		},
		onError: (error): void => {
			toastMutationError("Could not read the token", error);
		},
	});
	const { mutate } = reveal;
	const handleReveal = React.useCallback((): void => {
		mutate({});
	}, [mutate]);
	const handleCopy = React.useCallback((): void => {
		if (token === null) {
			return;
		}
		void navigator.clipboard.writeText(token).then(() => {
			toastMessage.success({ title: "Token copied" });
		});
	}, [token]);

	return (
		<div className="rounded-lg border bg-muted/40 p-4">
			<p className="text-sm font-medium">Notion sent a verification token</p>
			<p className="mt-1 text-sm text-muted-foreground">
				Paste it into Notion to activate the webhook, then set it as NOTION_WEBHOOK_SECRET on this server. It is kept for an hour.
			</p>
			{token === null ? (
				<Button variant="outline" size="sm" className="mt-3 gap-1.5" disabled={ability.cannot("READ", "DOCS_SYNC") || reveal.isPending} onClick={handleReveal}>
					<KeyRound className="size-3.5" aria-hidden />
					Show token
				</Button>
			) : (
				<div className="mt-3 flex flex-wrap items-center gap-2">
					<code className="min-w-0 rounded-md border bg-background px-2 py-1 font-mono text-xs break-all">{token}</code>
					<Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopy}>
						<Copy className="size-3.5" aria-hidden />
						Copy
					</Button>
				</div>
			)}
		</div>
	);
}

/** What is set up on this server: the docs site keeps working without any of it. */
export function DocsSyncSetup({ overview }: { readonly overview: DocsSyncOverview }): React.JSX.Element {
	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-base">Setup</CardTitle>
				<CardDescription>The scheduled sync runs without these. They make publishing immediate and visible here.</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				{overview.handshakePending ? <HandshakePanel /> : null}
				<ul className="divide-y">
					{setupItems(overview).map((item) => (
						<li key={item.key} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
							<div className="min-w-0">
								<p className="text-sm font-medium">{item.label}</p>
								<p className="text-xs text-muted-foreground">{item.detail}</p>
							</div>
							<StatusBadge tone={item.isReady ? "success" : "neutral"}>{item.isReady ? "Ready" : "Not set"}</StatusBadge>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
