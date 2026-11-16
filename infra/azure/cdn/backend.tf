terraform {
  backend "azurerm" {
    resource_group_name  = "Gen7ERP"
    storage_account_name = "gen7erptf29b24248"
    container_name       = "tfstate"
    key                  = "cdn/production.tfstate"
    subscription_id      = "29b24248-1990-4592-b25d-e6ee8e9db784"
    tenant_id            = "21634e14-74fa-410a-8886-4c3f808b58cb"
    use_azuread_auth     = true
    use_cli              = true
  }
}
