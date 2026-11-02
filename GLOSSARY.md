# Rewards

The consumer rewards vertical: a merchant publishes rewards, a customer claims and redeems them, and a user can refer other users.

## Language

**Referrer**:
A user who refers another user.
_Avoid_: Inviter, sponsor, ambassador

**Referee**:
A user who was referred by a referrer.
_Avoid_: Invitee, friend, lead

### Reward referral

The reward-scoped relationship already in the product. It is a different thing from a signup referral.

**Reward referral**:
A recorded relationship between one referrer, one reward, and one attribution token. It names at most one referee.
_Avoid_: Signup referral, referral code

**Attribution token**:
The unique identifier of one reward referral.
_Avoid_: Referral code, coupon

**Referrer reward**:
The reward paid to the referrer when a reward referral is credited.
_Avoid_: Bonus, kickback, commission

**Referral pool**:
The limited number of referrer rewards one reward can pay.
_Avoid_: Quota, budget, cap

**Pending**:
A reward referral that has been recorded and has not been credited.
_Avoid_: Open, sent, waiting

**Credited**:
A reward referral whose referrer has received the referrer reward.
_Avoid_: Paid, settled, successful

**Blocked**:
A reward referral that will not be credited.
_Avoid_: Rejected, invalid, fraud

### Signup referral

**Referral code**:
A code owned by one referrer. Other people may register with that same code while it is valid.
_Avoid_: Attribution token, invite link, coupon

**Signup referral**:
The record that one referee registered with one referrer's referral code.
_Avoid_: Reward referral, invite, affiliate

**Successful**:
A signup referral whose referee has redeemed at least one reward.
_Avoid_: Credited, paid, converted

**Not redeemed**:
A signup referral whose referee has not redeemed a reward yet.
_Avoid_: Pending, open, waiting

## Context-owned terms

**Tenant** (tenancy):
The customer company and the isolation boundary: every tenant-owned row carries its `tenantId`. Shown to users as "Store" or "Business".
_Avoid_: Organization, org, account

**Location** (tenancy):
A branch inside one tenant. Never a tenant itself.
_Avoid_: Shop, outlet, site

**Membership** (tenancy):
The link between a user and a tenant, with a role and location scopes.
_Avoid_: Employment, seat

**Customer** (claims):
A user with no membership. Their claims and wallet are user-owned, not tenant-owned.
_Avoid_: Consumer account, member

**Platform staff** (identity):
RewardHub's own superadmins and admins, working in the admin app. Not tenant admins; on tenant data they need a support access grant.
_Avoid_: Tenant admin, operator

**Support access grant** (authorization):
A tenant owner's time-boxed, audited approval for platform staff to work inside that tenant.
_Avoid_: Backdoor, override

**System operation** (platform):
A named, audited privileged database access with an explicit table list. The only way any code passes an RLS bypass.
_Avoid_: Bypass, superuser mode

**Claim** (claims):
A customer's request to redeem one reward. The claims context owns the claim row and its one-time code.
_Avoid_: Redemption, coupon use

**Sale** (pos):
One checkout at a terminal. The point-of-sale context owns the sale. A repeated checkout with the same idempotency key is the same sale.
_Avoid_: Order, transaction

**Referral credit** (referrals):
The credit a referrer receives when a signup referral becomes successful. The referrals context owns the credit. The reward itself stays with rewards.
_Avoid_: Commission, payout

**KYB decision** (rewards):
The know-your-business outcome for a merchant's evidence files. Rewards owns the decision. Files owns the stored object and the scan verdict.
_Avoid_: Verification, approval

**Terminal pairing** (pos):
The one-time step that binds a till to a tenant and returns that till's API key. Tenants record the terminal. Point of sale performs the pairing.
_Avoid_: Login, device registration

**Store closure** (tenants):
Closing a location so it can no longer sell. Tenants owns the location lifecycle.
_Avoid_: Delete store, deactivate

### Platform operations

What the platform's own operators see and do about the platform itself, as opposed to anything a merchant or customer does.

