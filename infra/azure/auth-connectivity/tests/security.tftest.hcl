mock_provider "azapi" {}

override_resource {
  target = azapi_resource.relay
  values = { id = "/subscriptions/29b24248-1990-4592-b25d-e6ee8e9db784/resourceGroups/Gen7ERP/providers/Microsoft.Relay/namespaces/gen7erp-auth-relay-29b24248" }
}
override_resource {
  target = azapi_resource.mongo
  values = { id = "/subscriptions/29b24248-1990-4592-b25d-e6ee8e9db784/resourceGroups/Gen7ERP/providers/Microsoft.Relay/namespaces/gen7erp-auth-relay-29b24248/hybridConnections/hub-mongodb" }
}

run "relay_activation_blocked_by_default" {
  command         = plan
  expect_failures = [azapi_resource.relay]
}

run "restricted_endpoint_metadata" {
  command = plan
  variables { enable_legacy_relay = true }
  assert {
    condition     = azapi_resource.relay.location == "canadaeast" && azapi_resource.relay.body.sku.name == "Standard"
    error_message = "Keep the relay in the reviewed Canada East Standard configuration."
  }
  assert {
    condition     = azapi_resource.mongo.body.properties.requiresClientAuthorization == true
    error_message = "Unauthenticated relay traffic must remain disabled."
  }
  assert {
    condition     = jsondecode(azapi_resource.mongo.body.properties.userMetadata)[0].value == "hub-mongo.internal:27017"
    error_message = "The relay is restricted to the reviewed MongoDB endpoint."
  }
  assert {
    condition     = azapi_resource.endpoint_policy["auth-app-send"].body.properties.rights == ["Send"] && azapi_resource.endpoint_policy["vps-agent-listen"].body.properties.rights == ["Listen"]
    error_message = "App and agent need separate endpoint-scoped Send/Listen policies, without Manage."
  }
}
