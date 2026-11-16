import { Badge, type BadgeTone, type BadgeVariant } from "@workspace/ui-native/components/badge";
import { Spinner } from "@workspace/ui-native/components/spinner";
import * as React from "react";
import { View } from "react-native";

interface BusyBadge {
	readonly label: string;
	readonly tone: BadgeTone;
	readonly variant: BadgeVariant;
	readonly spinnerColor: string;
}

const BADGES: readonly BusyBadge[] = [
	{ label: "Updating", tone: "primary", variant: "solid", spinnerColor: "accent-primary-foreground" },
	{ label: "Syncing", tone: "neutral", variant: "soft", spinnerColor: "accent-muted-foreground" },
	{ label: "Loading", tone: "neutral", variant: "outline", spinnerColor: "accent-foreground" },
	{ label: "Updating", tone: "destructive", variant: "light", spinnerColor: "accent-destructive-foreground" },
	{ label: "Syncing", tone: "success", variant: "light", spinnerColor: "accent-success-foreground" },
	{ label: "Loading", tone: "info", variant: "light", spinnerColor: "accent-info-foreground" },
];

export function Spinner3Example(): React.JSX.Element {
	return (
		<View className="flex-row flex-wrap gap-3">
			{BADGES.map((badge: BusyBadge): React.JSX.Element => (
				<Badge
					key={`${badge.tone}-${badge.variant}`}
					label={badge.label}
					tone={badge.tone}
					variant={badge.variant}
					leading={<Spinner colorClassName={badge.spinnerColor} accessibilityLabel={badge.label} />}
				/>
			))}
		</View>
	);
}