**Server** (operations):
One machine the platform runs on, such as a DigitalOcean droplet. Its health is the machine's own CPU, memory, disk and network.
_Avoid_: Host, box, node, VPS

**Server agent** (operations):
The small program installed on a server that reports that server's health to the platform. On a developer's laptop, the laptop is the server.
_Avoid_: Daemon, collector, exporter

**Instance** (operations):
One running copy of a platform process (the API, a worker, the analytics consumer) on a server. One server can run several instances.
_Avoid_: Server, container, pod, replica

**Dependency** (operations):
A service the instances need but do not run themselves: PostgreSQL, Redis, Kafka, RabbitMQ and the job queues.
_Avoid_: Service, integration, backend

**Alert** (operations):
One incident in which a server, instance, dependency, service or objective crossed a threshold or went silent. It is open until the condition clears, and it is resolved after that.
_Avoid_: Notification, alarm, warning

**Backup** (operations):
A complete, downloadable copy of the platform's database at one moment.
_Avoid_: Snapshot, dump, export

**Pinned backup** (operations):
A backup that the retention period never removes.
_Avoid_: Kept, locked, archived

**Load test** (operations):
One run of synthetic traffic against the platform, with a fixed rate, a fixed duration and recorded results.
_Avoid_: Stress test, benchmark, performance test

**Scenario** (operations):
A named user journey, such as claiming a reward, replayed as synthetic traffic in a load test.
_Avoid_: Script, test case, flow

**Traffic mix** (operations):
A load test of the whole platform: every scenario at once, each with a weight.
_Avoid_: Full test, platform test, blend

**Load Test tenant** (operations):
The dedicated tenant, with its own seeded users, that every load test acts inside, so that no real tenant's data is touched.
_Avoid_: Test tenant, sandbox

**Load-test user** (operations):
A user who exists only inside the Load Test tenant, so that scenarios can act as it. It can never hold a platform role or join another tenant.
_Avoid_: Bot, fake user, virtual user

**Load-test purge** (operations):
Permanently removing everything the Load Test tenant and its load-test users created. It is the one removal in the platform that is not a soft delete.
_Avoid_: Reset, cleanup, wipe

### Application observability

What the platform's own code does while it runs, request by request and job by job, as opposed to the health of the machines it runs on. Shown to platform staff as *Observe*.

**Service** (observability):
One application registered to report what its code does, such as the API or the worker. Its instances are the running copies of it.
_Avoid_: App, project, source, Dependency

**Operation** (observability):
One named kind of work a service does: a route, a job, a message handler or a scheduled task.
_Avoid_: Endpoint, transaction, route

**Trace** (observability):
One run of an operation, from the moment it started to the moment it answered, together with everything it called along the way.
_Avoid_: Request, execution, transaction

**Span** (observability):
One timed call inside a trace, such as a method, a database query or an outgoing request.
_Avoid_: Step, segment, call

**Issue** (observability):
All the errors that share one cause, counted together however often they happen.
_Avoid_: Error group, exception, bug, incident

**Objective** (observability):
A promise one operation makes about how often it succeeds or how fast it answers, judged over a rolling window.
_Avoid_: SLO, target, SLA

**Release** (observability):
The version of a service that its instances were running when they reported.
_Avoid_: Deploy, build, version

**Replay** (observability):
A recording of what one person saw and did in a web page or the mobile app during a session, played back for platform staff.
_Avoid_: Session recording, screen recording, video

**Client key** (observability):
The public key a web page or mobile app reports with. It can only send telemetry, never read it.
_Avoid_: DSN, public token, app key

### Notifications

Everything the platform tells a person, on any channel, and what that person agreed to receive.

**Notification** (notifications):
One message meant for one recipient, of one notification type. It may reach the recipient on several channels.
_Avoid_: Alert, message, push

**Notification type** (notifications):
A named kind of notification the platform knows how to send, with its category, the channels it may use and the surfaces it shows on.
_Avoid_: Template, event, notification kind

**Recipient** (notifications):
Whoever a notification is for: either a user or a contact point.
_Avoid_: Target, addressee, subscriber

