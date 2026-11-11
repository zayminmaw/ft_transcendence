# Company activity insights

A company administrator can see how their own people use the system, as counts only. The page is for the company that was verified for the request. It never names a person and never shows what another company knows.

## What is recorded

One table, `company_activity_days`, with one row for each member, company and UTC day, and how many times the member came in that day. It holds no content, no address and no device.

| Event | When it is written |
| --- | --- |
| Active day | A member connects to a company over the websocket, after the membership check. Written at most once for each member, company and UTC day for each server process. |
| Visit | The presence registry sees a member go from offline to online in that company. A second tab, or a reconnect inside the 30 second grace, adds no visit. |

"Active" means the member had the company open that day. It does not mean they clicked anything, so a tab left open in the background counts.

Rows older than 90 days are deleted, by the first connection of each UTC day. Deleting a user or a company deletes its rows. History starts when recording was added, and the page says so when there is none yet. Presence is only in memory, so after a server restart everyone who reconnects counts as a new visit.

## The endpoint

`GET /api/activity-insights?range=7|30|90` (default 30). It needs a signed-in user, the `X-Organization-Id` header and the `admin.audit_logs` permission in that company. That is the audit trail's permission, so in the seeded roles it belongs to the company administrator and the finance role. Any other range value is a 400, and so is an unknown query parameter, so a company can never be named in the query.

The range counts UTC days and includes today, so 7 days is today and the six days before it.

## What it returns

| Field | Meaning |
| --- | --- |
| `members.active` and `members.total` | Distinct members with an activity row in the range, and the company's current active members (active membership and active account). |
| `visits` | The sum of visits in the range. |
| `activeByDay` | One entry for every day in the range, zeros included. |
| `activeByRole` | Active members grouped by the role they hold now. Roles with no one are left out. |
| `changes.total` and `changes.byModule` | Creates, updates and deletes of business data that succeeded, in total and for the six busiest modules. Members, auth, audit and insights are left out. Members have their own cards below, and the others are the system's own records. |
| `security.passwordResets` | An administrator reset a member's password. |
| `security.accountsSwitchedOff` | Memberships switched off. Switching one back on is not counted. |
| `security.roleChanges` | A member's role changed. |
| `security.deniedAttempts` | Someone without permission tried to open the audit trail or this page, in this company. |
| `hasHistory` | False until the company has any activity row. |

Only current active members count in every card that comes from activity rows, under the role they hold now, so the cards agree with each other. Someone who has left or been switched off drops out of all of them. A person who works in two companies is counted in each, from that company's own rows.

## What is not shown

No usernames, ids of people, email addresses, IP addresses, user agents, or old and new values. Sign-ins, failed sign-ins and session reuse belong to the account and not to a company, because nobody has chosen a company when they sign in, so they are not on this page. A list of members by last activity is not built, because it names people.

## Audit

Every read is written to the audit trail (module `insights`, resource `activity_insight`, action `read`, category `access`, so it is kept for 90 days) with the range. A refused read is written as `denied`, in the company the person asked about when they really are an active member there.

## Where the code is

`backend/src/modules/insights`. The recorder and the table are in `InsightsStoreModule`, which the notifications module imports. The endpoint is in `InsightsModule`.
