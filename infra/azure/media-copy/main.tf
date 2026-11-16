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

resource "azurerm_user_assigned_identity" "migration" {
  name                = "gen7erp-media-copy"
  resource_group_name = "Gen7ERP"
  location            = "canadacentral"
  tags = { application = "Gen7ERP", component = "media-migration", managed_by = "Terraform" }
}

resource "azurerm_federated_identity_credential" "github" {
  name                      = "github-media-copy"
  user_assigned_identity_id = azurerm_user_assigned_identity.migration.id
  issuer                    = "https://token.actions.githubusercontent.com"
  audience                  = ["api://AzureADTokenExchange"]
  subject                   = "repo:Gen7Fuel/thehub:environment:cdn-production"
}

resource "azurerm_role_assignment" "destination" {
  scope                = "/subscriptions/29b24248-1990-4592-b25d-e6ee8e9db784/resourceGroups/Gen7ERP/providers/Microsoft.Storage/storageAccounts/gen7erpmedia29b24248/blobServices/default/containers/hub"
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_user_assigned_identity.migration.principal_id
  principal_type       = "ServicePrincipal"
}

output "github_client_id" { value = azurerm_user_assigned_identity.migration.client_id }
