// GitHub's file-status glyphs, shared by every screen that lists changed files
// (a commit's, a pull request's): added green, deleted red, moved blue, edited grey.

import type { GithubCommitFileStatus } from "@workspace/shared";
import FileDiffIcon from "lucide-react-native/icons/file-diff";
import FileMinusIcon from "lucide-react-native/icons/file-minus";
import FilePlusIcon from "lucide-react-native/icons/file-plus";
import FileSymlinkIcon from "lucide-react-native/icons/file-symlink";

import type { LucideIcon } from "@workspace/ui-native/components/icon";

export interface FileStatusIcon {
	readonly icon: LucideIcon;
	readonly colorClassName: string;
}

export const FILE_STATUS_ICONS: Readonly<Record<GithubCommitFileStatus, FileStatusIcon>> = {
	added: { icon: FilePlusIcon, colorClassName: "accent-success-foreground" },
	removed: { icon: FileMinusIcon, colorClassName: "accent-destructive-foreground" },
	renamed: { icon: FileSymlinkIcon, colorClassName: "accent-info-foreground" },
	copied: { icon: FileSymlinkIcon, colorClassName: "accent-info-foreground" },
	modified: { icon: FileDiffIcon, colorClassName: "accent-muted-foreground" },
	changed: { icon: FileDiffIcon, colorClassName: "accent-muted-foreground" },
	unchanged: { icon: FileDiffIcon, colorClassName: "accent-muted-foreground" },
};
