"use client";

// The agent token and the command that starts the agent — shown once, after registering or rotating a
// server. Its own module: the server page shows it without loading the servers overview.

import type { OpsServerCredentials } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { toastMessage } from "@workspace/ui/components/toast";
import * as React from "react";

import { useCloseOnDismiss } from "../lib/use-ops-hooks";

/** Copies `text` and says so. */
function copyToClipboard(text: string): void {
	void navigator.clipboard.writeText(text).then((): void => {
		toastMessage.success({ title: "Copied" });
	});
}

export function AgentCredentials({ credentials, onClose }: { readonly credentials: OpsServerCredentials; readonly onClose: () => void }): React.JSX.Element {
	const handleOpenChange = useCloseOnDismiss(onClose);
	const copyToken = React.useCallback((): void => {
		copyToClipboard(credentials.agentToken);
	}, [credentials.agentToken]);
	const copyCommand = React.useCallback((): void => {
		copyToClipboard(credentials.installCommand);
	}, [credentials.installCommand]);
	return (
		<Dialog open onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Agent token for {credentials.server.name}</DialogTitle>
					<DialogDescription>This token is shown once. Start the agent on the server with the command below; it reports every 10 seconds.</DialogDescription>
				</DialogHeader>
				<div className="space-y-3">
					<div className="space-y-1">
						<Label>Token</Label>
						<div className="flex gap-2">
							<Input readOnly value={credentials.agentToken} className="font-mono text-xs" />
							<Button type="button" variant="outline" onClick={copyToken}>
								Copy
							</Button>
						</div>
					</div>
					<div className="space-y-1">
						<Label>Start command</Label>
						<pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">{credentials.installCommand}</pre>
						<Button type="button" variant="outline" onClick={copyCommand}>
							Copy command
						</Button>
					</div>
				</div>
				<DialogFooter>
					<Button type="button" onClick={onClose}>
						Done
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
