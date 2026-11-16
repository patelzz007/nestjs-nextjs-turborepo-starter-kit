import { Card } from "@workspace/ui-native/components/card";
import { Checkbox } from "@workspace/ui-native/components/checkbox";
import { Separator } from "@workspace/ui-native/components/separator";
import * as React from "react";

export function Checkbox11Example(): React.JSX.Element {
	const [news, setNews] = React.useState<boolean>(true);
	const [security, setSecurity] = React.useState<boolean>(true);
	const [tips, setTips] = React.useState<boolean>(false);
	return (
		<Card>
			<Checkbox label="Product news" checked={news} onChange={setNews} controlPosition="end" />
			<Separator />
			<Checkbox label="Security alerts" checked={security} onChange={setSecurity} controlPosition="end" />
			<Separator />
			<Checkbox label="Tips" checked={tips} onChange={setTips} controlPosition="end" />
		</Card>
	);
}
