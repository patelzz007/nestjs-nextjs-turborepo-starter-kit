import { S3Client } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";

/** Time allowed to open a connection to S3. */
const S3_CONNECTION_TIMEOUT_MS = 5_000;
/** Time allowed for one S3 request (the API only streams objects up to the category size limits). */
const S3_REQUEST_TIMEOUT_MS = 30_000;

export interface S3ClientOptions {
	readonly region: string;
	/** Transport override (tests record requests instead of calling AWS). Defaults to a Node.js handler with timeouts. */
	readonly requestHandler?: NodeHttpHandler;
}

/**
 * Builds the API's only S3 client.
 *
 * Credentials are deliberately NOT passed: the AWS SDK default credential
 * provider chain resolves them on first use and refreshes them before they
 * expire — the ECS task role, EC2 instance profile or EKS IRSA / Pod Identity
 * role in a deployment; an SSO profile (`AWS_PROFILE`) or local-development
 * keys (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`, rejected by the config
 * on a deployed production environment) on a laptop. Role credentials are
 * temporary and carry a session token; every request and every presigned URL
 * or POST policy signed with this client includes it.
 */
export function createS3Client(options: S3ClientOptions): S3Client {
	return new S3Client({
		region: options.region,
		requestHandler:
			options.requestHandler ??
			new NodeHttpHandler({
				connectionTimeout: S3_CONNECTION_TIMEOUT_MS,
				requestTimeout: S3_REQUEST_TIMEOUT_MS,
			}),
	});
}
