// One signed-in device (§10.11). Presentational: the caller passes the row's
// text and the revoke action. Client-reported values are rendered as text.

import * as React from "react";
import { View } from "react-native";

import { Badge } from "./badge";
import { Button } from "./button";
import { DetailList, type DetailItem } from "./detail-list";
import { MutedText, Subheading } from "./text";

export interface DeviceSessionRowProps {
	readonly label: string;
	readonly clientTypeLabel: string;
	readonly platform: string;
	readonly details: readonly DetailItem[];
	readonly isCurrent: boolean;
	readonly currentLabel: string;
	readonly revokeLabel: string;
	/** Absent for the current device (it signs out through "Sign out" instead). */
	readonly onRevoke?: () => void;
	readonly isRevoking?: boolean;
}

export function DeviceSessionRow({
	label,
	clientTypeLabel,
	platform,
	details,
	isCurrent,
	currentLabel,
	revokeLabel,
	onRevoke,
	isRevoking = false,
}: DeviceSessionRowProps): React.JSX.Element {
	return (
		<View className="gap-2 border-b border-border py-4" accessibilityLabel={isCurrent ? `${label}, ${currentLabel}` : label}>
			<View className="flex-row flex-wrap items-center gap-2">
				<Subheading>{label}</Subheading>
				<Badge label={clientTypeLabel} />
				{isCurrent ? <Badge label={currentLabel} tone="success" /> : null}
			</View>
			{platform.length === 0 ? null : <MutedText>{platform}</MutedText>}
			<DetailList items={details} />
			{isCurrent || onRevoke === undefined ? null : (
				<View className="self-start">
					<Button label={revokeLabel} accessibilityLabel={`${revokeLabel} ${label}`} variant="secondary" onPress={onRevoke} loading={isRevoking} />
				</View>
			)}
		</View>
	);
}
