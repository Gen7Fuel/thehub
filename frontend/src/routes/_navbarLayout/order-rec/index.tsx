import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, FileText, X } from 'lucide-react'
import Papa from 'papaparse'
import axios from 'axios'
import { Toaster, toast } from 'sonner'
import { LocationPicker } from '@/components/custom/locationPicker'
import { VendorPicker } from '@/components/custom/vendorPicker'

export const Route = createFileRoute('/_navbarLayout/order-rec/')({
  component: RouteComponent,
})

interface CategoryData {
  number: string
  name: string
  items: ItemData[]
}

interface ItemData {
  gtin: string
  vin: string
  itemName: string
  size: string
  onHandQty: number
  forecast: number
  minStock: number
  itemsToOrder: number
  unitInCase: number
  casesToOrder: number
}

function isValidOrderRecCSV(csvContent: string): boolean {
  const lines = csvContent.split('\n').map(line => line.trim()).filter(Boolean);
  if (!lines[0]?.startsWith('Generated:')) return false;
  const headerLine = lines[1];
  const requiredHeaders = ['GTIN', 'VIN', 'Item Name', 'Size', 'On Hand Qty'];
  for (const header of requiredHeaders) {
    if (!headerLine.includes(header)) return false;
  }
  const hasCategory = lines.some(line => /^\d+\s*\|\s*.+/.test(line));
  if (!hasCategory) return false;
  const hasItem = lines.some(line => /^\s*\d{12,}/.test(line));
  if (!hasItem) return false;
  return true;
}

function parseOrderRecCSV(csvContent: string): CategoryData[] {
  const lines = csvContent.split('\n');
  const dataLines = lines.slice(2).filter(line => line.trim() !== '');
  const categories: CategoryData[] = [];
  let currentCategory: CategoryData | null = null;

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Category line (number | name)
    if (trimmedLine.includes('|')) {
      const parts = trimmedLine.split('|');
      if (parts.length >= 2) {
        const number = parts[0].trim();
        const nameWithCSVData = parts.slice(1).join('|').trim();
        const name = nameWithCSVData.split(',')[0].trim();

        currentCategory = {
          number,
          name,
          items: []
        };
        categories.push(currentCategory);
        continue;
      }
    }

    // Item line (starts with GTIN)
    const columns = Papa.parse(line, { skipEmptyLines: true }).data[0] as string[];
    const firstCell = columns[0]?.trim();
    if (firstCell === 'TOTALS:') break;

    if (columns && columns.length > 0) {
      const firstColumn = firstCell.replace(/\D/g, '');
      if (firstColumn && /^\d{12,}$/.test(firstColumn) && currentCategory) {
        if (/cigarette/i.test(currentCategory.name)) {
          // GTIN from original row
          const gtin = firstColumn;
          // Search for 'CRT' in column D in the following rows
          let crtRow = null;
          for (let searchIdx = i; searchIdx < dataLines.length; searchIdx++) {
            const searchColumns = Papa.parse(dataLines[searchIdx], { skipEmptyLines: true }).data[0] as string[];
            if (searchColumns && searchColumns[3] && /CRT/i.test(searchColumns[3])) {
              crtRow = searchColumns;
              break;
            }
          }
          if (crtRow) {
            const itemData: ItemData = {
              gtin,
              vin: crtRow[2]?.toString() || '',
              itemName: crtRow[3] || '',
              size: crtRow[4] || '',
              onHandQty: parseInt(crtRow[5]) || 0,
              forecast: parseInt(crtRow[6]) || 0,
              minStock: parseInt(crtRow[7]) || 0,
              itemsToOrder: parseInt(crtRow[8]) || 0,
              unitInCase: parseInt(crtRow[9]) || 0,
              casesToOrder: parseInt(crtRow[12]) || 0
            };
            currentCategory.items.push(itemData);
          }
        } else {
          const itemData: ItemData = {
            gtin: firstColumn,
            vin: columns[2]?.toString() || '',
            itemName: columns[3] || '',
            size: columns[4] || '',
            onHandQty: parseInt(columns[5]) || 0,
            forecast: parseInt(columns[6]) || 0,
            minStock: parseInt(columns[7]) || 0,
            itemsToOrder: parseInt(columns[8]) || 0,
            unitInCase: parseInt(columns[9]) || 0,
            casesToOrder: parseInt(columns[12]) || 0
          };
          currentCategory.items.push(itemData);
        }
      }
    }
  }
  return categories;
}

