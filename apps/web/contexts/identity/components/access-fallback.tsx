import { buttonVariants } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/core/utils";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty";
import { Lock, LogIn } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { loginPath } from "@/lib/routes";

export interface SignInPromptProps {
	readonly title: string;
	readonly description: string;
	/** Path to come back to after signing in. */
	readonly returnTo: string;
	readonly className?: string | undefined;
}

/** Guest fallback for a section that needs an account. */
export function SignInPrompt({ title, description, returnTo, className }: SignInPromptProps): React.JSX.Element {
	return (
		<Empty className={cn("border bg-card", className)}>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<LogIn className="size-5" aria-hidden="true" />
				</EmptyMedia>
				<EmptyTitle role="heading" aria-level={2}>
					{title}
				</EmptyTitle>
				<EmptyDescription>{description}</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Link href={loginPath(returnTo)} className={cn(buttonVariants())}>
					Sign in
				</Link>
			</EmptyContent>
		</Empty>
	);
}

export interface AccessUnavailableNoticeProps {
	readonly title: string;
	readonly description: string;
	readonly className?: string | undefined;
}

/** Signed-in fallback for a section the account's permissions do not cover. */
export function AccessUnavailableNotice({ title, description, className }: AccessUnavailableNoticeProps): React.JSX.Element {
	return (
		<Empty className={cn("border bg-card", className)}>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<Lock className="size-5" aria-hidden="true" />
				</EmptyMedia>
				<EmptyTitle role="heading" aria-level={2}>
					{title}
				</EmptyTitle>
				<EmptyDescription>{description}</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}

export interface FeatureUnavailableNoticeProps {
	/** Human label for the section ("your rewards"). */
	readonly feature: string;
	readonly className?: string | undefined;
}

/** The standard "your account can't see this" notice — rendered by `AccessGate` and by server pages whose API call answered 403. */
export function FeatureUnavailableNotice({ feature, className }: FeatureUnavailableNoticeProps): React.JSX.Element {
	return <AccessUnavailableNotice className={className} title="Not available for your account" description={`Your account doesn't have access to ${feature}.`} />;
}
