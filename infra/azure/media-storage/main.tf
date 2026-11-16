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
  storage_use_azuread             = true
  features {}
}

# Existing group only. The EDW resource group and media account are not managed.
data "azurerm_resource_group" "target" { name = "Gen7ERP" }
data "azurerm_client_config" "current" {}

resource "azurerm_storage_account" "media" {
  name                            = "gen7erpmedia29b24248"
  resource_group_name             = data.azurerm_resource_group.target.name
  location                        = data.azurerm_resource_group.target.location
  account_kind                    = "StorageV2"
  account_tier                    = "Standard"
  account_replication_type        = "RAGRS"
  access_tier                     = "Hot"
  https_traffic_only_enabled      = true
  min_tls_version                 = "TLS1_2"
  shared_access_key_enabled       = false
  default_to_oauth_authentication = true
  allow_nested_items_to_be_public = false
  is_hns_enabled                  = false
  local_user_enabled              = false
  sftp_enabled                    = false

  blob_properties {
    versioning_enabled = true
    delete_retention_policy { days = 30 }
    container_delete_retention_policy { days = 30 }

    # CORS enables browser playback; private blobs still require authorization.
    cors_rule {
      allowed_origins    = ["https://app.gen7fuel.com", "https://desk.gen7fuel.com"]
      allowed_methods    = ["GET", "HEAD", "OPTIONS"]
      allowed_headers    = ["*"]
      exposed_headers    = ["Content-Length", "Content-Type", "Content-Range", "Accept-Ranges", "ETag", "Last-Modified"]
      max_age_in_seconds = 3600
    }
  }

  tags = { application = "Gen7ERP", component = "media-storage", environment = "production", managed_by = "Terraform" }
  lifecycle { prevent_destroy = true }
}

# Keep current blob names/prefixes. Per-workload application settings must be
# separated before migrating a prefix; never switch the shared env globally.
resource "azurerm_storage_container" "media" {
  name                  = "hub"
  storage_account_id    = azurerm_storage_account.media.id
  container_access_type = "private"
  lifecycle { prevent_destroy = true }
}

# Scoped to the NEW container. This grants no access to the existing EDW account.
resource "azurerm_role_assignment" "media_operator" {
  scope                = azurerm_storage_container.media.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = data.azurerm_client_config.current.object_id
}

output "account_name" { value = azurerm_storage_account.media.name }
output "account_id" { value = azurerm_storage_account.media.id }
output "blob_endpoint" { value = azurerm_storage_account.media.primary_blob_endpoint }
output "container_name" { value = azurerm_storage_container.media.name }
output "container_resource_id" { value = azurerm_storage_container.media.id }
