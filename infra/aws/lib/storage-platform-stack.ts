import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";

import { apiRoleTrustPrincipal, readApiRoleTrust, type ApiRoleTrust } from "./api-role-trust.js";
import { readContextStringList } from "./cdk-context.util.js";

const DEFAULT_BROWSER_ORIGINS: readonly string[] = ["http://localhost:3000", "http://localhost:3001", "http://localhost:3003"];

/** Key prefixes of every file category in the private bucket (staging uploads + promoted finals). */
const PRIVATE_KEY_PREFIXES: readonly string[] = ["staging/", "kyb/", "products/", "stores/", "users/"];
/** Key prefixes of the public categories, the only objects the API publishes to the CloudFront origin. */
const PUBLIC_KEY_PREFIXES: readonly string[] = ["products/", "stores/", "users/"];
/**
 * Private-bucket object actions the S3 adapter performs: PutObject (uploads,
 * presigned POST, copy destination), GetObject (downloads, HeadObject,
 * presigned GET, copy source) and DeleteObject (staging cleanup, purge).
 */
const PRIVATE_OBJECT_ACTIONS: readonly string[] = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"];
/** Public-origin actions: PutObject (publish = copy in) and DeleteObject (withdraw). The API never reads it back. */
const PUBLIC_OBJECT_ACTIONS: readonly string[] = ["s3:PutObject", "s3:DeleteObject"];

/**
 * An `s3.Bucket` that is assignable to `s3.IBucket` under `exactOptionalPropertyTypes`.
 *
 * Upstream CDK types `Bucket#isWebsite` as a getter returning `boolean | undefined`
 * while `IBucket#isWebsite` is `isWebsite?: boolean`, so a concrete `Bucket` cannot be
 * passed where an `IBucket` is expected (e.g. `S3BucketOrigin.withOriginAccessControl`)
 * with that compiler flag on. This narrows the getter to the documented `@default false`
 * — every CDK consumer only tests it for truthiness, so the synthesized template is
 * unchanged. Remove once aws-cdk-lib aligns the two declarations.
 */
class OriginBucket extends s3.Bucket {
	public override get isWebsite(): boolean {
		return super.isWebsite ?? false;
	}
}

export interface StoragePlatformStackProps extends cdk.StackProps {
	readonly environmentName: string;
	readonly browserOrigins?: readonly string[];
	/** Who assumes the API role; defaults to the `apiTrust*` CDK context (ECS task role when unset). */
	readonly apiTrust?: ApiRoleTrust;
}

function objectArns(bucket: Pick<s3.IBucket, "arnForObjects">, prefixes: readonly string[]): string[] {
	return prefixes.map((prefix: string): string => bucket.arnForObjects(`${prefix}*`));
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

		const publicOriginBucket = new OriginBucket(this, "PublicOriginBucket", {
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

		const apiTrust: ApiRoleTrust = props.apiTrust ?? readApiRoleTrust(this.node);
		// The API's only AWS identity: an IAM role with temporary credentials,
		// resolved by the AWS SDK default credential chain at runtime. No IAM
		// user and no access key exists anywhere in this stack.
		const apiRole = new iam.Role(this, "ApiRole", {
			roleName: `${namePrefix}-api`,
			description: `Object storage access for the ${namePrefix} API (assumed by: ${apiTrust.kind})`,
			assumedBy: apiRoleTrustPrincipal(apiTrust, this.account),
			maxSessionDuration: cdk.Duration.hours(1),
		});

		apiRole.addToPrincipalPolicy(
			new iam.PolicyStatement({
				sid: "PrivateBucketObjects",
				actions: [...PRIVATE_OBJECT_ACTIONS],
				resources: objectArns(privateBucket, PRIVATE_KEY_PREFIXES),
			}),
		);
		// Lets a missing key answer 404 (not 403) to HeadObject/GetObject, which
		// the adapter maps to "object not found".
		apiRole.addToPrincipalPolicy(
			new iam.PolicyStatement({
				sid: "PrivateBucketMissingKeyAs404",
				actions: ["s3:ListBucket"],
				resources: [privateBucket.bucketArn],
			}),
		);
		apiRole.addToPrincipalPolicy(
			new iam.PolicyStatement({
				sid: "PublicOriginPublish",
				actions: [...PUBLIC_OBJECT_ACTIONS],
				resources: objectArns(publicOriginBucket, PUBLIC_KEY_PREFIXES),
			}),
		);

		// Deleting a public asset purges its key from this distribution's cache
		// (the API's storage.cdn-invalidate job). Scoped to this one distribution.
		apiRole.addToPrincipalPolicy(
			new iam.PolicyStatement({
				sid: "PublicCdnInvalidation",
				actions: ["cloudfront:CreateInvalidation"],
				resources: [this.formatArn({ service: "cloudfront", region: "", resource: "distribution", resourceName: distribution.distributionId })],
			}),
		);

		if (apiTrust.kind === "ec2-instance") {
			const instanceProfile = new iam.InstanceProfile(this, "ApiInstanceProfile", {
				instanceProfileName: `${namePrefix}-api`,
				role: apiRole,
			});
			new cdk.CfnOutput(this, "ApiInstanceProfileArn", { value: instanceProfile.instanceProfileArn });
		}

		new cdk.CfnOutput(this, "PrivateBucketName", { value: privateBucket.bucketName });
		new cdk.CfnOutput(this, "PublicOriginBucketName", { value: publicOriginBucket.bucketName });
		new cdk.CfnOutput(this, "CloudFrontDomain", { value: distribution.distributionDomainName });
		new cdk.CfnOutput(this, "CloudFrontDistributionId", { value: distribution.distributionId });
		new cdk.CfnOutput(this, "ApiRoleArn", { value: apiRole.roleArn });
	}
}
