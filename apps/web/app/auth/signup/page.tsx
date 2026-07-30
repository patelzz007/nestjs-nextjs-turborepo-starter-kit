"use client";

import { Button } from "@workspace/ui/components/button";

export default function SignupPage() {
	return (
		<div className="flex min-h-svh items-center justify-center p-8">
			<div className="text-center">
				<h1 className="text-2xl font-bold tracking-tight">Sign Up</h1>
				<p className="mt-2 text-sm text-muted-foreground">Registration is coming soon.</p>
				<Button variant="outline" className="mt-6" onClick={() => (window.location.href = "/auth/login")}>
					Back to Login
				</Button>
			</div>
		</div>
	);
}
