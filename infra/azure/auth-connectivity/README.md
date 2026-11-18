# Auth database connectivity: reviewed preparation

This root prepares an outbound Azure Relay connection from a future Azure auth
app to the existing VPS MongoDB. Nothing here changes production login routing,
publishes MongoDB, installs an agent, binds the existing CDN app, or creates an
auth App Service. Merging the PR runs no infrastructure apply or VPS deployment.

## Proposed boundary

```text
Future Azure auth app -- authenticated TLS Relay channel -- VPS HCM agent
                                                           |
                                               private Docker MongoDB
```

The App Service platform will direct `hub-mongo.internal:27017` to one Hybrid
Connection. The isolated VPS agent resolves that hostname to the existing
`172.22.0.10` MongoDB container. The database stays unpublished. Microsoft HCM's
management service binds only its own container loopback; no port 5001 is
published, so it does not conflict with the existing VPS CDN port.

[Microsoft documents Linux App Service and Linux HCM support](https://learn.microsoft.com/en-us/azure/app-service/app-service-hybrid-connections).
The agent needs outbound TLS/WebSocket access to Azure Relay over port 443 and
private TCP access to MongoDB. Relay authorization does not add MongoDB database
authentication or database TLS: the current Docker-only database has neither.
This is a controlled bridge to the existing database, not a database migration
or a claim of end-to-end MongoDB TLS.

## Resources and state

The real 2026-11-18 Terraform plan contains **4 create, 0 update, 0 destroy**:

| Resource | Purpose |
| --- | --- |
| `gen7erp-auth-relay-29b24248` | Standard Relay namespace, Canada East |
| `hub-mongodb` | One authenticated TCP endpoint |
| `auth-app-send` | Endpoint-scoped Send policy for the future auth app |
| `vps-agent-listen` | Endpoint-scoped Listen policy for the VPS agent |

AzAPI manages only metadata. It never calls `listKeys`, exposes connection
strings in outputs, grants Manage rights to these endpoint policies, or stores
SAS values in the Terraform state. The independent remote state key is
`auth-connectivity/production.tfstate` in the existing private state account.
Namespace/endpoint destruction is protected. No existing CDN resources are
managed by this root. The public plan summary is in `diagnostics/`; full plans,
provider caches and state remain ignored/private.

The signed-in operator can manage Gen7ERP resources, but a read-only check found
`Microsoft.Relay` **NotRegistered** and no subscription-level registration
permission. A subscription administrator must register that provider once via
Subscription → Resource providers → Microsoft.Relay → Register. No subscription
Owner role needs to be granted to this operator, and no quota increase is
requested. Terraform skips automatic provider registration. Do not apply until
that prerequisite is satisfied and the fresh plan still matches the review.

## Cost and capacity

Azure Retail Prices API, CAD/Canada East, checked 2026-11-18, lists the Hybrid
Connections listener at **CAD 0.0188 per hour**, approximately **CAD 13.72 for
730 hours**, before data charges/taxes. Metered data has tiered pricing; do not
treat the zero-price entry as unlimited transfer. Check the current
[Azure Service Bus/Relay pricing](https://azure.microsoft.com/en-us/pricing/details/service-bus/)
and subscription agreement before activation. This is an estimate, not a bill.

No listener is currently running and no Relay resources have been applied.
This plan adds no compute. A separate auth/frontend hosting plan is being
reviewed independently: the existing CDN B1 plan has exhibited high memory
usage and must not silently receive additional auth/frontend workloads.

## Verified agent artifact and isolation

The image uses Microsoft's HCM Linux x64 **1.3.0** archive, SHA-256
`9a3257be23453443e4f848eef342cced1547cee1c9f4193afff22d2ced80ee9c`.
Docker rejects a vendor download with different bytes. Do not silently replace
the checksum if Microsoft's unversioned download changes; review the new agent.

`agent/compose.yaml` is a separately started stack on `thehub_default`, with no
host network, published ports, Docker socket, root user, capabilities, or SAS
environment variables. Config/home volumes persist agent configuration. It runs
with a read-only root filesystem and a private temporary filesystem. The host
agent is capped at 384 MiB memory, half a CPU and 128 processes, with bounded
local Docker logs. These limits are also applied in the local rehearsal. The
database/container network address must be rechecked immediately before startup.

The local rehearsal proves service/CLI startup as UID 10001, private TCP access
to a fresh MongoDB fixture, management isolation from peers, no published ports,
restart and clean SIGINT stop. **It does not prove authenticated Azure Relay
connectivity, SAS persistence, App Service DNS interception, MongoDB reads through
the Relay, or production latency.** No real credentials/resources are used.

```sh
terraform -chdir=infra/azure/auth-connectivity init -backend=false
terraform -chdir=infra/azure/auth-connectivity validate
terraform -chdir=infra/azure/auth-connectivity test
docker build -t hub-auth-hcm:1.3.0 infra/azure/auth-connectivity/agent
python3 infra/azure/auth-connectivity/rehearse-agent.py
```

The backend-disabled initialization above is for a fresh offline test directory.
For a real plan/apply, initialize the canonical remote backend normally and keep
the resulting plan private. Never use a local/empty state to apply this root.

## Activation and rollback sequence after review

1. Complete provider registration through a subscription administrator, confirm
   the reviewed cost, and create a fresh remote-state plan. Apply only these four
   metadata resources; verify endpoint authentication and separate Send/Listen
   policies. Check namespace uniqueness before apply.
2. Build/pin the reviewed agent image and validate the live MongoDB network/IP.
   Start only the dedicated agent stack under the VPS deployment lock; do not
   recreate MongoDB or change `compose.yaml`, firewall rules, Caddy or DNS.
3. Fetch **only the endpoint Listen policy** for the agent through an authorized
   operator. Transfer its value over SSH into a mode-0600 file in the agent's
   temporary filesystem. HCM 1.3.0 supports
   `hcm add-from-file --path /private/file.json` (a JSON array of connection
   strings); use that file-based command, not a secret command-line argument.
   Capture/redact output and remove the temporary import file afterward. Never
   paste SAS values into chat, Compose, GitHub variables, logs or Terraform.
4. Confirm agent listener status and restart persistence with the real channel.
   These checks must pass before granting a sender to any auth preview.
5. Independently provision a restricted Azure auth preview on its reviewed plan.
   Configure its endpoint Send key through an operator outside Terraform state;
   do not use the namespace root Manage key. Keep the existing MongoDB database
   and JWT signing values. The Relay binding and app settings are a separate
   reviewed change, not an automatic step in this preparation PR.
6. Prove App Service→Relay→MongoDB reads, token acceptance and audit writes using
   controlled identities, then test disconnect/reconnect and measure latency.
   Keep public `/login-auth/*` on the VPS until the preview and rollback pass.

To stop the bridge, stop the dedicated relay agent and remove the auth preview's
binding. Production VPS auth remains on its direct private MongoDB connection.
If a key is exposed, rotate its specific endpoint policy and reconfigure only
the affected sender/listener. Do not delete the existing database, its network,
shared CDN plan, or other services. Terraform destruction remains guarded.
