# App Service quota discrepancy: investigation record

## Resolution for migration progress: Canada East B1 creation succeeded

The empty Free Canada East comparison plan was subsequently destroyed through
its dedicated Terraform state at the user's request (one resource destroyed).
The B1 plan was not part of that cleanup. Diagnostic evidence is retained.

On 16 November 2026 the user authorized trying the agreed B1 plan in Canada
East. A reviewed targeted Terraform recovery plan created only
`azurerm_service_plan.cdn`: **1 added, 0 changed, 0 destroyed**. CLI confirmed
`gen7erp-cdn-prod`, Canada East, Linux, B1 / Basic, capacity 1. It is recorded in
the original CDN remote state. Paid compute billing now applies.

A full post-apply plan refresh found the existing resources unchanged and
proposed only the remaining app and three role assignments: **4 additions,
0 changes, 0 deletions**. No web apps exist yet. Production and media remain
untouched. This confirms Canada East B1 creation works despite the previously
missing B1-specific usage row. The precise Canada Central enforcement issue
is still unresolved; its historical evidence below remains available.

Observed 16 November 2026. The original B1 retry was followed by one explicitly
authorized empty Free F1 probe in the same region. No quota changes, support
requests, or alternative-region requests were submitted. No application deployment,
media copy, production routing change, or VPS shutdown occurred.

## Confirmed evidence

### Post-restart continuation: 16 November 2026, recorded 18:56 UTC

The existing CLI sign-in still targets the Enabled Gen7Fuel subscription and
the expected tenant. `az` is still absent from this process's PATH; its installed
absolute path works with access to the existing Azure profile. No credentials
were cleared and no new sign-in was required.

A fresh Terraform plan against the existing remote CDN state proposed exactly
**5 additions, 0 changes, 0 deletions**. Applying that saved continuation plan
again failed creating `gen7erp-cdn-prod` with HTTP **401**, extended code
**70007**, and the same claimed B1 limit 0 / usage 0 / required 1. Published F1,
B1, and total regional quotas were **0 used / 30 allowed** both before and after.
The CLI/environment restart therefore did not resolve the provisioning failure.

Afterward, group plan and web-app listings were empty. Remote state still lists
the same four managed resources: vault, operator secret role, GitHub identity,
and federated credential. No production deployment, routing change, media copy,
or VPS shutdown occurred. The saved `resume.tfplan` is ignored local material;
generate a fresh plan before any future apply.

The activity log had not exposed this new attempt at the time of the follow-up
reads; no new correlation ID was obtained. A broader read also returned older
records with resource type casing `Microsoft.Web/serverfarms`, unlike the earlier
historical `serverFarms` record. Future filters must compare case-insensitively.
The prior direct-request JSON evidence and identifiers remain unchanged.
Microsoft investigation remains the next hosting step; no support message or
quota request has been submitted.

Subsequent CLI investigation recovered the post-restart activity record:
`2026-11-16T18:56:06.4479131Z`, correlation
`c68bd495-b140-ea02-9898-3f1f9569b8db`. Its status message confirms HTTP 401 /
70007 and the same B1 limit-zero denial. Microsoft.Web remains Registered, and
Linux B1 location discovery still includes Canada Central (also Canada East).
These discovery results do not prove subscription-specific deployment capacity.

A read-only `Microsoft.Web/deploymentLocations?api-version=2025-05-01`
request returned Canada Central with `regionalConstraintLevel: 5` and
`zoneRedundantConstraintLevel: 5`, versus Canada East with both fields `0`.
This is a new regional difference worth asking Microsoft to explain. The public
endpoint schema does not document these fields or their numeric meanings, so
this does not establish the cause or prove that Canada East creation will work.
No creation request was made in Canada East.

### Authorized Canada East F1 comparison: 19:25 UTC

