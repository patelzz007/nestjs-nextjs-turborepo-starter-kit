"use client";

import { Button } from "@workspace/ui/components/button";
import * as React from "react";
import { useCallback } from "react";

export default function AdminForgotPasswordPage(): React.JSX.Element {
	const handleBackToLogin = useCallback((): void => {
		window.location.href = "/auth/login";
	}, []);

	return (
		<div className="flex min-h-svh items-center justify-center p-8">
			<div className="text-center">
				<h1 className="text-2xl font-bold tracking-tight">Forgot Password</h1>
				<p className="mt-2 text-sm text-muted-foreground">Password reset is coming soon.</p>
				<Button variant="outline" className="mt-6" onClick={handleBackToLogin}>
					Back to Login
				</Button>
			</div>
		</div>
	);
}
