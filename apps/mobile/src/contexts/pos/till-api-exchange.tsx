// The till's last request and its answer as three code blocks — request headers, request body and
// response body — each with a Copy button (api-exchange.ts builds them; the API key is masked).

import { Card } from "@workspace/ui-native/components/card";
import { CodeBlock } from "@workspace/ui-native/components/code-block";
import * as Clipboard from "expo-clipboard";
import * as React from "react";
import { View } from "react-native";

import { prettyJson, type ApiExchange } from "./api-exchange";
import { TILL_COPY } from "./labels";

interface CopyableJsonProps {
	readonly caption: string;
	readonly json: string;
	readonly testID: string;
}

/** One JSON block with its own Copy (the button shows a check once copied). */
function CopyableJson({ caption, json, testID }: CopyableJsonProps): React.JSX.Element {
	const [copied, setCopied] = React.useState(false);
	const copy = React.useCallback((): void => {
		Clipboard.setStringAsync(json)
			.then((): void => {
				setCopied(true);
			})
			.catch((): void => {
				setCopied(false);
			});
	}, [json]);
	return <CodeBlock code={json} language="JSON" caption={caption} onCopy={copy} copied={copied} showLineNumbers size="sm" testID={testID} />;
}

export interface TillApiExchangeProps {
	readonly exchange: ApiExchange;
	/** The card's title (the validate call's by default). */
	readonly title?: string | undefined;
	/** Prefix of the blocks' test ids (`till-exchange` by default). */
	readonly testID?: string | undefined;
}

export function TillApiExchange({ exchange, title = TILL_COPY.exchangeTitle, testID = "till-exchange" }: TillApiExchangeProps): React.JSX.Element {
	return (
		<Card title={title} description={TILL_COPY.exchangeDescription(exchange.method, exchange.path)}>
			<View className="gap-3">
				<CopyableJson caption={TILL_COPY.requestHeadersCaption} json={prettyJson(exchange.requestHeaders)} testID={`${testID}-request-headers`} />
				<CopyableJson caption={TILL_COPY.requestBodyCaption} json={prettyJson(exchange.requestBody)} testID={`${testID}-request-body`} />
				<CopyableJson caption={TILL_COPY.responseBodyCaption} json={prettyJson(exchange.responseBody)} testID={`${testID}-response-body`} />
			</View>
		</Card>
	);
}
