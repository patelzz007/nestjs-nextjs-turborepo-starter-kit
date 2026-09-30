import { WebEmptyState } from "@/components/web-ui/empty-state";
import { buttonVariants } from "@workspace/ui/components/form/button";
import { cn } from "@workspace/ui/lib/core/utils";
import { Lock, LogIn } from "lucide-react";
import Link from "next/link";
import * as React from "react";

/** Login URL that returns the visitor to `returnTo` after signing in. */
export function buildSignInHref(returnTo: string): string {
	return `/auth/login?redirect=${encodeURIComponent(returnTo)}`;
}

export interface SignInPromptProps {
	readonly title: string;
	readonly description: string;
	/** Path to come back to after signing in. */
	readonly returnTo: string;
	readonly className?: string;
}

/** Guest fallback for a section that needs an account. */
export function SignInPrompt({ title, description, returnTo, className }: SignInPromptProps): React.JSX.Element {
	return (
		<WebEmptyState
			className={className}
			title={title}
			description={description}
			icon={<LogIn className="size-5" aria-hidden="true" />}
			action={
				<Link href={buildSignInHref(returnTo)} className={cn(buttonVariants())}>
					Sign in
				</Link>
			}
		/>
	);
}

export interface AccessUnavailableNoticeProps {
	readonly title: string;
	readonly description: string;
	readonly className?: string;
}

/** Signed-in fallback for a section the account's permissions do not cover. */
export function AccessUnavailableNotice({ title, description, className }: AccessUnavailableNoticeProps): React.JSX.Element {
	return <WebEmptyState className={className} title={title} description={description} icon={<Lock className="size-5" aria-hidden="true" />} />;
}
