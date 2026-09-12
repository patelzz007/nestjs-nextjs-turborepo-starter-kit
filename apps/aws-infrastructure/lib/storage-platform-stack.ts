import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as sqs from "aws-cdk-lib/aws-sqs";
import type { Construct } from "constructs";

import { readContextStringList } from "./cdk-context.util.js";

const DEFAULT_BROWSER_ORIGINS: readonly string[] = ["http://localhost:3000", "http://localhost:3001", "http://localhost:3003"];

export interface StoragePlatformStackProps extends cdk.StackProps {
	readonly environmentName: string;
	readonly browserOrigins?: readonly string[];
}

function resolveBrowserOrigins(scope: Construct, explicit?: readonly string[]): readonly string[] {
	if (explicit !== undefined && explicit.length > 0) return explicit;

	const fromContext = readContextStringList(scope.node, "browserOrigins");
	if (fromContext.length > 0) return fromContext;

	return DEFAULT_BROWSER_ORIGINS;
}

export class StoragePlatformStack extends cdk.Stack {
	public constructor(scope: Construct, id: string, props: StoragePlatformStackProps) {
		super(scope, id, props);

		const namePrefix = `app-${props.environmentName}`;
		const browserOrigins = resolveBrowserOrigins(this, props.browserOrigins);
		const privateBucketCors: s3.CorsRule[] = [
			{
				allowedMethods: [s3.HttpMethods.POST, s3.HttpMethods.PUT, s3.HttpMethods.HEAD, s3.HttpMethods.GET],
				allowedOrigins: [...browserOrigins],
				allowedHeaders: ["*"],
				exposedHeaders: ["ETag", "x-amz-checksum-sha256", "x-amz-version-id"],
				maxAge: 3600,
			},
		];

		const privateBucket = new s3.Bucket(this, "PrivateBucket", {
			bucketName: `${namePrefix}-private`,
			blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
			enforceSSL: true,
			versioned: true,
			lifecycleRules: [
				{
					noncurrentVersionExpiration: cdk.Duration.days(30),
					abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
				},
				{
					prefix: "staging/",
					expiration: cdk.Duration.days(1),
				},
			],
			cors: privateBucketCors,
			encryption: s3.BucketEncryption.S3_MANAGED,
			removalPolicy: cdk.RemovalPolicy.RETAIN,
		});

		const publicOriginBucket = new s3.Bucket(this, "PublicOriginBucket", {
			bucketName: `${namePrefix}-public-origin`,
			blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
			enforceSSL: true,
			versioned: true,
			lifecycleRules: [
				{
					noncurrentVersionExpiration: cdk.Duration.days(30),
				},
			],
			encryption: s3.BucketEncryption.S3_MANAGED,
			removalPolicy: cdk.RemovalPolicy.RETAIN,
		});

		const processingDlq = new sqs.Queue(this, "ProcessingDlq", {
			queueName: `${namePrefix}-processing-dlq`,
			retentionPeriod: cdk.Duration.days(14),
			enforceSSL: true,
		});

		const processingQueue = new sqs.Queue(this, "ProcessingQueue", {
			queueName: `${namePrefix}-processing`,
			visibilityTimeout: cdk.Duration.minutes(15),
			deadLetterQueue: { queue: processingDlq, maxReceiveCount: 5 },
			enforceSSL: true,
		});

		const scannerDlq = new sqs.Queue(this, "ScannerDlq", {
			queueName: `${namePrefix}-scanner-dlq`,
			retentionPeriod: cdk.Duration.days(14),
			enforceSSL: true,
		});

		const scannerQueue = new sqs.Queue(this, "ScannerQueue", {
			queueName: `${namePrefix}-scanner`,
			visibilityTimeout: cdk.Duration.minutes(15),
			deadLetterQueue: { queue: scannerDlq, maxReceiveCount: 5 },
			enforceSSL: true,
		});

		const imageProcessor = new lambda.Function(this, "ImageProcessor", {
			functionName: `${namePrefix}-image-processor`,
			runtime: lambda.Runtime.NODEJS_22_X,
			handler: "index.handler",
			code: lambda.Code.fromInline(`
exports.handler = async (event) => {
  console.log("Image processor placeholder", JSON.stringify(event));
  return { ok: true };
};
`),
			timeout: cdk.Duration.minutes(5),
			memorySize: 1024,
			environment: {
				PRIVATE_BUCKET: privateBucket.bucketName,
				PUBLIC_BUCKET: publicOriginBucket.bucketName,
			},
		});

		const clamAvScanner = new lambda.Function(this, "ClamAvScanner", {
			functionName: `${namePrefix}-clamav-scanner`,
			runtime: lambda.Runtime.NODEJS_22_X,
			handler: "index.handler",
			code: lambda.Code.fromInline(`
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");

const EICAR_SIGNATURE = "X5O!P%@AP[4\\\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

function resolvePayload(event) {
  if (event.bucket && event.key && event.fileId) {
    return { bucket: event.bucket, key: event.key, fileId: event.fileId };
  }
  throw new Error("Invalid scanner invoke payload");
}

async function readObjectBody(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

exports.handler = async (event) => {
  const { bucket, key } = resolvePayload(event);
  const s3 = new S3Client({});
  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = await readObjectBody(object.Body);
  const haystack = body.toString("utf8");
  const infected = haystack.includes(EICAR_SIGNATURE);
  return {
    clean: !infected,
    scanResult: infected ? "EICAR-TEST-SIGNATURE" : "OK",
  };
};
`),
			timeout: cdk.Duration.minutes(10),
			memorySize: 2048,
			environment: {
				PRIVATE_BUCKET: privateBucket.bucketName,
			},
		});

		privateBucket.grantRead(imageProcessor);
		privateBucket.grantReadWrite(imageProcessor);
		publicOriginBucket.grantReadWrite(imageProcessor);
		privateBucket.grantRead(clamAvScanner);

		imageProcessor.addEventSource(new lambdaEventSources.SqsEventSource(processingQueue, { batchSize: 5 }));

		privateBucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.SqsDestination(processingQueue), {
			prefix: "staging/products/",
		});

