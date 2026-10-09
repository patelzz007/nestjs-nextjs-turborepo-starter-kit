// ============================================
// Home (§10.7) — the starter shell's placeholder dashboard
// ============================================
// Shows who is signed in. Products replace this screen with their own.

import * as React from "react";
import { View } from "react-native";

import { Avatar } from "../../components/avatar";
import { Banner } from "../../components/banner";
import { Card } from "../../components/card";
import { Screen } from "../../components/screen";
import { ErrorState, LoadingState } from "../../components/states";
import { BodyText, MutedText, Subheading } from "../../components/text";
import { backupCodesNotice } from "../../features/two-factor/backup-codes-status";
import { useApi } from "../../lib/api-context";
import { errorMessageOf } from "../../lib/error-messages";

export default function HomeScreen(): React.JSX.Element {
	const api = useApi();
	const me = api.auth.me.useQuery(undefined);
	const profile = api.auth.profile.useQuery(undefined);
	const twoFactorEnabled = me.data?.data.twoFactorEnabled === true;
	const remaining = api.auth.twoFactorBackupCodesRemaining.useQuery(undefined, { enabled: twoFactorEnabled });

	const refetch = React.useCallback((): void => {
		void me.refetch();
		void profile.refetch();
	}, [me, profile]);

	const user = me.data?.data;
	const notice = remaining.data === undefined ? null : backupCodesNotice(remaining.data.data.remaining);

	return (
		<Screen title="Home" refreshing={me.isRefetching} onRefresh={refetch}>
			{me.isPending ? <LoadingState label="Loading your account…" /> : null}
			{me.isError ? <ErrorState message={errorMessageOf(me.error)} retryLabel="Try again" onRetry={refetch} /> : null}
			{user === undefined ? null : (
				<Card>
					<View className="flex-row items-center gap-4">
						<Avatar name={user.fullName} imageUrl={profile.data?.data.avatar?.url ?? null} />
						<View className="flex-1 gap-0.5">
							<Subheading>{user.fullName}</Subheading>
							<MutedText>{user.email}</MutedText>
						</View>
					</View>
				</Card>
			)}
			{notice === null ? null : <Banner tone="warning" message={notice} />}
			<Card title="This is the starter shell">
				<BodyText>Sign-in, profile, settings, security and devices work end to end. Build your product&apos;s screens on top of it.</BodyText>
				<MutedText>See apps/mobile/README.md for how the app is put together and where new features go.</MutedText>
			</Card>
		</Screen>
	);
}
