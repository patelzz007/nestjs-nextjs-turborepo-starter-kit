import * as React from "react";
import { FileIcon, FolderIcon, TrashIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";

export function ButtonGroup22Example(): React.JSX.Element {
	return (
		<ButtonGroup>
			<Button variant="outline" aria-label="Files">
				<FileIcon aria-hidden="true" />
				Files
			</Button>
			<Button variant="outline" disabled aria-label="Folder">
				<FolderIcon aria-hidden="true" />
				Folder
			</Button>
			<Button variant="outline" aria-label="Trash">
				<TrashIcon aria-hidden="true" />
				Trash
			</Button>
		</ButtonGroup>
	);
}