**Contact point** (notifications):
A bare email address or phone number of someone who may have no account, such as an invited person. It has no inbox and no preferences.
_Avoid_: Contact, lead, guest, Customer

**Channel** (notifications):
A way a notification reaches a person: in-app, email, push or SMS.
_Avoid_: Medium, transport, provider

**Delivery** (notifications):
One notification's journey through one channel, from queued to delivered, failed or suppressed.
_Avoid_: Send, attempt, dispatch

**Suppressed** (notifications):
A delivery the platform chose not to make, for a recorded reason such as a preference, quiet hours or a missing device.
_Avoid_: Skipped, dropped, blocked

**Category** (notifications):
The group a notification type belongs to (security, account, transactional, product, marketing). Preferences act on categories, not on single types.
_Avoid_: Topic, group, channel

**Mandatory channel** (notifications):
A channel a category is always sent on, whatever the person's preferences say.
_Avoid_: Forced, required notification

**Preference** (notifications):
A person's choice to receive or not receive one category on one channel, either everywhere or for one tenant.
_Avoid_: Setting, subscription, opt-in

**Consent** (notifications):
A recorded, provable agreement to receive marketing, with when, where and to which wording it was given. A preference alone is not consent.
_Avoid_: Opt-in, permission, preference

**Surface** (notifications):
The audience side of the product a notification belongs to: customer, merchant or admin. A notification shows only on its own surface.
_Avoid_: App, portal, frontend

**Broadcast** (notifications):
A notification written by a person, not by the platform, and sent to an audience: platform staff to users, or a tenant to its own customers.
_Avoid_: Campaign, blast, announcement, newsletter

**Tenant customer** (notifications):
A user who has claimed at least one of a tenant's rewards, whatever memberships they hold elsewhere. That tenant's own staff are never its tenant customers.
_Avoid_: Follower, subscriber, member, Customer

**Leaving a tenant** (notifications):
A tenant customer's choice to stop hearing from one tenant until they claim from it again. It withdraws their consent for that tenant.
_Avoid_: Unfollow, unsubscribe, block

**Broadcast report** (notifications):
A recipient's complaint that a tenant's broadcast is spam or offensive, reviewed by platform staff.
_Avoid_: Flag, complaint, abuse ticket

**Audience** (notifications):
The set of recipients a broadcast is sent to, decided when it starts sending.
_Avoid_: Segment, list, target group

**Grouping** (notifications):
Folding several notifications of one type for one person into a single one, such as "You earned 10 referral credits".
_Avoid_: Batching, bundling, stacking

**Digest** (notifications):
One email that gathers a person's notifications from a day or a week, sent in place of one email each.
_Avoid_: Summary, newsletter, roundup

**Fallback** (notifications):
A second channel a notification type uses when its first channel cannot deliver at all.
_Avoid_: Escalation, retry, backup channel

**Sensitive notification** (notifications):
A notification that carries a secret, such as a one-time code. Its content is never kept and never shown on a lock screen.
_Avoid_: Private, secret, confidential notification

**Quiet hours** (notifications):
A daily period in the person's own time zone during which non-urgent notifications wait.
_Avoid_: Do not disturb, mute, snooze

**Push device** (notifications):
One installed copy of the mobile app that can receive push notifications for the person signed in to it.
_Avoid_: Device token, handset, subscription

### Rate limiting

**Rate-limit policy** (platform):
A named rule saying how much of something one subject may do in a period of time.
_Avoid_: Throttle, quota, limit rule

**Rate-limit subject** (platform):
Who or what a rate-limit policy counts: an address, a signed-in principal, a tenant, an API key or a destination.
_Avoid_: Key, bucket, client

**Tenant override** (platform):
A platform-staff decision that raises or lowers one rate-limit policy for one tenant, with a reason and an end date.
_Avoid_: Plan, quota, exception

**Exemption** (platform):
A subject a rate-limit policy counts but never refuses, such as platform health checks or the Load Test tenant.
_Avoid_: Whitelist, allowlist, bypass

**Penalty** (platform):
A longer refusal given to a subject that keeps hitting a security policy, growing with each repeat.
_Avoid_: Ban, lockout, block
