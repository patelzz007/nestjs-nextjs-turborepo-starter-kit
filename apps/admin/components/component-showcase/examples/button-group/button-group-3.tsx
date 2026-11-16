import * as React from "react";
import { FileTextIcon, PencilIcon, UploadIcon } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";

import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";

export function ButtonGroup3Example(): React.JSX.Element {
	return (
		<ButtonGroup>
			<Button variant="outline">
				<FileTextIcon aria-hidden="true" />
				<Badge variant="warning-light">Draft</Badge>
			</Button>

			<Button variant="outline">
				<PencilIcon aria-hidden="true" />
				<span>Edit</span>
			</Button>

			<Button variant="outline" size="icon" aria-label="Upload">
				<UploadIcon aria-hidden="true" />
			</Button>
		</ButtonGroup>
	);
}
