import { useState, useEffect, useRef } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DatePicker } from '@/components/custom/datePicker'
import { LocationPicker } from '@/components/custom/locationPicker'
import { useAuth } from '@/context/AuthContext'
import { useSite } from '@/context/SiteContext'
import { domain } from '@/lib/constants'
import { uploadBase64Image } from '@/lib/utils'
import { format } from 'date-fns'
import axios from 'axios'
import { Camera, X, List } from 'lucide-react'

export const Route = createFileRoute('/_navbarLayout/atm/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { user } = useAuth()
  const { selectedSite } = useSite()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [date, setDate] = useState<Date | undefined>(new Date())
  const [amount, setAmount] = useState<number | ''>('')
  const [source, setSource] = useState<string>('')
  const [stationName, setStationName] = useState<string>('')
  const [image, setImage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const site = selectedSite || user?.location
    if (site) setStationName(site)
  }, [selectedSite, user?.location])

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => setImage(reader.result as string)
    reader.readAsDataURL(file)
  }

  const isFormValid = !!(date && amount !== '' && (amount as number) > 0 && source && stationName && image)

  const handleSubmit = async () => {
    if (!isFormValid) return
    setIsSubmitting(true)
    try {
      const { filename } = await uploadBase64Image(image!, `atm_${Date.now()}.jpg`)

      const token = localStorage.getItem('token')
      await axios.post(
        `${domain}/api/atm`,
        {
          date: format(date!, 'yyyy-MM-dd'),
          amount: Number(amount),
          source,
          image: filename,
          stationName,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Required-Permission': 'accounting.atm',
          },
        }
      )
      navigate({ to: '/atm/list' })
    } catch (err: any) {
      if (err.response?.status === 403) {
        navigate({ to: '/no-access' })
        return
      }
      alert('Failed to submit ATM record.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="p-4 border border-dashed border-gray-300 rounded-md space-y-6">
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          ref={fileInputRef}
          onChange={handleCapture}
        />

        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">ATM Fill</h1>
          <Link to="/atm/list">
            <Button variant="outline" size="sm">
              <List className="mr-1 h-4 w-4" />
              History
            </Button>
          </Link>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold">Date</h2>
          <DatePicker
            date={date}
            setDate={(v) => {
              if (typeof v === 'function') {
                const next = v(date)
                if (next) setDate(next)
              } else {
                setDate(v)
              }
            }}
          />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold">Location</h2>
          <LocationPicker
            setStationName={setStationName as React.Dispatch<React.SetStateAction<string>>}
            value="stationName"
          />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold">Amount Loaded ($)</h2>
          <Input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) =>
              setAmount(e.target.value === '' ? '' : Number(e.target.value))
            }
            min="0"
            step="0.01"
          />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold">Money Taken From</h2>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select source" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Source</SelectLabel>
                <SelectItem value="till">Till</SelectItem>
                <SelectItem value="safe">Safe</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold">Supporting Document</h2>
          {image ? (
            <div className="space-y-2">
              <div className="relative">
                <img
                  src={image}
                  alt="Supporting document"
                  className="w-full rounded-md border border-gray-200 object-cover max-h-52"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2 bg-white h-7 w-7 p-0"
                  onClick={() => {
                    setImage(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="mr-2 h-4 w-4" />
                Retake Photo
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="mr-2 h-4 w-4" />
              Capture Photo
            </Button>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
            className="min-w-[100px]"
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </Button>
        </div>
      </div>
    </div>
  )
}
