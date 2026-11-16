import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { useToast } from "../../../toast/facade";

/** How long the simulated deployment takes. */
const DEPLOY_DURATION_MS = 2_000;

interface Deployment {
	readonly environment: string;
}

/** A stand-in for a real deploy call: resolves after a delay, no network involved. */
function simulateDeploy(): Promise<Deployment> {
	return new Promise((resolve: (deployment: Deployment) => void): void => {
		setTimeout((): void => {
			resolve({ environment: "production" });
		}, DEPLOY_DURATION_MS);
	});
}

export function Sonner7Example(): React.JSX.Element {
	const toast = useToast();
	const deploy = React.useCallback((): void => {
		toast
			.promise(simulateDeploy(), {
				loading: "Deploying to production…",
				success: (deployment: Deployment): string => `Deployed to ${deployment.environment} successfully`,
				error: "Deployment failed. Please try again.",
			})
			.catch((): void => {
				// The toast already says the deploy failed.
			});
	}, [toast]);
	return <Button label="Deploy" variant="outline" onPress={deploy} className="self-center" />;
}
