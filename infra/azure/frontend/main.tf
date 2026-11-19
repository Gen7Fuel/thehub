terraform {
  required_version = ">= 1.10, < 2.0"
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 4.0" }
  }
  backend "azurerm" {
    resource_group_name  = "Gen7ERP"
    storage_account_name = "gen7erptf29b24248"
    container_name       = "tfstate"
    key                  = "frontend/production.tfstate"
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

variable "routing_mode" {
  type    = string
  default = "preview"
  validation {
    condition     = contains(["preview", "production"], var.routing_mode)
    error_message = "routing_mode must be preview or production."
  }
}

variable "upstreams" {
  description = "Origins only; preview may use the current public app, production needs a fixed VPS origin."
  type        = object({ api = string, auth = string, cdn = string, signaling = string })
  validation {
    condition = alltrue([for origin in values(var.upstreams) :
    can(regex("^https://[a-zA-Z0-9][a-zA-Z0-9.-]*(:[0-9]+)?$", origin))])
    error_message = "All upstreams must be HTTPS hostname origins with no path, query or credentials."
  }
}

locals {
  group    = "Gen7ERP"
  location = "canadaeast"
  app_name = "gen7erp-frontend-prod-29b24248"
  plan_id  = "/subscriptions/29b24248-1990-4592-b25d-e6ee8e9db784/resourceGroups/Gen7ERP/providers/Microsoft.Web/serverFarms/gen7erp-web-prod"
  tags     = { application = "Gen7ERP", component = "frontend", environment = "production", managed_by = "Terraform" }
  upstream_hosts = [for origin in values(var.upstreams) :
  lower(trimsuffix(try(regex("^https://([^:/]+)", origin)[0], ""), "."))]
}

resource "azurerm_container_registry" "frontend" {
  name                 = "gen7erpfrontend29b24248"
  resource_group_name  = local.group
  location             = local.location
  sku                  = "Basic"
  admin_enabled        = false
  role_assignment_mode = "LegacyRegistryPermissions"
  tags                 = local.tags
  lifecycle { prevent_destroy = true }
}

resource "azurerm_user_assigned_identity" "runtime" {
  name                = "gen7erp-frontend-runtime"
  resource_group_name = local.group
  location            = local.location
  tags                = local.tags
}

resource "azurerm_role_assignment" "runtime_pull" {
  scope                = azurerm_container_registry.frontend.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.runtime.principal_id
  principal_type       = "ServicePrincipal"
}

resource "azurerm_linux_web_app" "frontend" {
  name                                           = local.app_name
  resource_group_name                            = local.group
  location                                       = local.location
  service_plan_id                                = local.plan_id
  https_only                                     = true
  ftp_publish_basic_authentication_enabled       = false
  webdeploy_publish_basic_authentication_enabled = false
  client_affinity_enabled                        = false
  tags                                           = local.tags
  depends_on                                     = [azurerm_role_assignment.runtime_pull]

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.runtime.id]
  }
  site_config {
    websockets_enabled                            = true
    use_32_bit_worker                             = false
    always_on                                     = true
    minimum_tls_version                           = "1.2"
    scm_minimum_tls_version                       = "1.2"
    ftps_state                                    = "Disabled"
    health_check_path                             = "/frontend-health"
    health_check_eviction_time_in_min             = 10
    container_registry_use_managed_identity       = true
    container_registry_managed_identity_client_id = azurerm_user_assigned_identity.runtime.client_id
    application_stack {
      # Empty-host bootstrap: no image is pushed/applied by Terraform. The
      # preview workflow replaces this with a verified immutable image digest.
      docker_image_name   = "hub-frontend:bootstrap"
      docker_registry_url = "https://${azurerm_container_registry.frontend.login_server}"
    }
  }
  app_settings = {
    WEBSITES_PORT                       = "8080"
    WEBSITES_ENABLE_APP_SERVICE_STORAGE = "false"
    WEBSITE_WARMUP_PATH                 = "/frontend-health"
    # Classic App Service also probes its managed-identity helper, which
    # returns 404 for this application-specific path. Keep app health at 200.
    WEBSITE_WARMUP_STATUSES   = "200,404"
    HUB_API_UPSTREAM          = var.upstreams.api
    HUB_AUTH_UPSTREAM         = var.upstreams.auth
    HUB_CDN_UPSTREAM          = var.upstreams.cdn
    HUB_SIGNALING_UPSTREAM    = var.upstreams.signaling
    HUB_FRONTEND_ROUTING_MODE = var.routing_mode
  }
  logs {
    application_logs { file_system_level = "Information" }
    http_logs {
      file_system {
        retention_in_days = 7
        retention_in_mb   = 35
      }
    }
  }
  lifecycle {
    prevent_destroy = true
    ignore_changes  = [site_config[0].application_stack[0].docker_image_name]
    precondition {
      condition = alltrue([for host in local.upstream_hosts :
      !can(regex("^${local.app_name}[.-]", host))])
      error_message = "An upstream cannot be the frontend's own Azure hostname."
    }
    precondition {
      condition     = var.routing_mode == "preview" || !contains(local.upstream_hosts, "app.gen7fuel.com")
      error_message = "Production routing cannot proxy to the public app domain: moving its DNS would loop."
    }
  }
}

resource "azurerm_user_assigned_identity" "github" {
  name                = "gen7erp-frontend-github-prod"
  resource_group_name = local.group
  location            = local.location
  tags                = local.tags
}

resource "azurerm_federated_identity_credential" "github" {
  name                      = "github-frontend-production"
  user_assigned_identity_id = azurerm_user_assigned_identity.github.id
  audience                  = ["api://AzureADTokenExchange"]
  issuer                    = "https://token.actions.githubusercontent.com"
  subject                   = "repo:Gen7Fuel/thehub:environment:frontend-production"
}

resource "azurerm_role_assignment" "github_push" {
  scope                = azurerm_container_registry.frontend.id
  role_definition_name = "AcrPush"
  principal_id         = azurerm_user_assigned_identity.github.principal_id
  principal_type       = "ServicePrincipal"
}

resource "azurerm_role_assignment" "github_deploy" {
  scope                = azurerm_linux_web_app.frontend.id
  role_definition_name = "Website Contributor"
  principal_id         = azurerm_user_assigned_identity.github.principal_id
  principal_type       = "ServicePrincipal"
}

output "app_name" { value = azurerm_linux_web_app.frontend.name }
output "azure_url" { value = "https://${azurerm_linux_web_app.frontend.default_hostname}" }
output "github_client_id" { value = azurerm_user_assigned_identity.github.client_id }
output "registry_name" { value = azurerm_container_registry.frontend.name }
