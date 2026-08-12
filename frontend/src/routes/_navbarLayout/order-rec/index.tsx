import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, FileText, X } from 'lucide-react'
import axios from 'axios'
import { Toaster, toast } from 'sonner'
import { LocationPicker } from '@/components/custom/locationPicker'
import { VendorPicker } from '@/components/custom/vendorPicker'
import { useAuth } from "@/context/AuthContext";
import { useSite } from "@/context/SiteContext";
import {
  isValidOrderRecCSV,
  parseOrderRecCSV,
  type OrderRecParseStats,
} from '@/lib/orderRecParse'
// import { useQuery } from '@tanstack/react-query'

export const Route = createFileRoute('/_navbarLayout/order-rec/')({
  component: RouteComponent,
})


// temporary validation function for PCG order rec CSVs
// function isValidPCGFormat(csvContent: string): boolean {
//   const lines = csvContent.split('\n').map(line => line.trim()).filter(Boolean);
//   const headerLine = lines[0] || '';
//   console.log("PCG CSV Header Line:", headerLine);
//   // Check for the unique Strain column header
//   return headerLine.includes('Strain Name') && headerLine.includes('Category');
// }

// // temporrary parsing function for PCG order rec CSVs - looks for 'Category' column to identify category rows, and uses 'Strain Name' column for item name instead of 'Item Name'
// function parsePCGCSV(csvContent: string): CategoryData[] {
//   // Use PapaParse to handle CSV quotes and commas correctly
//   const results = Papa.parse(csvContent, {
//     header: true,
//     skipEmptyLines: 'greedy',
//     transformHeader: (h) => h.trim() // Clean up any whitespace in headers
//   });

//   const data = results.data as any[];
//   const categoryMap: Record<string, CategoryData> = {};

//   data.forEach(row => {
//     // 1. Extract and clean the GTIN
//     const rawGtin = row['GTIN']?.toString().replace(/\D/g, '') || '';
//     console.log("Processing row with GTIN:", rawGtin);

//     // 2. CRITICAL FIX: Skip the row if GTIN is missing.
//     // This prevents the backend validation error "Path gtin is required"
//     if (!rawGtin) {
//       return; 
//     }
//     // Column 1 (Category ID)
//     // Column 2 is Category Name.
//     const catName = row['Category'] || 'Uncategorized';
//     const catNumber = row['Category ID'] || '0';

//     // We use the Name as the key since IDs are ignored/handled by backend
//     if (!categoryMap[catName]) {
//       categoryMap[catName] = {
//         number: catNumber,
//         name: catName,
//         items: []
//       };
//     }

//     categoryMap[catName].items.push({
//       gtin: rawGtin,
//       vin: row['VIN'] || '',
//       itemName: row['Item Name'] || '',
//       strainName: row['Strain Name'] || '', // New field
//       size: row['Size'] || '',
//       onHandQty: parseInt(row['On Hand']) || 0,
//       forecast: parseInt(row['Forecast']) || 0,
//       minStock: parseInt(row['Min Stock']) || 0,
//       itemsToOrder: parseInt(row['Items to Order']) || 0,
//       unitInCase: parseInt(row['Units in Case']) || 0, // New mapping
//       casesToOrder: parseInt(row['Cases to Order']) || 0
//     });
//   });

//   return Object.values(categoryMap);
// }


// Stable id so the warning replaces itself when a new file is dropped, and can
// be dismissed when the file is removed or the order rec is submitted.
const UNREADABLE_CARTON_TOAST = 'unreadable-carton-codes'

