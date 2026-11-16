terraform {
  required_version = ">= 1.10, < 2.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}

provider "azurerm" {
  subscription_id                 = "29b24248-1990-4592-b25d-e6ee8e9db784"
  tenant_id                       = "21634e14-74fa-410a-8886-4c3f808b58cb"
  resource_provider_registrations = "none"
  features {}
}

data "azurerm_resource_group" "target" { name = "Gen7ERP" }

data "azurerm_client_config" "current" {}

locals {
  # Canada East hosting authorized after the successful Free Linux comparison.
  hosting_location = "canadaeast"
  tags = { application = "Gen7ERP", component = "cdn", environment = "production", managed_by = "Terraform" }
  # Reference only; no storage-account data source that retrieves account keys.
  media_container_scope = "/subscriptions/29b24248-1990-4592-b25d-e6ee8e9db784/resourceGroups/Gen7ERP/providers/Microsoft.Storage/storageAccounts/gen7erpmedia29b24248/blobServices/default/containers/hub"
}

resource "azurerm_service_plan" "cdn" {
  name                = "gen7erp-cdn-prod"
  resource_group_name = data.azurerm_resource_group.target.name
  location            = local.hosting_location
  os_type             = "Linux"
  sku_name            = "B1"
  worker_count        = 1
  tags                = local.tags
}

resource "azurerm_key_vault" "cdn" {
  name                       = "gen7erp-cdn-29b24248"
  resource_group_name        = data.azurerm_resource_group.target.name
  location                   = data.azurerm_resource_group.target.location
  tenant_id                  = "21634e14-74fa-410a-8886-4c3f808b58cb"
  sku_name                   = "standard"
  rbac_authorization_enabled = true
  purge_protection_enabled   = true
  soft_delete_retention_days = 90
  tags                       = local.tags
  lifecycle { prevent_destroy = true }
}

resource "azurerm_linux_web_app" "cdn" {
  name                                           = "gen7erp-cdn-prod-29b24248"
  resource_group_name                            = data.azurerm_resource_group.target.name
  location                                       = azurerm_service_plan.cdn.location
  service_plan_id                                = azurerm_service_plan.cdn.id
  https_only                                     = true
  ftp_publish_basic_authentication_enabled       = false
  webdeploy_publish_basic_authentication_enabled = false
  client_affinity_enabled                        = false
  tags                                           = local.tags

  identity { type = "SystemAssigned" }

  site_config {
    always_on                         = true
    app_command_line                  = "node index.js"
    minimum_tls_version               = "1.2"
    ftps_state                        = "Disabled"
    health_check_path                 = "/cdn/health"
    health_check_eviction_time_in_min = 10
    worker_count                      = 1
    use_32_bit_worker                 = false
    application_stack { node_version = "24-lts" }
  }

  app_settings = {
    CDN_STORAGE                    = "azure"
    AZURE_CONTAINER                = "hub"
    AZURE_STORAGE_ACCOUNT_URL      = "https://gen7erpmedia29b24248.blob.core.windows.net"
    CDN_UPLOADS_DIR                = "/home/cdn-control"
    CDN_START_PAUSED               = "true"
    CDN_ADMIN_TOKEN                = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault.cdn.vault_uri}secrets/cdn-admin-token/)"
    SCM_DO_BUILD_DURING_DEPLOYMENT = "true"
  }

  logs {
    http_logs {
      file_system {
        retention_in_days = 7
        retention_in_mb   = 35
      }
    }
  }

  lifecycle { prevent_destroy = true }
}

resource "azurerm_role_assignment" "runtime_secrets" {
  scope                = azurerm_key_vault.cdn.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_linux_web_app.cdn.identity[0].principal_id
  principal_type       = "ServicePrincipal"
}

resource "azurerm_role_assignment" "runtime_media" {
  scope                = local.media_container_scope
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_linux_web_app.cdn.identity[0].principal_id
  principal_type       = "ServicePrincipal"
}

# Permit the bootstrap operator to populate the admin token outside Terraform;
# no secret value belongs in configuration, plan files, or Terraform state.
resource "azurerm_role_assignment" "operator_secrets" {
  scope                = azurerm_key_vault.cdn.id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = data.azurerm_client_config.current.object_id
}

resource "azurerm_user_assigned_identity" "github" {
  name                = "gen7erp-cdn-github-prod"
  resource_group_name = data.azurerm_resource_group.target.name
  location            = data.azurerm_resource_group.target.location
  tags                = local.tags
}

resource "azurerm_federated_identity_credential" "github" {
  name                      = "github-cdn-production"
  user_assigned_identity_id = azurerm_user_assigned_identity.github.id
  audience                  = ["api://AzureADTokenExchange"]
  issuer                    = "https://token.actions.githubusercontent.com"
  subject                   = "repo:Gen7Fuel/thehub:environment:cdn-production"
}

# Deploy application code without granting GitHub access to the resource group.
resource "azurerm_role_assignment" "github_deploy" {
  scope                = azurerm_linux_web_app.cdn.id
  role_definition_name = "Website Contributor"
  principal_id         = azurerm_user_assigned_identity.github.principal_id
  principal_type       = "ServicePrincipal"
}

output "app_name" { value = azurerm_linux_web_app.cdn.name }
output "azure_url" { value = "https://${azurerm_linux_web_app.cdn.default_hostname}" }
output "runtime_principal_id" { value = azurerm_linux_web_app.cdn.identity[0].principal_id }
output "github_client_id" { value = azurerm_user_assigned_identity.github.client_id }
output "key_vault_name" { value = azurerm_key_vault.cdn.name }
output "media_access_request" {
  value = { scope = local.media_container_scope, role = "Storage Blob Data Contributor", principal_id = azurerm_linux_web_app.cdn.identity[0].principal_id }
}
