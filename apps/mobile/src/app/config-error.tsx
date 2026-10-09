// ============================================
// Configuration error (§10.14)
// ============================================
// The environment failed validation: names what is wrong and shows an example
// value — never the configured value (EXPO_PUBLIC_* holds no secret, but the
// screen prints none regardless). In development it points to the README.

import * as React from "react";

import { Banner } from "../components/banner";
import { Card } from "../components/card";
import { Screen } from "../components/screen";
import { BodyText, MutedText } from "../components/text";
import { useConfigIssue } from "../runtime/runtime-context";

/** Where the variables are explained (development builds only). */
export const CONFIG_HELP_PATH = "apps/mobile/README.md → Configuration";

export default function ConfigErrorScreen(): React.JSX.Element {
	const issue = useConfigIssue();
	return (
		<Screen title="The app is not configured" description="This build cannot reach its server until the configuration below is fixed.">
			{issue === null ? (
				<Banner tone="error" message="The configuration could not be read." />
			) : (
				<Card title={issue.subject}>
					<Banner tone="error" message={`${issue.subject} ${issue.message}.`} />
					<MutedText>Example</MutedText>
					<BodyText selectable className="font-mono">
						{issue.example}
					</BodyText>
				</Card>
			)}
			{__DEV__ ? <MutedText>{`Set the value in apps/mobile/.env and restart Expo. See ${CONFIG_HELP_PATH}.`}</MutedText> : null}
		</Screen>
	);
}