The user subsequently authorized that comparison. One empty Linux F1 plan,
`gen7erp-cdn-f1-east-probe`, was successfully created in Canada East / Gen7ERP.
ARM returned HTTP 200 with provisioningState Succeeded. Correlation ID:
`f59e1eb4-b886-467d-8d9d-88937c35e82b`; request ID:
`07c6f0b0-f00b-49c1-aeae-0c84e1643c99`. The initial wire response called the
SKU U13 / LinuxFree; subsequent CLI and AzureRM reads normalize it to F1 / Free.

The [sanitized evidence](f1-east-probe-2026-11-16.json) preserves quota snapshots:
only Total Regional VMs was returned by the filtered east-region response,
0/30 before and 0/31 after. No quota modification was requested. Do not infer
that this snapshot reports an F1-specific allowance.

The plan was imported into the [separate diagnostic Terraform root](../../f1-east-probe/README.md)
and remote key `diagnostics/f1-east-probe.tfstate`; its verification plan reports
No changes. Gen7ERP web-app listing remains empty. No app, code deployment,
media copy, production switch, paid SKU, or source shutdown was performed.

This rules out an across-all-regions inability to create a Free Linux plan in
this subscription. The observed creation failure is region-dependent in this
comparison. It does not establish the internal Canada Central restriction or
prove B1 availability in Canada East. Production Terraform remains unchanged.

| Item | Observation |
| --- | --- |
| Subscription | Gen7Fuel, `29b24248-1990-4592-b25d-e6ee8e9db784` |
| Subscription state | Enabled |
| Subscription quota/offer ID | `PayAsYouGo_2014-09-01` |
| Spending limit | Off |
| Target | Gen7ERP, Linux App Service B1, capacity 1, Canada Central |
| Linux B1 region discovery | Canada Central appears in `az appservice list-locations --sku B1 --linux-workers-enabled` |
| Microsoft.Web usages API 2025-03-01 | B1 VMs 0/30; Total Regional VMs 0/30 |
| Microsoft.Web usages API 2025-05-01 | B1 VMs 0/30; Total Regional VMs 0/30 |
| Controlled direct ARM retry | HTTP 401, extended code 70007, reports B1 limit 0 and requires 1 |
| Quotas immediately before AND after retry | Both counters remain 0 used / 30 limit |
| Resources left by retry | No App Service plan; subsequent group plan listing was empty |

The standalone REST retry bypassed Terraform. Its exact payload specified
`kind=linux`, `reserved=true`, `zoneRedundant=false`, Basic/B1 and capacity 1.
This rules out a Terraform-only failure and an accidentally requested zone-
redundant plan for this retry. The region/subscription/SKU match the quota reads.
It does NOT establish whether Azure's internal enforcement uses an additional
counter, subscription eligibility rule, stale state, or another restriction.
Do not label an unobserved internal mechanism as the root cause.

## Request identifiers

- Original Terraform attempt: `2026-11-16T16:40:13.0346261Z`.
- Original activity correlation: `5e20ea03-5a67-209f-43d9-695d19126252`.
- Direct REST retry: `2026-11-16T17:25:04.556Z` to `17:25:06.985Z`.
- Retry request/correlation ID: `8ded244b-503a-49d0-8677-c128951dbfd9`.
- Retry client request ID: `64a40107-d92b-44d5-9b45-ecfbe7a63503`.
- Routing ID: `CANADACENTRAL:20261116T172506Z:8ded244b-503a-49d0-8677-c128951dbfd9`.
- Resource ID: `/subscriptions/29b24248-1990-4592-b25d-e6ee8e9db784/resourceGroups/Gen7ERP/providers/Microsoft.Web/serverfarms/gen7erp-cdn-prod`.

The sanitized [request/response record](plan-retry-2026-11-16.json) retains the
wire payload, error response, quota counters, timestamps and selected ARM
headers. It contains no authorization headers, access tokens, passwords,
storage keys, or application secret values. Do not attach Terraform state or
credential files to a support case.

The original failed activity was recovered by querying resource type
`Microsoft.Web/serverFarms` with Azure's actual casing. The earlier exact-case
filter `Microsoft.Web/serverfarms` excluded it; the absence of earlier query
results was a filtering issue, not evidence that Azure had no activity record.

