// What the Attachment examples share: the web examples' sample files, and the glyph for each kind.

import FileIcon from "lucide-react-native/icons/file";
import FileSpreadsheetIcon from "lucide-react-native/icons/file-spreadsheet";
import FileTextIcon from "lucide-react-native/icons/file-text";
import FileVideoIcon from "lucide-react-native/icons/file-video";
import ImageIcon from "lucide-react-native/icons/image";
import type { LucideIcon } from "@workspace/ui-native/components/icon";

const UNSPLASH_PARAMS = "?auto=format&fit=crop&w=400&h=400&q=80";

/** Abstract sample images, served from images.unsplash.com like the web examples'. */
export const SAMPLE_IMAGES: Readonly<Record<"gradient" | "waves" | "fluid" | "prism", string>> = {
	gradient: `https://images.unsplash.com/photo-1579546929518-9e396f3cc809${UNSPLASH_PARAMS}`,
	waves: `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe${UNSPLASH_PARAMS}`,
	fluid: `https://images.unsplash.com/photo-1620641788421-7a1c342ea42e${UNSPLASH_PARAMS}`,
	prism: `https://images.unsplash.com/photo-1620121692029-d088224ddc74${UNSPLASH_PARAMS}`,
};

const ICONS: Readonly<Record<string, LucideIcon>> = {
	pdf: FileTextIcon,
	md: FileTextIcon,
	csv: FileSpreadsheetIcon,
	xlsx: FileSpreadsheetIcon,
	mp4: FileVideoIcon,
	png: ImageIcon,
	jpg: ImageIcon,
};

/** A file's glyph from its extension. */
export function fileIcon(name: string): LucideIcon {
	return ICONS[name.split(".").at(-1)?.toLowerCase() ?? ""] ?? FileIcon;
}

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = BYTES_PER_KB * BYTES_PER_KB;

/** "1.2 MB", "840 KB". */
export function formatBytes(bytes: number): string {
	return bytes >= BYTES_PER_MB ? `${(bytes / BYTES_PER_MB).toFixed(1)} MB` : `${String(Math.max(1, Math.round(bytes / BYTES_PER_KB)))} KB`;
}
