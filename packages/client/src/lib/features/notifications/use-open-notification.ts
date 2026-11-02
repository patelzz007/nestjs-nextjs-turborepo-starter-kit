"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { InAppNotificationResponse, NotificationSurface } from "@workspace/shared";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { apiRouter } from "../../api/endpoints";
import { useAuth } from "../../contexts/identity";
import { notificationLinkTarget } from "./notification-link";

const INBOX_SCOPE = apiRouter.notifications.inbox.scopeKey(undefined);

/**
 * Opening a notification: an unread one is marked read (everywhere, ADR 070), then its link is followed —
 * a page of this app (by path, or by a link to its own origin) in this tab, any other https page in a new one.
 */
export function useOpenNotification(surface: NotificationSurface): (notification: InAppNotificationResponse) => void {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const router = useRouter();
	const markRead = api.notifications.read.useMutation();

	return useCallback(
		(notification: InAppNotificationResponse): void => {
			if (notification.readAt === null) {
				markRead.mutate({ surface, notificationIds: [notification.id] }, { onSuccess: (): void => void queryClient.invalidateQueries({ queryKey: INBOX_SCOPE }) });
			}
			const target = notificationLinkTarget(notification.link, window.location.origin);
			if (target?.kind === "internal") {
				router.push(target.href);
			} else if (target?.kind === "external") {
				window.open(target.href, "_blank", "noopener,noreferrer");
			}
		},
		[markRead, queryClient, router, surface],
	);
}
