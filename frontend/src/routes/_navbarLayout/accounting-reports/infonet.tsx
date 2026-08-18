import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import axios from "axios";
import { Toaster, toast } from "sonner";
import { LocationPicker } from "@/components/custom/locationPicker";
import { useAuth } from "@/context/AuthContext";
import { useSite } from "@/context/SiteContext";
import { Info, Upload, FileSpreadsheet, X, Mail } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"; // Make sure to import your Tooltip components

export const Route = createFileRoute(
  "/_navbarLayout/accounting-reports/infonet",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { user } = useAuth();
  const { selectedSite } = useSite();
  const navigate = useNavigate();

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form inputs
  const [site, setSite] = useState<string>(
    selectedSite || user?.location || "",
  );
  const [adminFee, setAdminFee] = useState<string>("");
  const [provinceStatusDiscount, setProvinceStatusDiscount] =
    useState<string>("");

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setError(null);
      setUploadedFile(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
    },
    multiple: false,
  });

  const handleSubmit = async () => {
    // 1. Validation check
    const missingFields: string[] = [];
    if (!site) missingFields.push("Site");
    if (!uploadedFile) missingFields.push("Excel File");

    if (missingFields.length > 0) {
      const alertMessage = `Please provide the required field(s): ${missingFields.join(", ")}`;
      setError(alertMessage);
      toast.error(alertMessage);
      return;
    }

    setError(null);
    setIsProcessing(true);

    try {
      // Build FormData for multipart upload
      const formData = new FormData();
      formData.append("file", uploadedFile as File);
      formData.append("site", site);
      formData.append("adminFee", adminFee);
      formData.append("provinceStatusDiscount", provinceStatusDiscount);

      const response = await axios.post(
        "/api/accounting-reports/infonet-reports",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "X-Required-Permission": "accounting.accountingReports.infonet",
          },
        },
      );

      if (response.status === 403) {
        navigate({ to: "/no-access" });
        return;
      }

      toast.success(
        response.data?.message ||
          "Infonet reports generated and email queued successfully!",
      );
      setUploadedFile(null);
      setAdminFee("");
      setProvinceStatusDiscount("");
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        window.location.href = "/no-access";
        return;
      }

      const errMsg =
        err.response?.data?.error || "Failed to submit report to backend.";
      setError(errMsg);
      toast.error(errMsg);
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setIsProcessing(false);
    setError(null);
  };

  return (
    <div className="pt-10 container mx-auto p-6 max-w-2xl">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Infonet Reports</h1>
        <p className="text-muted-foreground mt-2">
          Upload an Infonet Excel report to generate and email site reports
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Parameters & Upload</CardTitle>
          <CardDescription>
            Select the site, fill in required financial parameters, and attach
            the report file.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Email Notification Banner */}
          <div className="flex items-center gap-2.5 p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg text-amber-900 dark:text-amber-200 text-sm">
            <Mail className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              Generated reports will be emailed directly to{" "}
              <strong className="font-semibold underline decoration-amber-300">
                {user?.email || "your email address"}
              </strong>
              .
            </span>
          </div>

          {/* Input Controls Grid */}
          <TooltipProvider delayDuration={150}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-medium mb-1">Site</label>
                <LocationPicker value="stationName" setStationName={setSite} />
              </div>

              {/* Admin Fee Input with Tooltip */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <label className="block text-sm font-medium">
                    Admin Fee ($)
                  </label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      >
                        <Info className="h-4 w-4" />
                        <span className="sr-only">Admin Fee Info</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="text-xs">
                        Enter the dollar value per unit (e.g., entering{" "}
                        <span className="font-semibold text-amber-400">
                          0.03
                        </span>{" "}
                        means <span className="font-semibold">3 cents</span>).
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  type="number"
                  step="0.005"
                  placeholder="0.00"
                  value={adminFee}
                  onChange={(e) => setAdminFee(e.target.value)}
                />
              </div>

              {/* Province Status Discount Input with Tooltip */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <label className="block text-sm font-medium">
                    Province Status Discount ($)
                  </label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      >
                        <Info className="h-4 w-4" />
                        <span className="sr-only">
                          Province Status Discount Info
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="text-xs">
                        Enter the dollar value per unit (e.g., entering{" "}
                        <span className="font-semibold text-amber-400">
                          0.125
                        </span>{" "}
                        means <span className="font-semibold">12.5 cents</span>
                        ).
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  type="number"
                  step="0.005"
                  placeholder="0.00"
                  value={provinceStatusDiscount}
                  onChange={(e) => setProvinceStatusDiscount(e.target.value)}
                />
              </div>
            </div>
          </TooltipProvider>

          {/* File Upload / Dropzone */}
          {!uploadedFile ? (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-gray-300 hover:border-gray-400 dark:border-zinc-700"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              {isDragActive ? (
                <p className="text-lg">Drop the Excel file here...</p>
              ) : (
                <div>
                  <p className="text-lg mb-2">
                    Drag and drop your Excel file here, or{" "}
                    <span className="text-primary font-medium">
                      click to browse
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Only .xlsx or .xls Excel files are accepted
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-800 rounded-lg">
                <div className="flex items-center space-x-3">
                  <FileSpreadsheet className="h-8 w-8 text-green-600" />
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
                  disabled={isProcessing}
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
                  <p className="text-red-700 dark:text-red-400 text-sm">
                    {error}
                  </p>
                </div>
              )}

              {isProcessing ? (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary mb-2"></div>
                  <p className="text-sm text-muted-foreground">
                    Processing Excel file & generating PDF reports...
                  </p>
                </div>
              ) : (
                <Button onClick={handleSubmit} className="w-full">
                  Process & Submit
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Toaster richColors position="top-center" />
    </div>
  );
}
