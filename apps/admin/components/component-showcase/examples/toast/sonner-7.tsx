"use client";

import { Button } from "@workspace/ui/components/button";
import { toastMessage } from "@workspace/ui/components/toast";
import type * as React from "react";

/** How long the simulated deployment takes (ms). */
const DEPLOY_DURATION_MS = 2000;

interface Deployment {
	readonly environment: string;
}

/** A stand-in for a real deploy call: resolves after a delay, no network involved. */
function simulateDeploy(): Promise<Deployment> {
	return new Promise((resolve: (deployment: Deployment) => void): void => {
		window.setTimeout((): void => {
			resolve({ environment: "production" });
		}, DEPLOY_DURATION_MS);
	});
}

// String options render as the toast's description: the promise options are typed
// as full toast objects (with a required `id`), so a title cannot be set here.
function handleDeploy(): void {
	void toastMessage.promise(simulateDeploy(), {
		loading: "Deploying to production...",
		success: (deployment: Deployment): string => `Deployed to ${deployment.environment} successfully`,
		error: "Deployment failed. Please try again.",
	});
}

export function Sonner7Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Button onClick={handleDeploy} variant="outline" className="w-fit">
				Deploy
			</Button>
		</div>
	);
}
