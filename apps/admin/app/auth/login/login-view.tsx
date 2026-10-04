import { LoginForm, type DemoAccount } from "@workspace/client/lib/auth/forms/login-form";
import Link from "next/link";

import { AdminAuthLayout } from "@/components/auth/admin-auth-layout";

export interface LoginViewProps {
	/** Safe, normalized in-app path to land on after a successful login (from `?redirect=`). */
	readonly redirectPath: string;
	/** Web app URL for the "returning to main website" footer link. */
	readonly webBaseUrl: string;
	/** Seeded demo logins to offer — empty outside development. */
	readonly demoAccounts: readonly DemoAccount[];
}

export function LoginView({ redirectPath, webBaseUrl, demoAccounts }: LoginViewProps): React.JSX.Element {
	return (
		<AdminAuthLayout
			icon="shield"
			tagline="Manage users, roles, and permissions from one secure place."
			features={["Role-based access control", "Audit & activity logs", "Enterprise-grade security"]}
			title="Admin Login"
			subtitle="Sign in with your administrator credentials">
			{/* The form renders immediately — the proxy handles redirect for
			    authenticated users before the client JS even loads. */}
			<LoginForm
				mode="admin"
				redirectPath={redirectPath}
				{...(demoAccounts.length > 0 ? { demoAccounts } : {})}
				footer={
					<p className="text-center text-xs text-balance text-muted-foreground">
						Returning to{" "}
						<Link href={webBaseUrl} className="font-medium text-primary underline-offset-4 hover:underline">
							main website
						</Link>
					</p>
				}
			/>
		</AdminAuthLayout>
	);
}
