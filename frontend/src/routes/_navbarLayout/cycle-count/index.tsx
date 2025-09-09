import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, FileText, X, Download, Save } from 'lucide-react'
import ExcelJS from 'exceljs'
import { Toaster, toast } from 'sonner'
import JSZip from 'jszip'

export const Route = createFileRoute('/_navbarLayout/cycle-count/')({
  component: RouteComponent,
})

// const submitCycleCountData = async (processedData: any[]) => {
//   try {
//     const token = localStorage.getItem('token');
    
//     const response = await fetch('/api/cycle-counts/from-processed-data', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'Authorization': `Bearer ${token}`
//       },
//       body: JSON.stringify({ 
//         processedData: processedData
//       })
//     });

//     if (!response.ok) {
//       const contentType = response.headers.get('content-type');
//       let errorMessage;
      
//       if (contentType && contentType.includes('application/json')) {
//         const errorData = await response.json();
//         errorMessage = errorData.message || `HTTP ${response.status}: ${response.statusText}`;
//       } else {
//         // If it's not JSON (likely HTML error page), get the text
//         const errorText = await response.text();
//         console.error('Non-JSON response:', errorText);
//         errorMessage = `Server error (${response.status}). Check if backend is running on port 5000.`;
//       }
      
//       throw new Error(errorMessage);
//     }

//     const result = await response.json();
//     return result;
//   } catch (error) {
//     console.error('Full error details:', error);
//     throw error;
//   }
// };

const saveItemsToDatabase = async (processedData: any[]) => {
  try {
    const token = localStorage.getItem('token');
    
    const response = await fetch('/api/cycle-counts/items/bulk-create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        items: processedData
      })
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      let errorMessage;
      
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        errorMessage = errorData.message || `HTTP ${response.status}: ${response.statusText}`;
      } else {
        const errorText = await response.text();
        console.error('Non-JSON response:', errorText);
        errorMessage = `Server error (${response.status}). Check if backend is running on port 5000.`;
      }
      
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('✅ Items saved successfully:', result);
    return result;

  } catch (error) {
    console.error('❌ Error saving items:', error);
    throw error;
  }
};

