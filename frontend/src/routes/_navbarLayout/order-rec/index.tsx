import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, FileText, X } from 'lucide-react'
// import { Download } from 'lucide-react'
import Papa from 'papaparse'
import ExcelJS from 'exceljs'
import axios from 'axios'
import { Toaster, toast } from 'sonner'
import { LocationPicker } from '@/components/custom/locationPicker'
import { VendorPicker } from '@/components/custom/vendorPicker'
// import { sendEmail } from "@/lib/utils";

export const Route = createFileRoute('/_navbarLayout/order-rec/')({
  component: RouteComponent,
})

interface CategoryData {
  number: string
  name: string
  items: ItemData[]
}

interface ItemData {
  gtin: string         // Column A
  vin: string          // Column C  
  itemName: string     // Column D
  size: string         // Column E
  onHandQty: number    // Column F
  forecast: number     // Column G
  minStock: number     // Column H
  itemsToOrder: number // Column I
  unitInCase: number   // Column J
  casesToOrder: number // Column M
}

function isValidOrderRecCSV(csvContent: string): boolean {
  const lines = csvContent.split('\n').map(line => line.trim()).filter(Boolean);

  // Check first line
  if (!lines[0]?.startsWith('Generated:')) return false;

  // Check second line for required headers
  const headerLine = lines[1];
  const requiredHeaders = ['GTIN', 'VIN', 'Item Name', 'Size', 'On Hand Qty'];
  for (const header of requiredHeaders) {
    if (!headerLine.includes(header)) return false;
  }

  // Check for at least one category line (number | name)
  const hasCategory = lines.some(line => /^\d+\s*\|\s*.+/.test(line));
  if (!hasCategory) return false;

  // Check for at least one item line (GTIN: 12+ digits)
  const hasItem = lines.some(line => /^\s*\d{12,}/.test(line));
  if (!hasItem) return false;

  return true;
}

