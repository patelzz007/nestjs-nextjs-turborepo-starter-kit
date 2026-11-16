import { FileType } from "@workspace/ui-native/components/file-type";
import { Icon, type LucideIcon } from "@workspace/ui-native/components/icon";
import CloudUploadIcon from "lucide-react-native/icons/cloud-upload";
import EyeOffIcon from "lucide-react-native/icons/eye-off";
import LinkIcon from "lucide-react-native/icons/link";
import LockIcon from "lucide-react-native/icons/lock";
import ShieldCheckIcon from "lucide-react-native/icons/shield-check";
import StarIcon from "lucide-react-native/icons/star";
import * as React from "react";
import { Text, View } from "react-native";

interface FileState {
	readonly type: string;
	readonly caption: string;
	readonly icon: LucideIcon;
}

const FILES: readonly FileState[] = [
	{ type: "pdf", caption: "Locked PDF", icon: LockIcon },
	{ type: "docx", caption: "Verified DOCX", icon: ShieldCheckIcon },
	{ type: "xlsx", caption: "Shared XLSX", icon: LinkIcon },
	{ type: "png", caption: "Starred PNG", icon: StarIcon },
	{ type: "fig", caption: "Hidden FIG", icon: EyeOffIcon },
	{ type: "zip", caption: "Uploading ZIP", icon: CloudUploadIcon },
];

// The icon takes the glyph's place: in the type's colour on an outline page, in the colour drawn on the fill on a solid one.
export function FileType13Example(): React.JSX.Element {
	return (
		<View className="flex-row flex-wrap justify-center gap-x-8 gap-y-6">
			{FILES.map((file: FileState): React.JSX.Element => (
				<View key={file.type} className="items-center gap-2.5" accessible accessibilityLabel={file.caption}>
					<View className="flex-row gap-2">
						<FileType type={file.type} icon={<Icon icon={file.icon} size="sm" colorClassName="accent-muted-foreground" />} />
						<FileType type={file.type} icon={<Icon icon={file.icon} size="sm" colorClassName="accent-background" />} variant="solid" />
					</View>
					<Text className="text-caption font-sans text-muted-foreground">{file.caption}</Text>
				</View>
			))}
		</View>
	);
}
