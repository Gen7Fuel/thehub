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

# Reference the administrator-created group. Terraform must not own its lifecycle.
data "azurerm_resource_group" "target" {
  name = "Gen7ERP"
}

data "azurerm_client_config" "current" {}

resource "azurerm_storage_account" "state" {
  name                            = "gen7erptf29b24248"
  resource_group_name             = data.azurerm_resource_group.target.name
  location                        = data.azurerm_resource_group.target.location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  shared_access_key_enabled       = false
  default_to_oauth_authentication = true
  allow_nested_items_to_be_public = false

  blob_properties {
    versioning_enabled = true
    delete_retention_policy { days = 30 }
    container_delete_retention_policy { days = 30 }
  }

  tags = { application = "Gen7ERP", component = "terraform-state", environment = "production", managed_by = "Terraform" }
  lifecycle { prevent_destroy = true }
}

# The signed-in bootstrap operator needs blob data access before creating the
# private state container through the Entra-authenticated storage API.
resource "azurerm_role_assignment" "state_operator" {
  scope                = azurerm_storage_account.state.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = data.azurerm_client_config.current.object_id
}

resource "azurerm_storage_container" "state" {
  name                  = "tfstate"
  storage_account_id    = azurerm_storage_account.state.id
  container_access_type = "private"
  depends_on            = [azurerm_role_assignment.state_operator]
  lifecycle { prevent_destroy = true }
}

output "state_storage_account" { value = azurerm_storage_account.state.name }
output "state_container" { value = azurerm_storage_container.state.name }
