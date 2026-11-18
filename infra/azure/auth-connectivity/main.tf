terraform {
  required_version = ">= 1.10, < 2.0"
  required_providers {
    azapi = {
      source  = "Azure/azapi"
      version = "~> 2.0"
    }
  }
}

provider "azapi" {
  subscription_id            = "29b24248-1990-4592-b25d-e6ee8e9db784"
  tenant_id                  = "21634e14-74fa-410a-8886-4c3f808b58cb"
  skip_provider_registration = true
  disable_default_output     = true
}

variable "enable_legacy_relay" {
  description = "Historical rehearsal only. Production design uses direct Azure databases; leave false."
  type        = bool
  default     = false
}

locals {
  group_id       = "/subscriptions/29b24248-1990-4592-b25d-e6ee8e9db784/resourceGroups/Gen7ERP"
  namespace_name = "gen7erp-auth-relay-29b24248"
  endpoint       = "hub-mongo.internal:27017"
  tags = {
    application = "Gen7ERP", component = "auth-connectivity", environment = "production", managed_by = "Terraform"
  }
}

# AzAPI manages metadata only. No listKeys action, key/connection-string output,
# application binding, or provider auto-registration belongs in this state.
resource "azapi_resource" "relay" {
  type      = "Microsoft.Relay/namespaces@2024-01-01"
  name      = local.namespace_name
  parent_id = local.group_id
  location  = "canadaeast"
  tags      = local.tags
  body = {
    sku        = { name = "Standard", tier = "Standard" }
    properties = { publicNetworkAccess = "Enabled" }
  }
  response_export_values = []
  lifecycle {
    prevent_destroy = true
    precondition {
      condition     = var.enable_legacy_relay
      error_message = "Relay activation is retired. Use docs/migration/azure-databases.md; do not apply this historical module."
    }
  }
}

resource "azapi_resource" "mongo" {
  type      = "Microsoft.Relay/namespaces/hybridConnections@2024-01-01"
  name      = "hub-mongodb"
  parent_id = azapi_resource.relay.id
  body = {
    properties = {
      requiresClientAuthorization = true
      userMetadata                = jsonencode([{ key = "endpoint", value = local.endpoint }])
    }
  }
  response_export_values = []
  lifecycle { prevent_destroy = true }
}

resource "azapi_resource" "endpoint_policy" {
  for_each               = { "auth-app-send" = "Send", "vps-agent-listen" = "Listen" }
  type                   = "Microsoft.Relay/namespaces/hybridConnections/authorizationRules@2024-01-01"
  name                   = each.key
  parent_id              = azapi_resource.mongo.id
  body                   = { properties = { rights = [each.value] } }
  response_export_values = []
}

output "namespace_id" { value = azapi_resource.relay.id }
output "hybrid_connection_id" { value = azapi_resource.mongo.id }
output "endpoint" { value = local.endpoint }
