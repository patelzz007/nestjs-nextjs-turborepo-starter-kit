import { CloudFrontClient, CreateInvalidationCommand } from "@aws-sdk/client-cloudfront";
import { NodeHttpHandler } from "@smithy/node-http-handler";

import type { CdnCacheInvalidator, CdnInvalidationRequest } from "../../domain/cdn-cache.port";
import { encodeObjectKey } from "./s3-object-storage.adapter";

/** CloudFront is a global service; its API is signed for us-east-1. */
const CLOUDFRONT_SIGNING_REGION = "us-east-1";
const CLOUDFRONT_CONNECTION_TIMEOUT_MS = 5_000;
const CLOUDFRONT_REQUEST_TIMEOUT_MS = 30_000;

export interface CloudFrontClientOptions {
	/** Transport override (tests record requests instead of calling AWS). */
	readonly requestHandler?: NodeHttpHandler;
}

/**
 * CloudFront client with no explicit credentials: like the S3 client, it signs
 * with whatever the AWS SDK default credential chain resolves (the API's IAM
 * role, which may only call `cloudfront:CreateInvalidation` on one distribution).
 */
export function createCloudFrontClient(options: CloudFrontClientOptions = {}): CloudFrontClient {
	return new CloudFrontClient({
		region: CLOUDFRONT_SIGNING_REGION,
		requestHandler: options.requestHandler ?? new NodeHttpHandler({ connectionTimeout: CLOUDFRONT_CONNECTION_TIMEOUT_MS, requestTimeout: CLOUDFRONT_REQUEST_TIMEOUT_MS }),
	});
}

/**
 * Purges withdrawn public assets from the CloudFront distribution in front of
 * the public-origin bucket. The request's reference becomes the invalidation's
 * CallerReference, so a retried job that already succeeded is answered with
 * the existing invalidation instead of creating a second one.
 */
export class CloudFrontCacheInvalidator implements CdnCacheInvalidator {
	public constructor(
		private readonly client: CloudFrontClient,
		private readonly distributionId: string,
	) {}

	public async invalidate(request: CdnInvalidationRequest): Promise<void> {
		if (request.objectKeys.length === 0) {
			return;
		}
		const paths: string[] = request.objectKeys.map((key: string): string => `/${encodeObjectKey(key)}`);
		await this.client.send(
			new CreateInvalidationCommand({
				DistributionId: this.distributionId,
				InvalidationBatch: {
					CallerReference: request.reference,
					Paths: { Quantity: paths.length, Items: paths },
				},
			}),
		);
	}
}
