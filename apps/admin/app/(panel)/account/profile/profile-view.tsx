"use client";

import { useAuth } from "@workspace/client/lib/auth";
import { ApiError } from "@workspace/client/lib/api/api-request";
import { ProfileAvatarEditor } from "@workspace/client/lib/auth/profile/profile-avatar-editor";
import { useOwnProfile, useUpdateOwnProfile } from "@workspace/client/lib/auth/profile/use-own-profile";
import { ApiErrorCodes, OWN_PROFILE_ERROR_CODES, type Envelope, type OwnProfile, type OwnProfileEditableFields } from "@workspace/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { toastMessage } from "@workspace/ui/components/toast";
import * as React from "react";

import { ProfileForm } from "@/components/account/profile-form";
import { ProfilePageSkeleton } from "@/components/loading/account-skeletons";
import { toastMutationError, type MutationErrorMessages } from "@/lib/api/mutation-error";

/** Messages for the codes `PATCH /auth/profile` can answer besides the standard ones. */
export const UPDATE_PROFILE_ERROR_MESSAGES: MutationErrorMessages = {
	[ApiErrorCodes.CONFLICT]: "Your profile was changed elsewhere while you were editing. The latest version is loaded — review it and save again.",
	[OWN_PROFILE_ERROR_CODES.PROFILE_UPDATE_DURING_IMPERSONATION]: "You are impersonating this user: their profile can be viewed but not changed.",
};

export interface ProfileViewProps {
	/** The server-prefetched `GET /auth/profile` envelope, or `undefined` when the client should load it. */
	readonly initialProfile?: Envelope<OwnProfile> | undefined;
}

/**
 * Avatar failures: an API error goes through the shared code → message map;
 * the client's typed upload failures (bad file, storage unreachable / CORS,
 * scan refused or still running) already carry a user-facing message.
 */
export function toastAvatarError(title: string, error: Error): void {
	if (error instanceof ApiError) {
		toastMutationError(title, error);
		return;
	}
	toastMessage.error({ title, description: error.message });
}

function showAvatarSuccess(title: string): void {
	toastMessage.success({ title });
}

function ProfileAvatar({ profile, isReadOnly }: { readonly profile: OwnProfile; readonly isReadOnly: boolean }): React.JSX.Element {
	return (
		<div className="space-y-2">
			<ProfileAvatarEditor profile={profile} isReadOnly={isReadOnly} onSuccess={showAvatarSuccess} onError={toastAvatarError} />
			<p className="truncate text-sm text-muted-foreground">{profile.email}</p>
		</div>
	);
}

/** `/account/profile` — the signed-in admin's own profile (smart: owns the query, the mutation and the toasts). */
export function ProfileView({ initialProfile }: ProfileViewProps): React.JSX.Element {
	const { api } = useAuth();
	const profileQuery = useOwnProfile(initialProfile);
	const sessionQuery = api.auth.permissions.useQuery(undefined);
	const isImpersonating = sessionQuery.data?.data.isImpersonating === true;
	const updateProfile = useUpdateOwnProfile({
		onSuccess: (profile: OwnProfile): void => {
			toastMessage.success({ title: "Profile saved", description: profile.fullName });
		},
		onError: (error: Error): void => {
			toastMutationError("Could not save your profile", error, UPDATE_PROFILE_ERROR_MESSAGES);
		},
	});
	const profile = profileQuery.data?.data;

	const handleSubmit = React.useCallback(
		(values: OwnProfileEditableFields): void => {
			if (profile === undefined) {
				return;
			}
			// The version the form was loaded at: the API refuses the write if the profile changed since.
			updateProfile.mutate({ ...values, version: profile.version });
		},
		[profile, updateProfile],
	);

	if (profile === undefined) {
		return profileQuery.isError ? (
			<div className="flex w-full flex-col gap-6">
				<h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
				<p role="alert" className="text-destructive">
					Could not load your profile.
				</p>
			</div>
		) : (
			<ProfilePageSkeleton />
		);
	}

	return (
		<div className="flex w-full flex-col gap-6">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
				<p className="mt-1 text-sm text-muted-foreground">How you appear across the platform.</p>
			</div>
			<Card className="max-w-2xl">
				<CardHeader>
					<CardTitle>Personal details</CardTitle>
					<CardDescription>
						{isImpersonating ? "You are impersonating this user: the profile is read-only." : "Your name is shown to your team and in the emails you send."}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<ProfileAvatar profile={profile} isReadOnly={isImpersonating} />
					<ProfileForm
						key={`${profile.id}:${String(profile.version)}`}
						initialValues={{ fullName: profile.fullName }}
						isPending={updateProfile.isPending}
						isReadOnly={isImpersonating}
						onSubmit={handleSubmit}
					/>
				</CardContent>
			</Card>
		</div>
	);
}