function RouteComponent() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [processedData, setProcessedData] = useState<any[]>([])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file && (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.name.endsWith('.xlsx'))) {
      setError(null)
      setIsProcessing(true)
      setUploadedFile(file)
      setIsProcessing(false)
    } else {
      setError('Only Excel (.xlsx) files are accepted.')
      setUploadedFile(null)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    multiple: false
  })

  const handleProcess = async () => {
    if (!uploadedFile) return;

    setError(null);
    setIsProcessing(true);

    try {
      // Use ExcelJS to read the file
      const buffer = await uploadedFile.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const sheet = workbook.getWorksheet('Data');
      if (!sheet) {
        setError("Sheet named 'Data' not found in the Excel file.");
        setIsProcessing(false);
        return;
      }

      // Parse rows
      const rows: (ExcelJS.CellValue[] | { [key: string]: ExcelJS.CellValue })[] = [];
      sheet.eachRow({ includeEmpty: false }, (row, _rowNumber) => {
        rows.push(row.values);
      });
      const dataRows = rows.slice(2); // ExcelJS rows are 1-indexed, and first row is header

      // Parse items
      const items = dataRows.map(row => {
        const values = row as ExcelJS.CellValue[];
        return {
          site: values[1] !== undefined && values[1] !== null ? String(values[1]) : '',
          itemCode: values[2] !== undefined && values[2] !== null ? String(values[2]) : '',
          itemName: values[3] !== undefined && values[3] !== null ? String(values[3]) : '',
          category:
            typeof values[6] === 'object' && values[6] !== null
              ? (
                  // Try common ExcelJS object structures
                  (values[6] as any).richText
                    ? (values[6] as any).richText.map((rt: any) => rt.text).join('')
                    : (values[6] as any).result ?? (values[6] as any).formula ?? ''
                )
              : (values[6] !== undefined && values[6] !== null ? String(values[6]) : ''),
          sales: values[12] !== undefined && values[12] !== null ? Number(values[12]) : 0,
        };
      }).filter(item => item.category && item.itemName);

      // Group by site, then by category
      const siteCategoryMap: Record<string, Record<string, any[]>> = {};
      items.forEach(item => {
        if (!siteCategoryMap[item.site]) siteCategoryMap[item.site] = {};
        if (!siteCategoryMap[item.site][item.category]) siteCategoryMap[item.site][item.category] = [];
        siteCategoryMap[item.site][item.category].push(item);
      });

      // Prepare processed data with cumulative sales, percentage, and grade
      let processed: any[] = [];
      Object.entries(siteCategoryMap).forEach(([siteName, categories]) => {
        Object.entries(categories).forEach(([catName, catItems]) => {
          // Sort by sales descending
          catItems.sort((a, b) => b.sales - a.sales);
          const totalSales = catItems.reduce((sum, item) => sum + item.sales, 0);
          let cumulativeSales = 0;

          catItems.forEach(item => {
            cumulativeSales += item.sales;
            const cumulativeSalesPercentage = totalSales > 0 ? (cumulativeSales / totalSales) * 100 : 0;
            let grade = 'A';
            if (cumulativeSalesPercentage < 70) grade = 'A';
            else if (cumulativeSalesPercentage < 90) grade = 'B';
            else grade = 'C';

            // processed.push({
            //   Site: siteName,
            //   Category: catName,
            //   ItemName: item.itemName,
            //   ItemCode: item.itemCode,
            //   Sales: item.sales,
            //   'Cumulative Sales': cumulativeSales,
            //   'Cumulative Sales Percentage': cumulativeSalesPercentage.toFixed(2),
            //   Grade: grade,
            // });
            processed.push({
              site: siteName,
              category: catName,
              name: item.itemName,
              upc: item.itemCode,
              sales: item.sales,
              cumulativeSales: cumulativeSales,
              cumulativeSalesPercentage: cumulativeSalesPercentage.toFixed(2),
              grade: grade,
            });
          });
        });
      });

      // Sort processed output by Site, then Category, then Sales descending
      processed.sort((a, b) => {
        if (a.Site !== b.Site) return a.Site.localeCompare(b.Site);
        if (a.Category !== b.Category) return a.Category.localeCompare(b.Category);
        return b.Sales - a.Sales;
      });

      // Console log the calculated data with grades
      console.log('🎯 CALCULATED DATA WITH GRADES:', processed);
      console.log('📊 SUMMARY:');
      console.log(`Total items processed: ${processed.length}`);
      
      // Group by site for summary
      const siteSummary = processed.reduce((acc, item) => {
        if (!acc[item.Site]) {
          acc[item.Site] = { total: 0, A: 0, B: 0, C: 0 };
        }
        acc[item.Site].total++;
        acc[item.Site][item.Grade]++;
        return acc;
      }, {} as Record<string, { total: number; A: number; B: number; C: number }>);
      
      Object.entries(siteSummary).forEach(([site, counts]) => {
        const typedCounts = counts as { total: number; A: number; B: number; C: number };
        console.log(`📍 ${site}: ${typedCounts.total} items (A: ${typedCounts.A}, B: ${typedCounts.B}, C: ${typedCounts.C})`);
      });
      // End of console log ????

      setProcessedData(processed);
      toast.success('File processed! You can now download the graded data.');
    } catch (err) {
      setError('Failed to process Excel file. Please check the file format.');
      toast.error('Failed to process Excel file. Please check the file format.');
      console.error('Processing error:', err);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleDownload = async () => {
    if (!processedData.length) return;

    // Group by site
    const siteMap: Record<string, any[]> = {};
    processedData.forEach(item => {
      if (!siteMap[item.Site]) siteMap[item.Site] = [];
      siteMap[item.Site].push(item);
    });

    const zip = new JSZip();

    await Promise.all(
      Object.entries(siteMap).map(async ([siteName, items]) => {
        // Order by grade, then category (preserving order)
        const grades = ['A', 'B', 'C'];
        let ordered: any[] = [];
        grades.forEach(grade => {
          const gradeItems = items.filter(i => i.Grade === grade);
          const categoryMap: Record<string, any[]> = {};
          gradeItems.forEach(item => {
            if (!categoryMap[item.Category]) categoryMap[item.Category] = [];
            categoryMap[item.Category].push(item);
          });
          Object.values(categoryMap).forEach(categoryItems => {
            ordered.push(...categoryItems);
          });
        });

        // Split into weeks and days (30 items per day, 5 days per week)
        const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        const ITEMS_PER_DAY = 30;
        const DAYS_PER_WEEK = 5;
        const ITEMS_PER_WEEK = ITEMS_PER_DAY * DAYS_PER_WEEK;

        const totalWeeks = Math.ceil(ordered.length / ITEMS_PER_WEEK);

        // For each week, create a separate file
        for (let week = 0; week < totalWeeks; week++) {
          const workbook = new ExcelJS.Workbook();
          const sheet = workbook.addWorksheet(`Week ${week + 1}`);

          // Set column widths
          sheet.columns = [
            { header: '', key: 'day', width: 40 },
            { header: '', key: 'upc', width: 16 },
            { header: '', key: 'category', width: 12 },
            { header: '', key: 'grade', width: 12 },
            { header: '', key: 'foh', width: 12 },
            { header: '', key: 'boh', width: 12 },
            { header: '', key: 'totalCount', width: 16 }
          ];

          let rowIdx = 1;
          for (let day = 0; day < DAYS_PER_WEEK; day++) {
            const startIdx = week * ITEMS_PER_WEEK + day * ITEMS_PER_DAY;
            const endIdx = startIdx + ITEMS_PER_DAY;
            const block = ordered.slice(startIdx, endIdx);

            // Day name row
            sheet.getCell(`A${rowIdx}`).value = DAYS[day];
            sheet.getCell(`A${rowIdx}`).font = { bold: true };
            rowIdx++;

            // Header row
            sheet.getRow(rowIdx).values = ['Item Name', 'UPC', 'Category', 'Grade', 'FOH', 'BOH', 'Total Count'];
            sheet.getRow(rowIdx).font = { bold: true };
            // Add borders to header row
            for (let col = 1; col <= 7; col++) {
              sheet.getCell(rowIdx, col).border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
              };
            }
            rowIdx++;

            // Data rows
            block.forEach(item => {
              sheet.getRow(rowIdx).values = [
                item.ItemName,
                item.ItemCode,
                item.Category,
                item.Grade,
                '', // Empty FOH column
                '', // Empty BOH column
                '' // Empty Total Count column
              ];
              // Add borders to data row
              for (let col = 1; col <= 7; col++) {
                sheet.getCell(rowIdx, col).border = {
                  top: { style: 'thin' },
                  left: { style: 'thin' },
                  bottom: { style: 'thin' },
                  right: { style: 'thin' }
                };
              }
              rowIdx++;
            });

            // Empty row between blocks
            rowIdx++;
          }

          // Generate file buffer for this week
          const fileData = await workbook.xlsx.writeBuffer();
          // Add to zip under site directory
          (zip.folder(siteName) ?? zip).file(`${siteName} - Week ${week + 1} - Cycle Count Schedule.xlsx`, fileData);
        }
      })
    );

    // Generate zip and trigger download
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'CycleCountSchedules.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async () => {
    if (!processedData.length) return;

    console.log('💾 SAVING ITEMS TO DATABASE:');
    console.log('📦 Processed data being sent:', processedData);
    console.log(`🔢 Total items to save: ${processedData.length}`);

    setIsSubmitting(true);
    try {
      const result = await saveItemsToDatabase(processedData);
      toast.success(`Successfully saved ${result.saved} items to database!`);
      if (result.errors > 0) {
        toast.warning(`${result.errors} items had errors. Check console for details.`);
      }
    } catch (error) {
      toast.error('Failed to save items to database.');
      console.error('Save error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null)
    setIsProcessing(false)
    setError(null)
    setProcessedData([])
  }

  return (
    <div className="pt-16 container mx-auto p-6 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Cycle Count Upload</h1>
        <p className="text-muted-foreground mt-2">
          Upload an Excel (.xlsx) file to process and grade cycle count data. Download the graded results as a new Excel file.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>File Upload</CardTitle>
          <CardDescription>
            Drag and drop your Excel file here, or click to select a file
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                <p className="text-lg">Drop the Excel file here...</p>
              ) : (
                <div>
                  <p className="text-lg mb-2">
                    Drag and drop your Excel file here, or{' '}
                    <span className="text-primary font-medium">click to browse</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Only Excel (.xlsx) files are accepted
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
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={handleProcess}
                    className="w-full"
                  >
                    Calculate Grades
                  </Button>
                  <Button
                    onClick={handleDownload}
                    className="w-full flex items-center gap-2"
                    disabled={!processedData.length}
                  >
                    <Download className="h-4 w-4" />
                    Download Graded Excel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    className="flex-1 flex items-center gap-2"
                    disabled={!processedData.length || isSubmitting}
                  >
                    <Save className="h-4 w-4" />
                    {isSubmitting ? 'Saving...' : 'Save to Database'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {processedData.length > 0 && (
        <pre className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Processed Data</h2>
          <code className="text-sm text-gray-700">
            {JSON.stringify(processedData.slice(0, 5), null, 2)}
          </code>
        </pre>
      )}

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