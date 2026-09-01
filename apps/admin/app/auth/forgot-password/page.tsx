import Link from "next/link";

import { Button } from "@workspace/ui/components/form/button";

/** `/auth/forgot-password` — fully server-rendered (no client hooks needed). */
export default function AdminForgotPasswordPage(): React.JSX.Element {
	return (
		<div className="flex min-h-svh items-center justify-center p-8">
			<div className="text-center">
				<h1 className="text-2xl font-bold tracking-tight">Forgot Password</h1>
				<p className="mt-2 text-sm text-muted-foreground">Password reset is coming soon.</p>
				<Button variant="outline" className="mt-6" render={<Link href="/auth/login" />}>
					Back to Login
				</Button>
			</div>
		</div>
	);
}
