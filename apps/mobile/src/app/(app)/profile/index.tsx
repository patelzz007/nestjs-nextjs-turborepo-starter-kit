// ============================================
// Profile (§10.8) — the same fields and endpoints as the web profile
// ============================================
// GET /auth/profile and PATCH /auth/profile with the shared
// OwnProfileEditableFieldsSchema and the optimistic-lock `version`. The avatar
// is shown; uploading one from the phone is a next step (README). Below it,
// the GitHub contributions of the API's configured repositories (hidden when
// that integration is off).

import { useForm } from "@tanstack/react-form";
import { OwnProfileEditableFieldsSchema, type OwnProfile } from "@workspace/shared";
import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { View } from "react-native";

import { Avatar } from "../../../components/avatar";
import { Button } from "../../../components/button";
import { Card } from "../../../components/card";
import { DetailList } from "../../../components/detail-list";
import { Screen } from "../../../components/screen";
import { Skeleton, SkeletonGroup, SkeletonText } from "../../../components/skeleton";
import { ErrorState } from "../../../components/states";
import { TextField } from "../../../components/text-field";
import { GithubContributionsSection } from "../../../features/github/github-contributions-section";
import { refreshGithubContributions } from "../../../features/github/refresh";
import { applyOwnProfileUpdated, applyOwnProfileUpdateFailed, isStaleProfileVersionError, STALE_PROFILE_MESSAGE } from "../../../features/profile/own-profile-cache";
import { useToast } from "../../../features/toast/facade";
import { useApi } from "../../../lib/api-context";
import { errorMessageOf } from "../../../lib/error-messages";
import { visibleFieldError } from "../../../lib/form";

export const PROFILE_SAVED_MESSAGE = "Profile saved.";

export default function ProfileScreen(): React.JSX.Element {
	const api = useApi();
	const queryClient = useQueryClient();
	const profile = api.auth.profile.useQuery(undefined);
	const refetch = React.useCallback((): void => {
		void profile.refetch();
		void refreshGithubContributions(queryClient);
	}, [profile, queryClient]);

	const current = profile.data?.data;
	return (
		<Screen refreshing={profile.isRefetching} onRefresh={refetch}>
			{profile.isPending ? <ProfileSkeleton /> : null}
			{profile.isError ? <ErrorState message={errorMessageOf(profile.error)} retryLabel="Try again" onRetry={refetch} /> : null}
			{/* Keyed by version: the form restarts from the stored values after every save or reload. */}
			{current === undefined ? null : <ProfileEditor key={current.version} profile={current} />}
			<GithubContributionsSection />
		</Screen>
	);
}

interface ProfileEditorProps {
	readonly profile: OwnProfile;
}

function ProfileEditor({ profile }: ProfileEditorProps): React.JSX.Element {
	const api = useApi();
	const queryClient = useQueryClient();
	// The outcome is a toast, not local state: a save bumps the profile's version, which re-mounts this editor (its key).
	const toast = useToast();
	const update = api.auth.updateProfile.useMutation({
		onSuccess: async (response): Promise<void> => {
			await applyOwnProfileUpdated(queryClient, response);
			toast.success(PROFILE_SAVED_MESSAGE);
		},
		onError: async (error: Error): Promise<void> => {
			await applyOwnProfileUpdateFailed(queryClient, error);
			toast.error(isStaleProfileVersionError(error) ? STALE_PROFILE_MESSAGE : errorMessageOf(error));
		},
	});

	const form = useForm({
		defaultValues: { fullName: profile.fullName },
		validators: { onChange: OwnProfileEditableFieldsSchema },
		onSubmit: ({ value }): void => {
			update.mutate({ ...OwnProfileEditableFieldsSchema.parse(value), version: profile.version });
		},
	});
	const submit = React.useCallback((): void => {
		void form.handleSubmit();
	}, [form]);

	return (
		<>
			<Card>
				<View className="flex-row items-center gap-4">
					<Avatar name={profile.fullName} imageUrl={profile.avatar?.url ?? null} />
					<View className="flex-1">
						<DetailList items={[{ label: "Email", value: profile.email }]} />
					</View>
				</View>
			</Card>
			<form.Field name="fullName">
				{(field): React.JSX.Element => (
					<TextField
						label="Full name"
						value={field.state.value}
						onChange={field.handleChange}
						onBlur={field.handleBlur}
						error={visibleFieldError(field.state.meta)}
						autoComplete="name"
						textContentType="name"
					/>
				)}
			</form.Field>
			<Button label="Save changes" onPress={submit} loading={update.isPending} />
		</>
	);
}

/**
 * The profile's shape while it loads — the account card, the name field and
 * the save button where they will be — so nothing moves when the profile arrives.
 */
function ProfileSkeleton(): React.JSX.Element {
	return (
		<>
			<Card>
				<SkeletonGroup accessibilityLabel="Loading your profile" testID="profile-skeleton">
					<View className="flex-row items-center gap-4">
						<Skeleton className="size-14 rounded-full" />
						<View className="flex-1">
							<SkeletonText size="sm" widthClassName="w-48" />
						</View>
					</View>
				</SkeletonGroup>
			</Card>
			<SkeletonGroup className="gap-1.5">
				<SkeletonText size="sm" widthClassName="w-20" />
				<Skeleton className="min-h-12 w-full rounded-xl" />
			</SkeletonGroup>
			<SkeletonGroup>
				<Skeleton className="min-h-12 w-full rounded-lg" />
			</SkeletonGroup>
		</>
	);
}
