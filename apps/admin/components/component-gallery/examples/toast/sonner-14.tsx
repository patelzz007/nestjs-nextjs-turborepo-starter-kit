"use client";

import { Button } from "@workspace/ui/components/button";
import { toast, toastMessage } from "@workspace/ui/components/toast";
import type * as React from "react";

// An error toast whose description lists the failing files; "Retry Build" is the action.

interface BuildError {
	readonly location: string;
	readonly message: string;
}

const BUILD_ERRORS: readonly BuildError[] = [
	{ location: "src/api/auth.ts:42", message: "TypeError: undefined is not a function" },
	{ location: "src/utils/parse.ts:18", message: "SyntaxError: Unexpected token" },
];

const BUILD_ERROR_DESCRIPTION = (
	<>
		<span className="block">Compilation error in 2 files. Fix errors before deploying.</span>
		<span className="mt-2 flex flex-col gap-1 font-mono text-xs">
			{BUILD_ERRORS.map((error: BuildError): React.JSX.Element => (
				<span key={error.location}>
					{error.location} — {error.message}
				</span>
			))}
		</span>
	</>
);

function showBuildErrorToast(): void {
	const id = toastMessage.error({
		title: "Build Failed",
		description: BUILD_ERROR_DESCRIPTION,
		actionProps: {
			children: "Retry Build",
			onClick: (): void => {
				toast.close(id);
			},
		},
	});
}

export function Sonner14Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Button onClick={showBuildErrorToast} variant="outline" className="w-fit">
				Build Error Toast
			</Button>
		</div>
	);
}
