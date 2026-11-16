import { Button } from "@workspace/ui-native/components/button";
import { EmptyState } from "@workspace/ui-native/components/empty";
import CloudUploadIcon from "lucide-react-native/icons/cloud-upload";
import PlusIcon from "lucide-react-native/icons/plus";
import * as React from "react";
import { Text } from "react-native";

import { ignorePress } from "../example-support";

export function Empty6Example(): React.JSX.Element {
	return (
		<EmptyState variant="dashed" align="center" icon={CloudUploadIcon} title="Upload files" message="Choose files from your phone to upload them." className="py-12">
			<Button label="Browse Files" variant="outline" size="sm" icon={PlusIcon} onPress={ignorePress} />
			<Text className="text-caption font-sans text-muted-foreground">PNG, JPG, SVG up to 10MB</Text>
		</EmptyState>
	);
}
