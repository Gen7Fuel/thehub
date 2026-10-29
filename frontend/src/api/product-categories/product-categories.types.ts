export interface ProductCategory {
  _id?: string
  Number: number
  Name: string
  CycleCountVariance: number
  OrderRecVariance: number
}

export type ProductCategoryInput = Omit<ProductCategory, '_id'>

export interface CycleCountVarianceResponse {
  varianceMap: Record<number, number>
}
