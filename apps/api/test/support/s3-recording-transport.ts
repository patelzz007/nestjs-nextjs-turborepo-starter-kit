// Test-only transport for the AWS SDK clients (S3, CloudFront): records every signed HTTP request and
// answers it with a canned response, so the real SDK serializes, signs and
// parses — only the network hop is replaced.

import { Readable } from "node:stream";

import { NodeHttpHandler } from "@smithy/node-http-handler";

export type RecordedS3Request = Parameters<NodeHttpHandler["handle"]>[0];
type S3HandlerResult = Awaited<ReturnType<NodeHttpHandler["handle"]>>;

export interface CannedS3Response {
	readonly statusCode: number;
	readonly body: string;
}

const HTTP_OK = 200;
const HTTP_CREATED = 201;

/** Successful CopyObject reply carrying `etag`. */
export function copyObjectResponse(etag: string): CannedS3Response {
	return {
		statusCode: HTTP_OK,
		body: `<?xml version="1.0" encoding="UTF-8"?><CopyObjectResult><ETag>"${etag}"</ETag><LastModified>2026-10-04T00:00:00.000Z</LastModified></CopyObjectResult>`,
	};
}

/** Successful CloudFront CreateInvalidation reply. */
export function createInvalidationResponse(invalidationId: string): CannedS3Response {
	return {
		statusCode: HTTP_CREATED,
		body: `<?xml version="1.0" encoding="UTF-8"?><Invalidation xmlns="http://cloudfront.amazonaws.com/doc/2020-05-31/"><Id>${invalidationId}</Id><Status>InProgress</Status><CreateTime>2026-10-04T00:00:00.000Z</CreateTime></Invalidation>`,
	};
}

/** Empty 200/204-style reply (DeleteObject, PutObject). */
export const EMPTY_SUCCESS_RESPONSE: CannedS3Response = { statusCode: HTTP_OK, body: "" };

export class RecordingS3Transport extends NodeHttpHandler {
	public readonly requests: RecordedS3Request[] = [];

	public constructor(private readonly reply: CannedS3Response) {
		super();
	}

	public override handle(request: RecordedS3Request): Promise<S3HandlerResult> {
		this.requests.push(request);
		return Promise.resolve({
			response: { statusCode: this.reply.statusCode, headers: {}, body: Readable.from([Buffer.from(this.reply.body)]) },
		});
	}

	/** The only recorded request (fails the test when there were none or several). */
	public single(): RecordedS3Request {
		const [request, ...rest] = this.requests;
		if (request === undefined || rest.length > 0) {
			throw new Error(`expected exactly one S3 request, got ${String(this.requests.length)}`);
		}
		return request;
	}
}