function RouteComponent() {
  const { user } = useAuth()
  const { selectedSite } = useSite()
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [site, setSite] = useState<string>(selectedSite || user?.location || '')
  const [vendor, setVendor] = useState<string>('')
  const [includeStationSupplies, setIncludeStationSupplies] = useState(false);
  const navigate = useNavigate()
  // Inside RouteComponent:
  useEffect(() => {
    setVendor(''); // Clear vendor whenever site changes
  }, [site]);
  // 1. Fetch vendors here so we can "see" the names associated with the IDs
  // const { data: vendors } = useQuery({
  //   queryKey: ['vendors', site],
  //   queryFn: () => fetchVendors(site),
  //   enabled: !!site
  // });

  // 2. Identify if the currently selected ID belongs to "ABC"
  // const isPCGVendor = vendors?.find(v => v._id === vendor)?.name === "Proulx Commercial Growers" && site === "Silver Grizzly";

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file && file.type === 'text/csv') {
      setError(null)
      setIsProcessing(true)

      try {
        const csvContent = await file.text()
        if (!isValidOrderRecCSV(csvContent)) {
          // temporary patch for PCG orders
          // const isValid = isPCGVendor
          //   ? isValidPCGFormat(csvContent)
          //   : isValidOrderRecCSV(csvContent);
          // if (!isValid) {
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

        // Warn here rather than on submit: a mangled carton code cannot be
        // recovered once the order rec exists, because only the parsed rows are
        // sent to the server — the file itself is never stored. Re-exporting the
        // file is only an option while the user is still on this screen.
        toast.dismiss(UNREADABLE_CARTON_TOAST)
        const stats: OrderRecParseStats = { unreadableCartonCodes: 0, samples: [] }
        parseOrderRecCSV(csvContent, stats)
        if (stats.unreadableCartonCodes > 0) {
          const n = stats.unreadableCartonCodes
          toast.warning(
            `${n} carton code${n === 1 ? '' : 's'} could not be read from this file ` +
            `(e.g. "${stats.samples[0]}"). Excel rewrites long numbers in column B as ` +
            `scientific notation, which loses the real digits. ` +
            `${n === 1 ? 'That item' : 'Those items'} will be matched against the planogram ` +
            `by GTIN instead and may show as off planogram. Re-export the file without ` +
            `opening it in Excel to keep the carton codes intact.`,
            { id: UNREADABLE_CARTON_TOAST, duration: Infinity }
          )
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
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    multiple: false
  })

  const handleSubmit = async () => {
    // 1. Check for missing required inputs
    const missingFields: string[] = [];
    if (!site) missingFields.push('Site');
    if (!vendor) missingFields.push('Vendor');
    if (!uploadedFile) missingFields.push('CSV File');

    if (missingFields.length > 0 || !uploadedFile) {
      const alertMessage = `Please select/provide the following required field(s): ${missingFields.join(', ')}`;
      setError(alertMessage);
      toast.error(alertMessage, {
        style: {
          '--normal-bg': 'color-mix(in oklab, var(--destructive) 10%, var(--background))',
          '--normal-text': 'var(--destructive)',
          '--normal-border': 'var(--destructive)'
        } as React.CSSProperties
      });
      return;
    }

    // TypeScript now knows file is strictly of type 'File'
    const fileToUpload = uploadedFile;

    setError(null);
    setIsProcessing(true);

    try {
      const csvContent = await fileToUpload.text();
      const categories = parseOrderRecCSV(csvContent);
      //temporary patch for PCG orders
      // const categories = (isPCGVendor)
      //   ? parsePCGCSV(csvContent)
      //   : parseOrderRecCSV(csvContent);
      const filteredCategories = categories.filter(cat => cat.items.length > 0);

      const response = await axios.post(
        '/api/order-rec',
        {
          categories: filteredCategories,
          site,
          vendor,
          email: user?.email,
          includeStationSupplies
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            "X-Required-Permission": "orderRec.upload"
          }
        }
      );

      // Handle 403 explicitly
      if (response.status === 403) {
        navigate({ to: "/no-access" });
        return;
      }

      toast.success('File uploaded and order recommendation submitted!');
      toast.dismiss(UNREADABLE_CARTON_TOAST);
      setUploadedFile(null);
      setIsProcessing(false);
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        window.location.href = "/no-access";
        return;
      }

      setError('Failed to submit data to backend.');
      setIsProcessing(false);
      console.error(err);
    }

  };

  const handleRemoveFile = () => {
    setUploadedFile(null)
    setIsProcessing(false)
    setError(null)
    // The warning outlives its own toast duration, so it has to go with the file
    // it described — otherwise it reads as applying to whatever is dropped next.
    toast.dismiss(UNREADABLE_CARTON_TOAST)
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
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive
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