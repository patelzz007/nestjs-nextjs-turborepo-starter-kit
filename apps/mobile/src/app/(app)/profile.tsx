// ============================================
// Profile (§10.8) — the same fields and endpoints as the web profile
// ============================================
// GET /auth/profile and PATCH /auth/profile with the shared
// OwnProfileEditableFieldsSchema and the optimistic-lock `version`. The avatar
// is shown; uploading one from the phone is a next step (README).

import { useForm } from "@tanstack/react-form";
import { OwnProfileEditableFieldsSchema, type OwnProfile } from "@workspace/shared";
import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { View } from "react-native";

import { Avatar } from "../../components/avatar";
import { Banner } from "../../components/banner";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { DetailList } from "../../components/detail-list";
import { Screen } from "../../components/screen";
import { ErrorState, LoadingState } from "../../components/states";
import { TextField } from "../../components/text-field";
import { applyOwnProfileUpdated, applyOwnProfileUpdateFailed, isStaleProfileVersionError, STALE_PROFILE_MESSAGE } from "../../features/profile/own-profile-cache";
import { useApi } from "../../lib/api-context";
import { errorMessageOf } from "../../lib/error-messages";
import { visibleFieldError } from "../../lib/form";

export default function ProfileScreen(): React.JSX.Element {
	const api = useApi();
	const profile = api.auth.profile.useQuery(undefined);
	const refetch = React.useCallback((): void => {
		void profile.refetch();
	}, [profile]);

	const current = profile.data?.data;
	return (
		<Screen title="Profile" refreshing={profile.isRefetching} onRefresh={refetch}>
			{profile.isPending ? <LoadingState label="Loading your profile…" /> : null}
			{profile.isError ? <ErrorState message={errorMessageOf(profile.error)} retryLabel="Try again" onRetry={refetch} /> : null}
			{/* Keyed by version: the form restarts from the stored values after every save or reload. */}
			{current === undefined ? null : <ProfileEditor key={current.version} profile={current} />}
		</Screen>
	);
}

interface ProfileEditorProps {
	readonly profile: OwnProfile;
}

function ProfileEditor({ profile }: ProfileEditorProps): React.JSX.Element {
	const api = useApi();
	const queryClient = useQueryClient();
	const [feedback, setFeedback] = React.useState<{ readonly tone: "error" | "success"; readonly text: string } | null>(null);
	const update = api.auth.updateProfile.useMutation({
		onSuccess: async (response): Promise<void> => {
			await applyOwnProfileUpdated(queryClient, response);
			setFeedback({ tone: "success", text: "Profile saved." });
		},
		onError: async (error: Error): Promise<void> => {
			await applyOwnProfileUpdateFailed(queryClient, error);
			setFeedback({ tone: "error", text: isStaleProfileVersionError(error) ? STALE_PROFILE_MESSAGE : errorMessageOf(error) });
		},
	});

	const form = useForm({
		defaultValues: { fullName: profile.fullName },
		validators: { onChange: OwnProfileEditableFieldsSchema },
		onSubmit: ({ value }): void => {
			setFeedback(null);
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
			{feedback === null ? null : <Banner tone={feedback.tone} message={feedback.text} />}
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
