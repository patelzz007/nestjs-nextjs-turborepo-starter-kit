import { WEBHOOK_ID_HEADER, WEBHOOK_SIGNATURE_HEADER, WEBHOOK_SIGNATURE_TOLERANCE_SECONDS } from "@workspace/shared";

/**
 * A complete Node.js receiver (Express) that checks a delivery's signature the way the platform signs it
 * (ADR 082): HMAC-SHA256 of `"<t>.<raw body>"` with the endpoint's secret, compared in constant time with every
 * `v1=` of the signature header (two during a secret rotation), and a timestamp no older than the tolerance.
 * Built from the shared header names, so the console never documents a header the API does not send.
 */
export function buildWebhookReceiverSnippet(): string {
	const signatureHeader = WEBHOOK_SIGNATURE_HEADER.toLowerCase();
	const idHeader = WEBHOOK_ID_HEADER.toLowerCase();
	return [
		`import crypto from "node:crypto";`,
		`import express from "express";`,
		``,
		`const SECRET = process.env.WEBHOOK_SECRET; // whsec_…`,
		`const TOLERANCE_SECONDS = ${String(WEBHOOK_SIGNATURE_TOLERANCE_SECONDS)};`,
		`const seen = new Set(); // use your database in production`,
		``,
		`function isSigned(rawBody, header) {`,
		`  const parts = header.split(",");`,
		`  const t = parts.find((part) => part.startsWith("t="))?.slice(2);`,
		`  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));`,
		`  if (!t || Math.abs(Date.now() / 1000 - Number(t)) > TOLERANCE_SECONDS) return false;`,
		`  const expected = crypto.createHmac("sha256", SECRET).update(\`\${t}.\${rawBody}\`).digest("hex");`,
		`  return signatures.some((signature) =>`,
		`    signature.length === expected.length &&`,
		`    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)));`,
		`}`,
		``,
		`const app = express();`,
		`// Read the RAW body: the signature covers the exact bytes that were sent.`,
		`app.post("/webhooks", express.text({ type: "application/json" }), (req, res) => {`,
		`  if (!isSigned(req.body, req.get("${signatureHeader}") ?? "")) return res.sendStatus(401);`,
		`  const deliveryId = req.get("${idHeader}");`,
		`  if (seen.has(deliveryId)) return res.sendStatus(200); // a retry you already handled`,
		`  seen.add(deliveryId);`,
		`  const event = JSON.parse(req.body);`,
		`  console.log(event.type, event.data);`,
		`  res.sendStatus(200); // answer fast, do slow work afterwards`,
		`});`,
		``,
		`app.listen(4000);`,
	].join("\n");
}
