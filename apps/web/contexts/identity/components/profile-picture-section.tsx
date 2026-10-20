"use client";

import { useAuth } from "@workspace/client/lib/contexts/identity";
import { resolveAuthErrorMessage } from "@workspace/client/lib/api/error-messages";
import { ProfileAvatarEditor } from "@workspace/client/lib/contexts/identity/profile/profile-avatar-editor";
import { useOwnProfile } from "@workspace/client/lib/contexts/identity/profile/use-own-profile";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { toastMessage } from "@workspace/ui/components/toast";
import * as React from "react";

function showSuccess(title: string): void {
	toastMessage.success({ title });
}

function showError(title: string, error: Error): void {
	toastMessage.error({ title, description: resolveAuthErrorMessage(error) });
}

/** The picture's place while the profile (or the session's scope) loads. */
function ProfilePictureSkeleton(): React.JSX.Element {
	return (
		<div className="flex items-center gap-4" aria-hidden="true" data-slot="profile-picture-skeleton">
			<Skeleton className="size-16 rounded-full" />
			<div className="space-y-2">
				<Skeleton className="h-8 w-32" />
				<Skeleton variant="text" className="h-3 w-64 max-w-full" />
			</div>
		</div>
	);
}

/** Loads the own profile (only on a full session — a restricted one may not read it) and edits its picture. */
function ProfilePictureEditor({ isImpersonating }: { readonly isImpersonating: boolean }): React.JSX.Element {
	const profileQuery = useOwnProfile();
	const profile = profileQuery.data?.data;

	if (profile !== undefined) {
		return <ProfileAvatarEditor profile={profile} isReadOnly={isImpersonating} onSuccess={showSuccess} onError={showError} />;
	}
	if (profileQuery.isError) {
		return (
			<p role="alert" className="text-sm text-destructive">
				Could not load your profile picture. Reload the page to try again.
			</p>
		);
	}
	return <ProfilePictureSkeleton />;
}

/**
 * The member's own profile picture on `/dashboard/account`: upload (any photo
 * that is not square is cropped first), replace or remove it. Read-only while
 * an admin impersonates the account. A restricted session (email or two-factor
 * setup pending — which lands on this page) is told to finish that first: the
 * API refuses it the profile until then. Smart: owns the queries and the toasts.
 */
export function ProfilePictureSection(): React.JSX.Element {
	const { api, user } = useAuth();
	const sessionQuery = api.auth.permissions.useQuery(undefined);
	const isImpersonating = sessionQuery.data?.data.isImpersonating === true;
	const sessionScope = user?.sessionScope ?? "pending";

	return (
		<section className="space-y-4 rounded-xl border bg-card p-6" aria-labelledby="profile-picture-heading">
			<div>
				<h2 id="profile-picture-heading" className="text-lg font-semibold">
					Profile picture
				</h2>
				<p className="text-sm text-muted-foreground">
					{isImpersonating ? "You are impersonating this user: the profile picture is read-only." : "Shown with your name while you are signed in."}
				</p>
			</div>
			{sessionScope === "full" ? (
				<ProfilePictureEditor isImpersonating={isImpersonating} />
			) : sessionScope === "restricted" ? (
				<p className="text-sm text-muted-foreground">You can set your profile picture once you have finished securing your account below.</p>
			) : (
				<ProfilePictureSkeleton />
			)}
		</section>
	);
}
