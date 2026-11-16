import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import ChevronUpIcon from "lucide-react-native/icons/chevron-up";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

export function Button35Example(): React.JSX.Element {
	const [expanded, setExpanded] = React.useState<boolean>(false);
	const toggle = React.useCallback((): void => {
		setExpanded((open: boolean): boolean => !open);
	}, []);
	return <Button label={expanded ? "Show less" : "Show more"} variant="ghost" icon={expanded ? ChevronUpIcon : ChevronDownIcon} iconPosition="end" onPress={toggle} />;
}
