import { Badge } from "@workspace/ui-native/components/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui-native/components/card";
import { Icon } from "@workspace/ui-native/components/icon";
import { Marker, MarkerContent, MarkerIcon } from "@workspace/ui-native/components/marker";
import { Spinner } from "@workspace/ui-native/components/spinner";
import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import XIcon from "lucide-react-native/icons/x";
import * as React from "react";
import { View } from "react-native";

const TITLE = "Agent run";
const BRANCH = "fix/rate-limit-window";
const DONE: readonly string[] = ["Read src/lib/rate-limit.ts", "Reproduced the 429 on staging", "Widened the window to 60s"];
const FAILED = "Type check failed in src/db/schema.ts";
const RUNNING = "In progress: re-running the test suite";

// Done, failed and still running: the failure is a badge, never only a text colour, so it reads without the hue.
export function Marker3Example(): React.JSX.Element {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{TITLE}</CardTitle>
				<CardDescription>{BRANCH}</CardDescription>
			</CardHeader>
			<CardContent>
				<View className="gap-3">
					{DONE.map((line: string): React.JSX.Element => (
						<Marker key={line}>
							<MarkerIcon>
								<Icon icon={CircleCheckIcon} size="sm" colorClassName="accent-muted-foreground" />
							</MarkerIcon>
							<MarkerContent>{line}</MarkerContent>
						</Marker>
					))}
					<Marker>
						<MarkerIcon>
							<Icon icon={XIcon} size="sm" colorClassName="accent-muted-foreground" />
						</MarkerIcon>
						<MarkerContent>{FAILED}</MarkerContent>
						<Badge label="failed" tone="destructive" variant="light" size="sm" />
					</Marker>
					<Marker>
						<MarkerIcon>
							<Spinner variant="muted" />
						</MarkerIcon>
						<MarkerContent>{RUNNING}</MarkerContent>
					</Marker>
				</View>
			</CardContent>
		</Card>
	);
}
