import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/_navbarLayout/fuel-pricing/')({
  component: FuelPricingIndexRoute,
})

function FuelPricingIndexRoute() {
  return <Navigate to="/fuel-pricing/pricing" replace />
}