## Conclusion and next diagnostic boundary

### Free F1 probe: 17:53 UTC

The user authorized one empty Free F1 Linux plan in Gen7ERP / Canada Central,
named `gen7erp-cdn-f1-probe`. The request used SKU F1 / Free, capacity 1,
`reserved=true`, and `zoneRedundant=false`. Azure returned HTTP 401 with
Current Limit (F1 VMs): 0, usage 0, required 1. Before AND after that request,
the usages API reported F1 0/30, B1 0/30, and Total Regional VMs 0/30.

- Attempt started: `2026-11-16T17:53:59.059Z`.
- Request/correlation ID: `7551f791-e0a9-46f2-87d9-adbb4f93f0ea`.
- [Sanitized F1 request/response](f1-probe-2026-11-16.json).
- Subsequent App Service plan and web-app group listings both returned empty.

No F1 plan or application was created, and no compute charge started. The
production B1 Terraform configuration was not changed to F1. This demonstrates
the failure is not exclusive to the B1/paid tier for Linux in Canada Central;
it does not establish behavior in other regions or for Windows workloads.
The exact internal enforcement reason remains unconfirmed.

### Current conclusion

The public quota reporting and the creation-time enforcement disagree. The
current published allowance is not zero, so an instruction to request a new
total limit of 1 is inappropriate. No ordinary regional/SKU mismatch, disabled
subscription, trial offer, or Terraform-only behavior was found in these checks.
The exact internal denial reason is not exposed in the returned evidence.
Microsoft must correlate the identifiers above to explain or correct it.

### Draft for a Microsoft investigation (not submitted)

Subject: App Service Linux B1 and Free F1 creation report limit 0 despite visible quotas of 30

Please investigate the effective quota/eligibility check for Gen7Fuel subscription
`29b24248-1990-4592-b25d-e6ee8e9db784` in Canada Central. We are creating one
non-zone-redundant Linux B1 App Service plan in resource group Gen7ERP.

Both B1 VMs and Total Regional VMs show usage 0, limit 30 in Microsoft.Web usages
API versions 2025-03-01 and 2025-05-01, consistent with the portal. The subscription
is Enabled, PayAsYouGo_2014-09-01, spendingLimit Off, and Canada Central appears
in Linux B1 location discovery.

Nevertheless, a direct REST PUT at 2026-11-16T17:25:04.556Z using API 2025-03-01
failed with HTTP 401 / extended code 70007, reporting Current Limit (B1 VMs): 0,
usage 0, required 1. Counters were read immediately before and after and remained
0/30. Request/correlation ID: `8ded244b-503a-49d0-8677-c128951dbfd9`.

A subsequent authorized Free F1 Linux probe in the same region at
2026-11-16T17:53:59.059Z also returned HTTP 401, reporting Current Limit (F1 VMs): 0.
F1, B1, and Total Regional VMs each showed usage 0 / limit 30 before and after.
F1 request/correlation ID: `7551f791-e0a9-46f2-87d9-adbb4f93f0ea`. Both attempts
left no App Service plan or app. The issue is therefore not exclusive to B1.

Please identify the effective counter or eligibility rule used by this request
and reconcile it with the visible quota, rather than assuming the listed
allowance is exhausted. We have not changed quota or tried another region.
The request/response JSON is available as an attachment. This is a migration
blocker; no existing production outage is being claimed.

## References

- [App Service quota guidance](https://learn.microsoft.com/en-us/troubleshoot/azure/app-service/troubleshoot-non-zone-redundant-quota-requests)
- [App Service plan create/update REST API](https://learn.microsoft.com/en-us/rest/api/appservice/app-service-plans/create-or-update?view=rest-appservice-2025-05-01)
- [Regional usages API](https://learn.microsoft.com/en-us/rest/api/appservice/get-usages-in-location/list?view=rest-appservice-2025-05-01)
