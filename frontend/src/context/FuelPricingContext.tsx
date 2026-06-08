import { createContext, useContext } from 'react'

interface FuelPricingContextType {
  selectedCso: string
  recommendedPrices: Record<string, number>
}

const FuelPricingContext = createContext<FuelPricingContextType | null>(null)

export const useFuelPricingContext = () => {
  const context = useContext(FuelPricingContext)

  if (!context) {
    throw new Error(
      'useFuelPricingContext must be used inside FuelPricingContext.Provider'
    )
  }

  return context
}

export default FuelPricingContext