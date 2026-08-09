"use client";

import { Button } from "@workspace/ui/components/button";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useCallback } from "react";

export default function SignupPage(): React.JSX.Element {
	const router = useRouter();

	const handleBackToLogin = useCallback((): void => {
		router.push("/auth/login");
	}, [router]);

	return (
		<div className="flex min-h-svh items-center justify-center p-8">
			<div className="text-center">
				<h1 className="text-2xl font-bold tracking-tight">Sign Up</h1>
				<p className="mt-2 text-sm text-muted-foreground">Registration is coming soon.</p>
				<Button variant="outline" className="mt-6" onClick={handleBackToLogin}>
					Back to Login
				</Button>
			</div>
		</div>
	);
}
