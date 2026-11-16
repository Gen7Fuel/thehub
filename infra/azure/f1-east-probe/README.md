# Empty Canada East Free-plan diagnostic

**Cleanup completed, 16 November 2026:** at the user's request Terraform
destroyed only `gen7erp-cdn-f1-east-probe` (0 added, 0 changed, 1 destroyed).
Its resource declaration has been removed to prevent accidental recreation.
The dedicated remote backend is retained as an empty historical state. The
production B1 plan belongs to the separate CDN state and was not changed.

On 16 November 2026 the user authorized one empty F1 Linux plan in Canada East
to compare with the failed Canada Central requests. ARM returned HTTP 200 and
Succeeded at 19:25:15 UTC. CLI and AzureRM normalize the plan SKU to F1 / Free;
the initial raw creation response reported U13 / LinuxFree.

- Resource: `Gen7ERP/gen7erp-cdn-f1-east-probe`, Canada East.
- No web apps, deployment, production traffic, or media copy.
- Imported into its own remote state: `diagnostics/f1-east-probe.tfstate`.
- Fresh post-import Terraform plan: **No changes**.
- [Sanitized request/response](../cdn/diagnostics/f1-east-probe-2026-11-16.json).

This establishes successful Free Linux creation in Canada East for this
subscription. It does not prove B1 creation there, explain Canada's Central
denial, or authorize a production region change. Production CDN infrastructure
remains configured for B1 in Canada Central and its partial state is untouched.
The diagnostic plan has now been removed; this root owns no resources.
