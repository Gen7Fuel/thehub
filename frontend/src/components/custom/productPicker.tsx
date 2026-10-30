import { useQuery } from "@tanstack/react-query"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { productsService } from '@/api/products/products.service'

interface Product {
    _id: string,
    code: string,
    description: string,
}
interface ProductPickerProps {
    setProduct: React.Dispatch<React.SetStateAction<string>>,
}
export function ProductPicker({ setProduct }: ProductPickerProps) {
  const { data = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsService.listForStatus<Product[]>()
  })

  return (
    <>
    <Select onValueChange={(value) => setProduct(value)}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select grade" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Fuel Grades</SelectLabel>
          {data?.length > 0 ? (
            data?.map((product: Product) => (
              <SelectItem key={product._id} value={product.code}>
                {product.description}
              </SelectItem>
            ))
          ) : (
            <SelectItem disabled value='null'>No fuel grades available</SelectItem>
          )}
        </SelectGroup>
      </SelectContent>
    </Select>
    </>
  )
}
