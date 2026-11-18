# Shared frontend/auth hosting proposal

Provisioned on 18 November 2026 after user approval. This root exclusively owns one Linux B1 App Service plan,
`gen7erp-web-prod`, Canada East, one instance. Frontend consumes its ID from
`infra/azure/frontend`; auth will consume the same ID in a separate state.
The CDN plan `gen7erp-cdn-prod` is outside this root and is unchanged.

The migration sessions agreed on this ownership split on 18 November 2026.
Measured CDN-plan memory over the previous 24 hours averaged approximately
71.4%, peaking at 96%; six recent hourly averages were 70-74%. This is evidence
against casually adding auth/frontend to that plan, not a load test or a sizing
guarantee for the proposed plan. Monitor both new apps together during preview.

## Review before provisioning

- Azure Retail Prices API, queried 18 November 2026: Linux B1 Canada East
  **CA$0.0253/hour**, or **CA$18.47 at 730 hours** for the shared plan.
- The frontend proposal separately adds Basic ACR at **CA$0.2339/day**, about
  **CA$7.11 for 730 hours**. Combined baseline: approximately **CA$25.58/month**.
- Database hosting, excess registry storage, state storage, network egress,
  tax and other usage are additional. Relay was not provisioned and is no
  longer planned. These are public retail estimates, not the subscription's
  negotiated bill. Existing CDN costs are excluded.
- Read-only regional quota API returned Total Regional VMs 0/31. It did not
  return a B1-specific allocation. This does **not** guarantee future B1 placement.
  The one reviewed plan was subsequently provisioned successfully.
- Microsoft.Web and Microsoft.ContainerRegistry were already Registered.
  Provider registration is disabled in both proposed Terraform roots. Neither
  root requests quota increases or modifies provider registration.
- Applying this root starts compute charges even before either app is ready.
  The one reviewed plan and separate frontend root are now provisioned.

## State and sequence

Remote backend is the existing Azure AD-authenticated state container, separate
key `web-hosting/production.tfstate`. The frontend key is
`frontend/production.tfstate`. Neither GitHub deployment identity can modify
the hosting plan or Terraform state. No application secrets are in this root.

Review a fresh plan, merge through the normal PR process, and only then apply
the reviewed hosting plan before the frontend/auth app roots. Do not import
or move CDN resources into this state. Retain `prevent_destroy`; resizing and
changing shared settings require coordination with both app owners.

```sh
terraform -chdir=infra/azure/web-hosting init -input=false
terraform -chdir=infra/azure/web-hosting plan -input=false -out=review.tfplan
```

State, provider cache and review plans are ignored by the existing Azure
`.gitignore`; provider lock files are committed. Do not commit plan/state dumps.

[App Service shared-plan behavior](https://learn.microsoft.com/en-us/azure/app-service/overview-hosting-plans)
and [Azure Retail Prices API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices)
describe the resource/cost model. A healthy preview and observed real traffic
are required before deciding this plan is suitable for production.
