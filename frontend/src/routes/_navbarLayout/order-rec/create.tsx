import { createFileRoute } from '@tanstack/react-router'
import { OrderRecCreate } from '@/components/custom/OrderRecCreate'

export const Route = createFileRoute('/_navbarLayout/order-rec/create')({
  component: OrderRecCreate,
})
