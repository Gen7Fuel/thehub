mock_provider "azurerm" {}

variables {
  upstreams = {
    api       = "https://app.gen7fuel.com"
    auth      = "https://app.gen7fuel.com"
    cdn       = "https://files.example.com"
    signaling = "https://app.gen7fuel.com"
  }
}

run "preview_can_use_existing_app_domain" {
  command = plan
  assert {
    condition     = azurerm_linux_web_app.frontend.site_config[0].websockets_enabled
    error_message = "The Azure frontend must accept upgraded Socket.IO and signaling connections."
  }
  assert {
    condition = (
      azurerm_linux_web_app.frontend.app_settings["WEBSITE_WARMUP_STATUSES"] == "200,404" &&
      azurerm_linux_web_app.frontend.site_config[0].health_check_path == "/frontend-health"
    )
    error_message = "Allow the Azure MSI helper's 404 warmup without changing the application's health endpoint."
  }
}

run "reject_plaintext_token_transport" {
  command = plan
  variables {
    upstreams = {
      api       = "http://31.97.98.111:3000"
      auth      = "https://origin.example.com"
      cdn       = "https://files.example.com"
      signaling = "https://origin.example.com"
    }
  }
  expect_failures = [var.upstreams]
}

run "reject_public_domain_in_production" {
  command = plan
  variables { routing_mode = "production" }
  expect_failures = [azurerm_linux_web_app.frontend]
}

run "reject_public_domain_with_alternate_spelling" {
  command = plan
  variables {
    routing_mode = "production"
    upstreams = {
      api       = "https://APP.GEN7FUEL.COM.:443"
      auth      = "https://origin.example.com"
      cdn       = "https://files.example.com"
      signaling = "https://origin.example.com"
    }
  }
  expect_failures = [azurerm_linux_web_app.frontend]
}

run "reject_azure_self_proxy" {
  command = plan
  variables {
    upstreams = {
      api       = "https://gen7erp-frontend-prod-29b24248-abc.canadaeast-01.azurewebsites.net"
      auth      = "https://origin.example.com"
      cdn       = "https://files.example.com"
      signaling = "https://origin.example.com"
    }
  }
  expect_failures = [azurerm_linux_web_app.frontend]
}

run "production_fixed_origins" {
  command = plan
  variables {
    routing_mode = "production"
    upstreams = {
      api       = "https://vps-origin.example.com"
      auth      = "https://vps-origin.example.com"
      cdn       = "https://files.example.com"
      signaling = "https://vps-origin.example.com"
    }
  }
}
