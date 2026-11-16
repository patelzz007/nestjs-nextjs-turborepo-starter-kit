import ArchiveIcon from "lucide-react-native/icons/archive";
import FileTextIcon from "lucide-react-native/icons/file-text";
import ImageIcon from "lucide-react-native/icons/image";
import MusicIcon from "lucide-react-native/icons/music";
import VideoIcon from "lucide-react-native/icons/video";
import { Icon } from "@workspace/ui-native/components/icon";
import { SelectField, type SelectOption } from "@workspace/ui-native/components/select-field";
import * as React from "react";

const CATEGORIES: readonly SelectOption<string>[] = [
	{ value: "documents", label: "Documents", leading: <Icon icon={FileTextIcon} size="sm" colorClassName="accent-muted-foreground" /> },
	{ value: "images", label: "Images", leading: <Icon icon={ImageIcon} size="sm" colorClassName="accent-muted-foreground" /> },
	{ value: "videos", label: "Videos", leading: <Icon icon={VideoIcon} size="sm" colorClassName="accent-muted-foreground" /> },
	{ value: "audio", label: "Audio", leading: <Icon icon={MusicIcon} size="sm" colorClassName="accent-muted-foreground" /> },
	{ value: "archives", label: "Archives", leading: <Icon icon={ArchiveIcon} size="sm" colorClassName="accent-muted-foreground" /> },
];

export function Select32Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("documents");
	return <SelectField label="File type" options={CATEGORIES} value={value} onChange={setValue} />;
}