		const originAccessControl = new cloudfront.S3OriginAccessControl(this, "PublicOriginOac", {
			originAccessControlName: `${namePrefix}-public-oac`,
			description: `OAC for ${namePrefix} public origin bucket`,
		});

		const distribution = new cloudfront.Distribution(this, "PublicDistribution", {
			comment: `${namePrefix} public asset CDN`,
			defaultBehavior: {
				origin: origins.S3BucketOrigin.withOriginAccessControl(publicOriginBucket, {
					originAccessControl,
				}),
				viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
				cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
				allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
			},
			minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
		});

		const apiUploadUser = new iam.User(this, "ApiUploadUser", {
			userName: `${namePrefix}-api-upload`,
		});

		privateBucket.grantReadWrite(apiUploadUser, "staging/*");
		privateBucket.grantReadWrite(apiUploadUser, "products/*");
		privateBucket.grantReadWrite(apiUploadUser, "stores/*");
		privateBucket.grantReadWrite(apiUploadUser, "users/*");
		privateBucket.grantReadWrite(apiUploadUser, "kyb/*");
		publicOriginBucket.grantRead(apiUploadUser);
		clamAvScanner.grantInvoke(apiUploadUser);

		new cloudwatch.Alarm(this, "ProcessingDlqAlarm", {
			alarmName: `${namePrefix}-processing-dlq-depth`,
			metric: processingDlq.metricApproximateNumberOfMessagesVisible(),
			threshold: 1,
			evaluationPeriods: 1,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
		});

		new cloudwatch.Alarm(this, "ScannerDlqAlarm", {
			alarmName: `${namePrefix}-scanner-dlq-depth`,
			metric: scannerDlq.metricApproximateNumberOfMessagesVisible(),
			threshold: 1,
			evaluationPeriods: 1,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
		});

		new cdk.CfnOutput(this, "PrivateBucketName", { value: privateBucket.bucketName });
		new cdk.CfnOutput(this, "PublicOriginBucketName", { value: publicOriginBucket.bucketName });
		new cdk.CfnOutput(this, "CloudFrontDomain", { value: distribution.distributionDomainName });
		new cdk.CfnOutput(this, "ProcessingQueueUrl", { value: processingQueue.queueUrl });
		new cdk.CfnOutput(this, "ScannerQueueUrl", { value: scannerQueue.queueUrl });
		new cdk.CfnOutput(this, "ClamAvScannerArn", { value: clamAvScanner.functionArn });
		new cdk.CfnOutput(this, "ApiUploadUserName", { value: apiUploadUser.userName });
	}
}
