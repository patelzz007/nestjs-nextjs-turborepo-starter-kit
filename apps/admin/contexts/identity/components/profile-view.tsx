"use client";

import { useAuth } from "@workspace/client/lib/contexts/identity";
import { ApiError } from "@workspace/client/lib/api/api-request";
import { ProfileAvatarEditor } from "@workspace/client/lib/contexts/identity/profile/profile-avatar-editor";
import { useOwnProfile, useUpdateOwnProfile } from "@workspace/client/lib/contexts/identity/profile/use-own-profile";
import {
	ApiErrorCodes,
	OWN_PROFILE_ERROR_CODES,
	type Envelope,
	type OwnProfile,
	type OwnProfileEditableFields,
	type PermissionDetailsResponse,
	type SlimRoleResponse,
} from "@workspace/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { toastMessage } from "@workspace/ui/components/toast";
import * as React from "react";

import { ProfileAccessPanel } from "@/contexts/identity/components/account/profile-access-panel";
import { ProfileDemoDates } from "@/contexts/identity/components/account/profile-demo-dates";
import { ProfileForm } from "@/contexts/identity/components/account/profile-form";
import { ProfileIdentityHeader } from "@/contexts/identity/components/account/profile-identity-header";
import { ProfilePageSkeleton } from "@/components/loading/account-skeletons";
import { summarizeAccess } from "@/contexts/identity/lib/account/access-summary";
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

const NO_ROLES: readonly SlimRoleResponse[] = [];
const NO_PERMISSIONS: readonly PermissionDetailsResponse[] = [];

/** `/account/profile` — the signed-in admin's own profile (smart: owns the query, the mutation and the toasts). */
export function ProfileView({ initialProfile }: ProfileViewProps): React.JSX.Element {
	const { api } = useAuth();
	const profileQuery = useOwnProfile(initialProfile);
	const sessionQuery = api.auth.permissions.useQuery(undefined);
	const session = sessionQuery.data?.data;
	const isImpersonating = session?.isImpersonating === true;
	const roles = session?.roles ?? NO_ROLES;
	const permissions = session?.permissions ?? NO_PERMISSIONS;
	const access = React.useMemo(() => summarizeAccess(permissions), [permissions]);
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
				<h2 className="text-xl font-semibold tracking-tight">Profile</h2>
				<p role="alert" className="text-destructive">
					Could not load your profile.
				</p>
			</div>
		) : (
			<ProfilePageSkeleton />
		);
	}

	return (
		<div className="flex w-full flex-col gap-8">
			<ProfileIdentityHeader profile={profile} roles={roles} permissionCount={access.permissionCount} isImpersonating={isImpersonating} />
			<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
				<div className="flex min-w-0 flex-col gap-6">
					<Card>
						<CardHeader>
							<CardTitle>Personal details</CardTitle>
							<CardDescription>
								{isImpersonating ? "You are impersonating this user: the profile is read-only." : "Your name and photo are shown to your team and in the emails you send."}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<ProfileAvatarEditor profile={profile} isReadOnly={isImpersonating} onSuccess={showAvatarSuccess} onError={toastAvatarError} />
							<ProfileForm
								key={`${profile.id}:${String(profile.version)}`}
								initialValues={{ fullName: profile.fullName }}
								isPending={updateProfile.isPending}
								isReadOnly={isImpersonating}
								onSubmit={handleSubmit}
							/>
						</CardContent>
					</Card>
					<ProfileDemoDates />
				</div>
				<ProfileAccessPanel roles={roles} access={access} className="lg:sticky lg:top-6" />
			</div>
		</div>
	);
}
