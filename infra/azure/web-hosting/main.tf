terraform {
  required_version = ">= 1.10, < 2.0"
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 4.0" }
  }
  backend "azurerm" {
    resource_group_name  = "Gen7ERP"
    storage_account_name = "gen7erptf29b24248"
    container_name       = "tfstate"
    key                  = "web-hosting/production.tfstate"
    subscription_id      = "29b24248-1990-4592-b25d-e6ee8e9db784"
    tenant_id            = "21634e14-74fa-410a-8886-4c3f808b58cb"
    use_azuread_auth     = true
    use_cli              = true
  }
}

provider "azurerm" {
  subscription_id                 = "29b24248-1990-4592-b25d-e6ee8e9db784"
  tenant_id                       = "21634e14-74fa-410a-8886-4c3f808b58cb"
  resource_provider_registrations = "none"
  features {}
}

resource "azurerm_service_plan" "web" {
  name                = "gen7erp-web-prod"
  resource_group_name = "Gen7ERP"
  location            = "canadaeast"
  os_type             = "Linux"
  sku_name            = "B1"
  worker_count        = 1
  tags = {
    application = "Gen7ERP", component = "web-hosting"
    environment = "production", managed_by = "Terraform"
  }
  lifecycle { prevent_destroy = true }
}

# Auth and frontend consume this ID; neither app root owns the plan.
output "service_plan_id" { value = azurerm_service_plan.web.id }
output "location" { value = azurerm_service_plan.web.location }
