"use client";

import { useAuth } from "@workspace/client/lib/contexts/identity";
import { UnsubscribeBodySchema, type NotificationCategory, type NotificationChannel, type UnsubscribeResponse } from "@workspace/shared";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import Link from "next/link";
import * as React from "react";

const CATEGORY_WORDS: Readonly<Record<NotificationCategory, string>> = {
	SECURITY: "security notices",
	ACCOUNT: "account messages",
	TRANSACTIONAL: "activity updates",
	PRODUCT: "product news",
	MARKETING: "offers",
	OPERATIONS: "operations alerts",
};

const CHANNEL_WORDS: Readonly<Record<NotificationChannel, string>> = { IN_APP: "in the app", EMAIL: "by email", PUSH: "on your phone", SMS: "by text" };

/** What stopped, in a sentence: "You won't get offers from Sunrise Cafe by email any more." */
export function describeUnsubscribe(result: UnsubscribeResponse): string {
	const from = result.tenantName === null ? "" : ` from ${result.tenantName}`;
	return `You won't get ${CATEGORY_WORDS[result.category]}${from} ${CHANNEL_WORDS[result.channel]} any more.`;
}

export interface UnsubscribeViewProps {
	/** The signed `?token=` from the email's footer. */
	readonly token: string | null;
	readonly settingsHref: string;
}

/**
 * The page an email's "Unsubscribe" link opens (ADR 070). It asks before acting: mail scanners open links,
 * so a visit alone must never unsubscribe anyone. The signed token is the authority; no sign-in is needed.
 */
export function UnsubscribeView({ token, settingsHref }: UnsubscribeViewProps): React.JSX.Element {
	const { api } = useAuth();
	const unsubscribe = api.notifications.unsubscribe.useMutation();
	const parsed = UnsubscribeBodySchema.safeParse({ token });
	const body = parsed.success ? parsed.data : null;
	const { mutate } = unsubscribe;
	const handleConfirm = React.useCallback((): void => {
		if (body !== null) {
			mutate(body);
		}
	}, [body, mutate]);

	if (body === null || unsubscribe.isError) {
		return (
			<div className="space-y-4" role="alert">
				<p className="text-sm text-muted-foreground">This unsubscribe link is not valid any more. You can still choose what reaches you in your notification settings.</p>
				<Link href={settingsHref} className={buttonVariants({ variant: "outline" })}>
					Notification settings
				</Link>
			</div>
		);
	}
	if (unsubscribe.isSuccess) {
		return (
			<div className="space-y-4" role="status">
				<p className="text-base font-medium text-foreground">Done.</p>
				<p className="text-sm text-muted-foreground">{describeUnsubscribe(unsubscribe.data.data)}</p>
				<Link href={settingsHref} className={buttonVariants({ variant: "outline" })}>
					Manage everything else
				</Link>
			</div>
		);
	}
	return (
		<div className="space-y-4">
			<p className="text-sm text-muted-foreground">Stop getting messages like the one you came from? You can turn them back on in your settings at any time.</p>
			<Button type="button" onClick={handleConfirm} disabled={unsubscribe.isPending}>
				{unsubscribe.isPending ? "Unsubscribing…" : "Unsubscribe"}
			</Button>
		</div>
	);
}