function RouteComponent() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [site, setSite] = useState<string>(localStorage.getItem('location') || '')
  const [vendor, setVendor] = useState<string>('')
  const [includeStationSupplies, setIncludeStationSupplies] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file && file.type === 'text/csv') {
      setError(null)
      setIsProcessing(true)

      try {
        const csvContent = await file.text()
        if (!isValidOrderRecCSV(csvContent)) {
          setError('This CSV file does not match the expected OrderRec format.')
          toast.error('This CSV file does not match the expected OrderRec format.', {
            style: {
              '--normal-bg': 'color-mix(in oklab, var(--destructive) 10%, var(--background))',
              '--normal-text': 'var(--destructive)',
              '--normal-border': 'var(--destructive)'
            } as React.CSSProperties
          })
          setUploadedFile(null)
          setIsProcessing(false)
          return
        }
        setUploadedFile(file)
      } catch (err) {
        setError('Failed to process CSV file. Please check the file format.')
        toast.error('Failed to process CSV file. Please check the file format.', {
          style: {
            '--normal-bg': 'color-mix(in oklab, var(--destructive) 10%, var(--background))',
            '--normal-text': 'var(--destructive)',
            '--normal-border': 'var(--destructive)'
          } as React.CSSProperties
        })
        setIsProcessing(false)
      } finally {
        setIsProcessing(false)
      }
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    multiple: false
  })

  const handleSubmit = async () => {
    if (!uploadedFile || !site || !vendor) return;

    setError(null);
    setIsProcessing(true);

    try {
      const csvContent = await uploadedFile.text();
      const categories = parseOrderRecCSV(csvContent);
      const filteredCategories = categories.filter(cat => cat.items.length > 0);

      await axios.post(
        '/api/order-rec',
        {
          categories: filteredCategories,
          site,
          vendor,
          email: localStorage.getItem('email'),
          includeStationSupplies
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      toast.success('File uploaded and order recommendation submitted!');
      setUploadedFile(null);
      setIsProcessing(false);
    } catch (err) {
      setError('Failed to submit data to backend.');
      setIsProcessing(false);
      console.error(err);
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null)
    setIsProcessing(false)
    setError(null)
  }

  return (
    <div className="pt-16 container mx-auto p-6 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Order Reconciliation</h1>
        <p className="text-muted-foreground mt-2">
          Upload a CSV file to process and submit to the backend
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>File Upload</CardTitle>
          <CardDescription>
            Drag and drop your CSV file here, or click to select a file
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Site</label>
              <LocationPicker value='stationName' setStationName={setSite} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Vendor</label>
              <VendorPicker value={vendor} setVendor={setVendor} location={site} />
            </div>
            <div className="mb-4 flex items-center gap-2">
              <input
                type="checkbox"
                id="include-station-supplies"
                checked={includeStationSupplies}
                onChange={e => setIncludeStationSupplies(e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="include-station-supplies" className="text-sm">
                Include station supplies
              </label>
            </div>
          </div>

          {!uploadedFile ? (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              {isDragActive ? (
                <p className="text-lg">Drop the CSV file here...</p>
              ) : (
                <div>
                  <p className="text-lg mb-2">
                    Drag and drop your CSV file here, or{' '}
                    <span className="text-primary font-medium">click to browse</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Only CSV files are accepted
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <FileText className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="font-medium">{uploadedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(uploadedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveFile}
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              {isProcessing && (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary mb-2"></div>
                  <p className="text-sm text-muted-foreground">Processing file...</p>
                </div>
              )}

              {!isProcessing && (
                <div className="text-center">
                  <Button
                    onClick={handleSubmit}
                    className="w-full"
                  >
                    Submit
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Toaster
        richColors
        position="top-center"
        toastOptions={{
          className: "bg-red-50 text-red-700 border border-red-200",
        }}
      />
    </div>
  )
}