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

# Existing VPS backend service principal; no new credential is created or stored.
resource "azurerm_role_assignment" "vps_media" {
  scope                = "/subscriptions/29b24248-1990-4592-b25d-e6ee8e9db784/resourceGroups/Gen7ERP/providers/Microsoft.Storage/storageAccounts/gen7erpmedia29b24248/blobServices/default/containers/hub"
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = "07ac1a30-7c14-41f5-9fb1-90bc5bcb92a7"
  principal_type       = "ServicePrincipal"
}
