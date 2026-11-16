import * as React from "react";
import { CodeBlock } from "@workspace/ui/components/code-block";

const CODE = `export const config = { api: { baseUrl: "https://api.example.com/v1", timeoutMs: 5000, retries: 3, headers: { "x-client": "admin" } } };

function load() {
	return fetch(config.api.baseUrl);
}`;

export function CodeBlockDont2Example(): React.JSX.Element {
	return <CodeBlock code={CODE} language="typescript" showLineNumbers defaultWrap className="w-full max-w-md" />;
}
