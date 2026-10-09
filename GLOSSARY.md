# Reward Hub

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
