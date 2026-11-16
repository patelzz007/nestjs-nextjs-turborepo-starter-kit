import type { LucideIcon } from "@workspace/ui-native/components/icon";
import { StatusBadge, type StatusBadgeTone } from "@workspace/ui-native/components/status-badge";
import ArchiveIcon from "lucide-react-native/icons/archive";
import BanIcon from "lucide-react-native/icons/ban";
import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import ClockIcon from "lucide-react-native/icons/clock";
import MailIcon from "lucide-react-native/icons/mail";
import PencilLineIcon from "lucide-react-native/icons/pencil-line";
import * as React from "react";
import { View } from "react-native";

/** A feature maps its own statuses to a tone, a glyph and a label once; the badge never sees the raw enum. */
type MemberStatus = "active" | "pending" | "suspended" | "invited" | "draft" | "archived";

interface StatusDisplay {
	readonly tone: StatusBadgeTone;
	readonly icon: LucideIcon;
	readonly label: string;
}

const MEMBER_STATUS_DISPLAY: Readonly<Record<MemberStatus, StatusDisplay>> = {
	active: { tone: "success", icon: CircleCheckIcon, label: "Active" },
	pending: { tone: "warning", icon: ClockIcon, label: "Pending review" },
	suspended: { tone: "destructive", icon: BanIcon, label: "Suspended" },
	invited: { tone: "info", icon: MailIcon, label: "Invited" },
	draft: { tone: "neutral", icon: PencilLineIcon, label: "Draft" },
	archived: { tone: "muted", icon: ArchiveIcon, label: "Archived" },
};

const STATUSES: readonly MemberStatus[] = ["active", "pending", "suspended", "invited", "draft", "archived"];

export function StatusBadge1Example(): React.JSX.Element {
	return (
		<View className="flex-row flex-wrap items-center gap-2">
			{STATUSES.map((status: MemberStatus): React.JSX.Element => {
				const display = MEMBER_STATUS_DISPLAY[status];
				return <StatusBadge key={status} tone={display.tone} icon={display.icon} label={display.label} accessibilityLabel={display.label} />;
			})}
		</View>
	);
}