async function processCSVFile(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = async (e) => {
      try {
        const csvContent = e.target?.result as string
        const lines = csvContent.split('\n')
        
        // Skip first 2 lines, start from line 3 (index 2)
        const dataLines = lines.slice(2).filter(line => line.trim() !== '')
        
        const categories: CategoryData[] = []
        let currentCategory: CategoryData | null = null
        
        for (const line of dataLines) {
          const trimmedLine = line.trim()
          if (!trimmedLine) continue
          
          // Check if it's a category line (format: number | category_name)
          if (trimmedLine.includes('|')) {
            const parts = trimmedLine.split('|')
            if (parts.length >= 2) {
              const number = parts[0].trim()
              const nameWithCSVData = parts.slice(1).join('|').trim()
              
              // Extract only the category name (everything before the first comma)
              const name = nameWithCSVData.split(',')[0].trim()
              
              currentCategory = {
                number,
                name,
                items: []
              }
              categories.push(currentCategory)
              continue
            }
          } 
          
          // Check if it's an item line (starts with GTIN - 12+ digits)
          const columns = Papa.parse(line, { skipEmptyLines: true }).data[0] as string[]
          // if (columns && columns.length > 0) {
          //   const firstColumn = columns[0]?.trim().replace(/\D/g, '')
            
          //   // Check if first column is a GTIN (12+ digits) - keep as string to preserve leading zeros
          //   if (firstColumn && /^\d{12,}$/.test(firstColumn) && currentCategory) {
          //     const itemData: ItemData = {
          //       gtin: firstColumn,                          // Column A (as string)
          //       vin: columns[2]?.toString() || '',          // Column C (as string)
          //       itemName: columns[3] || '',                 // Column D
          //       size: columns[4] || '',                     // Column E
          //       onHandQty: parseInt(columns[5]) || 0,       // Column F
          //       forecast: parseInt(columns[6]) || 0,        // Column G
          //       minStock: parseInt(columns[7]) || 0,        // Column H
          //       itemsToOrder: parseInt(columns[8]) || 0,    // Column I
          //       unitInCase: parseInt(columns[9]) || 0,      // Column J
          //       casesToOrder: parseInt(columns[12]) || 0    // Column M
          //     }
              
          //     currentCategory.items.push(itemData)
          //   }
          // }
          if (columns && columns.length > 0) {
            const firstColumn = columns[0]?.trim().replace(/\D/g, '');
            if (firstColumn && /^\d{12,}$/.test(firstColumn) && currentCategory) {
              // Check if this is a Cigarette category
              if (/cigarette/i.test(currentCategory.name)) {
                // GTIN from current row
                const gtin = firstColumn;
                // Search for 'CRT' in column D in the following rows
                let crtRow = null;
                for (let searchIdx = dataLines.indexOf(line) + 1; searchIdx < dataLines.length; searchIdx++) {
                  const searchColumns = Papa.parse(dataLines[searchIdx], { skipEmptyLines: true }).data[0] as string[];
                  if (searchColumns && searchColumns[3] && /CRT/i.test(searchColumns[3])) {
                    crtRow = searchColumns;
                    break;
                  }
                }
                if (crtRow) {
                  const itemData: ItemData = {
                    gtin,                                 // GTIN from original row
                    vin: crtRow[2]?.toString() || '',     // VIN from CRT row
                    itemName: crtRow[3] || '',            // Item Name from CRT row
                    size: crtRow[4] || '',                // Size from CRT row
                    onHandQty: parseInt(crtRow[5]) || 0,  // On Hand Qty from CRT row
                    forecast: parseInt(crtRow[6]) || 0,   // Forecast from CRT row
                    minStock: parseInt(crtRow[7]) || 0,   // Min Stock from CRT row
                    itemsToOrder: parseInt(crtRow[8]) || 0, // Items To Order from CRT row
                    unitInCase: parseInt(crtRow[9]) || 0,   // Unit In Case from CRT row
                    casesToOrder: parseInt(crtRow[12]) || 0 // Cases To Order from CRT row
                  };
                  currentCategory.items.push(itemData);
                }
                // If no CRT row found, skip this item
              } else {
                // Non-cigarette logic (as before)
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
        
        // Generate Excel file
        const workbook = new ExcelJS.Workbook()
        const worksheet = workbook.addWorksheet('Order Reconciliation')
        
        let currentRow = 1
        
        // Add column headers once at the top
        const headers = ['GTIN', 'VIN', 'Item Name', 'Size', 'On Hand Qty', 'Forecast', 'Min Stock', 'Items To Order', 'Unit In Case', 'Cases To Order']
        headers.forEach((header, index) => {
          const headerCell = worksheet.getCell(currentRow, index + 1)
          headerCell.value = header
          headerCell.font = { bold: true }
          headerCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE2EFDA' }
          }
        })
        currentRow++
        
        for (const category of categories) {
          // Add category header
          const categoryCell = worksheet.getCell(currentRow, 1)
          categoryCell.value = `${category.number} | ${category.name}`
          categoryCell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
          categoryCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
          }
          
          // Merge cells for category header (A to J)
          worksheet.mergeCells(currentRow, 1, currentRow, 10)
          currentRow++
          
          // Add items (no column headers here anymore)
          for (const item of category.items) {
            const row = worksheet.getRow(currentRow)

            // Set row height to 50% more than default (default is usually around 15, so ~22.5)
            row.height = 22.5

            row.getCell(1).value = item.gtin                    // Column A - keep as string
            row.getCell(2).value = item.vin                     // Column C - keep as string
            row.getCell(3).value = item.itemName                // Column D
            row.getCell(4).value = item.size                    // Column E
            row.getCell(5).value = item.onHandQty               // Column F
            row.getCell(6).value = item.forecast                // Column G
            row.getCell(7).value = item.minStock                // Column H
            row.getCell(8).value = item.itemsToOrder            // Column I
            row.getCell(9).value = item.unitInCase              // Column J
            row.getCell(10).value = item.casesToOrder           // Column M

            // Set vertical alignment to center for all cells in the row
            for (let colIndex = 1; colIndex <= 10; colIndex++) {
              row.getCell(colIndex).alignment = { vertical: 'middle' }
            }

            // Format GTIN and VIN as text to preserve leading zeros
            row.getCell(1).numFmt = '@'
            row.getCell(2).numFmt = '@'
            
            // Format numbers as integers
            row.getCell(5).numFmt = '#,##0'
            row.getCell(6).numFmt = '#,##0'
            row.getCell(7).numFmt = '#,##0'
            row.getCell(8).numFmt = '#,##0'
            row.getCell(9).numFmt = '#,##0'
            row.getCell(10).numFmt = '#,##0'
            
            currentRow++
          }
          
          // Add empty row between categories
          currentRow++
        }
        
        // Auto-fit columns
        worksheet.columns.forEach(column => {
          column.width = 15
        })
        
        // Generate Excel buffer
        const buffer = await workbook.xlsx.writeBuffer()
        const blob = new Blob([buffer], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        })
        
        resolve(blob)
      } catch (error) {
        reject(error)
      }
    }
    
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

function RouteComponent() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [processedFile, setProcessedFile] = useState<Blob | null>(null)
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
        // Validate CSV format before processing
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
          setProcessedFile(null)
          setIsProcessing(false)
          return
        }

        setUploadedFile(file)
        const processedBlob = await processCSVFile(file)
        setProcessedFile(processedBlob)
      } catch (err) {
        setError('Failed to process CSV file. Please check the file format.')
        toast.error('Failed to process CSV file. Please check the file format.', {
          style: {
            '--normal-bg': 'color-mix(in oklab, var(--destructive) 10%, var(--background))',
            '--normal-text': 'var(--destructive)',
            '--normal-border': 'var(--destructive)'
          } as React.CSSProperties
        })
        console.error('Processing error:', err)
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

  // const handleDownload = () => {
  //   if (processedFile) {
  //     const url = URL.createObjectURL(processedFile)
  //     const link = document.createElement('a')
  //     link.href = url
  //     link.download = 'order-reconciliation.xlsx'
  //     document.body.appendChild(link)
  //     link.click()
  //     document.body.removeChild(link)
  //     URL.revokeObjectURL(url)
  //   }
  // }

  const handleSubmit = async () => {
    if (!uploadedFile || !site || !vendor) return;

    setError(null);
    setIsProcessing(true);

    try {
      // Read and parse the CSV file just like in processCSVFile
      const csvContent = await uploadedFile.text();
      const lines = csvContent.split('\n');
      const dataLines = lines.slice(2).filter(line => line.trim() !== '');

      const categories: CategoryData[] = [];
      let currentCategory: CategoryData | null = null;

      for (const line of dataLines) {
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
        
        const firstCell = columns[0]?.trim()
        if (firstCell === 'TOTALS:'){
          break;
        }
        
        if (columns && columns.length > 0) {
          const firstColumn = firstCell.replace(/\D/g, '');
          if (firstColumn && /^\d{12,}$/.test(firstColumn) && currentCategory) {
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

      // Send categories to backend
      const filteredCategories = categories.filter(cat => cat.items.length > 0);

      // add authorization header with bearer token
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
  
      // // --- EMAIL LOGIC STARTS HERE ---
      // const locationRes = await axios.get(`/api/locations?stationName=${encodeURIComponent(site)}`);
      // const locationEmail = locationRes.data?.locations?.[0]?.email;

      // const ccList = [
      //   localStorage.getItem('email'), // logged-in user
      //   "grayson@gen7fuel.com",
      //   "mohammad@gen7fuel.com"
      // ].filter((v): v is string => typeof v === 'string' && v.length > 0);

      // const subject = `Order recommendation uploaded for ${site}`;
      // const html = `
      //   <h2>Order Recommendation Uploaded</h2>
      //   <p><b>Site:</b> ${site}</p>
      //   <p><b>Filename:</b> ${response.data.filename}</p>
      //   <p><b>Uploaded by:</b> ${localStorage.getItem('email')}</p>
      //   <p>View in system for full details.</p>
      // `;

      // if (locationEmail) {
      //   await sendEmail({
      //     to: locationEmail,
      //     cc: ccList,
      //     subject,
      //     content: html,
      //     isHtml: true
      //   });
      // }
      // // --- EMAIL LOGIC ENDS HERE ---

      // Optionally show success message or reset state
      setUploadedFile(null);
      setProcessedFile(null);
      setIsProcessing(false);
    } catch (err) {
      setError('Failed to submit data to backend.');
      setIsProcessing(false);
      console.error(err);
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null)
    setProcessedFile(null)
    setIsProcessing(false)
    setError(null)
  }

  return (
    <div className="pt-16 container mx-auto p-6 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Order Reconciliation</h1>
        <p className="text-muted-foreground mt-2">
          Upload a CSV file to process and download as Excel
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

              {processedFile && !isProcessing && (
                <div className="text-center">
                  {/* <Button onClick={handleDownload} className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Download Excel File
                  </Button> */}
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