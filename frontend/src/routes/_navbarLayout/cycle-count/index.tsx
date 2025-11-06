import { useState, useRef, useEffect } from "react";
import { createFileRoute, useNavigate } from '@tanstack/react-router'

export const Route = createFileRoute('/_navbarLayout/cycle-count/')({
  component: RouteComponent,
})

function RouteComponent() {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Redirect to /cycle-count/count on mount
  useEffect(() => {
    navigate({ to: "/cycle-count/count" });
  }, [navigate]);

  // The rest of the component is not needed
  return null;

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    setUploading(true);
    setMessage("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/cycle-count/upload-excel", {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${localStorage.getItem(`token`) || ``}`,
        },
      });
      const data = await res.json();
      if (res.ok) setMessage("✅ " + data.message);
      else setMessage("❌ " + (data.message || "Upload failed"));
    } catch {
      setMessage("❌ Upload failed");
    }
    setUploading(false);
  };

  return (
    <div className="max-w-xl mx-auto mt-12">
      <h2 className="text-2xl font-bold mb-6">Upload Cycle Count Excel File</h2>
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragActive ? `border-blue-500 bg-blue-50` : `border-gray-300`}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{ cursor: "pointer" }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleChange}
        />
        <p className="text-lg mb-2">
          {dragActive ? "Drop your Excel file here..." : "Drag & drop your Excel file here, or click to select"}
        </p>
        <p className="text-gray-500 text-sm">Accepted formats: .xlsx, .xls</p>
      </div>
      {uploading && <div className="mt-4 text-blue-600">Uploading...</div>}
      {message && <div className="mt-4">{message}</div>}
    </div>
  );
}