// import { useState } from "react";
// import { CheckSquare, AlertCircle, Image as ImageIcon } from "lucide-react";
// import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
// import { Button } from "@/components/ui/button";

// interface OpenIssueCardProps {
//   issue: {
//     item: string;
//     assignedTo?: string;
//     checked?: boolean; // always shows checked
//     issueRaised?: boolean;
//     currentIssueStatus?: string;
//     lastUpdated?: string;
//     comment?: string;
//     photos?: string[];
//   };
//   borderColor?: string; // optional
// }

// export function OpenIssueCard({ issue, borderColor }: OpenIssueCardProps) {
//   const [viewImagesOpen, setViewImagesOpen] = useState(false);
//   const [imageModalOpen, setImageModalOpen] = useState(false);
//   const [modalImage, setModalImage] = useState<string | null>(null);

//   // turn filenames into preview URLs
//   const photoPreviews = (issue.photos || []).map(name => `/cdn/download/${name}`);

//   const handleThumbnailClick = (src: string) => {
//     setModalImage(src);
//     setImageModalOpen(true);
//   };

//   // status -> card color mapping
//   const getCardColor = (status?: string) => {
//     switch (status?.toLowerCase()) {
//       case "created":
//         return "bg-red-200 hover:bg-red-300";
//       case "in progress":
//         return "bg-blue-200 hover:bg-blue-300";
//       case "resolved":
//         return "bg-green-200 hover:bg-green-300";
//       default:
//         return "bg-gray-100 hover:bg-gray-200";
//     }
//   };

//   return (
//     <div
//       className={`border-2 rounded-2xl p-4 mb-3 flex flex-col gap-2 w-130
//         ${getCardColor(issue.currentIssueStatus)}
//         ${borderColor || "border-gray-300"} border-t-5 transition-colors`}
//     >
//       {/* Header row */}
//       <div className="flex items-center justify-between">
//         <span className="font-medium text-lg">{issue.item}</span>
//         <div className="flex items-center gap-2">
//           {photoPreviews.length > 0 && (
//             <Button
//               variant="outline"
//               size="sm"
//               onClick={() => setViewImagesOpen(true)}
//               className="bg-sky-100 border-gray-300 w-fit"
//             >
//               <ImageIcon size={16} className="text-gray-600" />
//             </Button>
//           )}
//           <CheckSquare size={24} className="text-green-600" />
//         </div>
//       </div>

//       {/* Current status text */}
//       {issue.currentIssueStatus && (
//         <div className="text-sm font-medium">
//           Status: {issue.currentIssueStatus}
//         </div>
//       )}

//       {/* Last updated */}
//       {issue.lastUpdated && (
//         <div className="text-sm text-gray-600">
//           Last Updated At: {new Date(issue.lastUpdated).toLocaleString()}
//         </div>
//       )}

//       {/* Assigned to */}
//       {issue.assignedTo && (
//         <div className="text-sm text-gray-700">Assigned To: {issue.assignedTo}</div>
//       )}

//       {/* Issue raised */}
//       {issue.issueRaised && (
//         <div className="flex items-center mt-2 gap-2">
//           <AlertCircle className="text-red-600" />
//           <span className="text-red-600">Issue Raised</span>
//         </div>
//       )}

//       {/* Comment */}
//       {issue.comment && (
//         <div className="mt-2 p-2 rounded bg-amber-200">
//           <div className="text-sm text-gray-800">
//             <strong>Comment:</strong> {issue.comment}
//           </div>
//         </div>
//       )}

//       {/* Images dialog */}
//       <Dialog open={viewImagesOpen} onOpenChange={setViewImagesOpen}>
//         <DialogContent className="max-w-3xl">
//           <DialogHeader>
//             <DialogTitle>Attached Images</DialogTitle>
//           </DialogHeader>
//           <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
//             {photoPreviews.map((src, idx) => (
//               <img
//                 key={idx}
//                 src={src}
//                 alt={`issue-photo-${idx}`}
//                 className="w-full h-40 object-cover rounded border cursor-pointer"
//                 onClick={() => handleThumbnailClick(src)}
//               />
//             ))}
//           </div>
//         </DialogContent>
//       </Dialog>

//       {/* Fullscreen image modal */}
//       <Dialog open={imageModalOpen} onOpenChange={setImageModalOpen}>
//         <DialogContent className="w-[80vh] h-[80vh] max-w-none flex items-center justify-center p-2">
//           {modalImage && (
//             <img
//               src={modalImage}
//               alt="Full"
//               className="w-full h-full object-contain rounded"
//             />
//           )}
//         </DialogContent>
//       </Dialog>
//     </div>
//   );
// }

import { useState } from "react";
import { CheckSquare, AlertCircle, Image as ImageIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface OpenIssueCardProps {
  issue: {
    _id: string;
    item: string;
    assignedTo?: string;
    checked?: boolean;
    issueRaised?: boolean;
    currentIssueStatus?: string;
    lastUpdated?: string;
    comment?: string;
    photos?: string[];
  };
  borderColor?: string;
  mode?: "station" | "interface";
  onStatusUpdated?: (id: string, newStatus: string) => void;
}

export function OpenIssueCard({ issue, borderColor, mode = "station", onStatusUpdated }: OpenIssueCardProps) {
  const [viewImagesOpen, setViewImagesOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);

  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(issue.currentIssueStatus || "Created");

  const photoPreviews = (issue.photos || []).map(name => `/cdn/download/${name}`);

  const handleThumbnailClick = (src: string) => {
    setModalImage(src);
    setImageModalOpen(true);
  };

  const getCardColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "created":
        return "bg-red-200 hover:bg-red-300";
      case "in progress":
        return "bg-blue-200 hover:bg-blue-300";
      case "resolved":
        return "bg-green-200 hover:bg-green-300";
      default:
        return "bg-gray-100 hover:bg-gray-200";
    }
  };

  const handleSaveStatus = async () => {
    try {
      await fetch(`/api/issues/${issue._id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: selectedStatus }),
      });

      if (onStatusUpdated) {
        onStatusUpdated(issue._id, selectedStatus);
      }
      setUpdateDialogOpen(false);
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  return (
    <div
      className={`border-2 rounded-2xl p-4 mb-3 flex flex-col gap-2 w-130
        ${getCardColor(issue.currentIssueStatus)}
        ${borderColor || "border-gray-300"} border-t-5 transition-colors`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="font-medium text-lg">{issue.item}</span>
        <div className="flex items-center gap-2">
          {photoPreviews.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewImagesOpen(true)}
              className="bg-sky-100 border-gray-300 w-fit"
            >
              <ImageIcon size={16} className="text-gray-600" />
            </Button>
          )}
          <CheckSquare size={24} className="text-green-600" />
        </div>
      </div>

      {/* Current status */}
      {issue.currentIssueStatus && (
        <div className="text-sm font-medium">
          Status: {issue.currentIssueStatus}
        </div>
      )}

      {/* Last updated */}
      {issue.lastUpdated && (
        <div className="text-sm text-gray-600">
          Last Updated At: {new Date(issue.lastUpdated).toLocaleString()}
        </div>
      )}

      {/* Assigned to */}
      {issue.assignedTo && (
        <div className="text-sm text-gray-700">Assigned To: {issue.assignedTo}</div>
      )}

      {/* Issue raised */}
      {issue.issueRaised && (
        <div className="flex items-center mt-2 gap-2">
          <AlertCircle className="text-red-600" />
          <span className="text-red-600">Issue Raised</span>
        </div>
      )}

      {/* Comment */}
      {issue.comment && (
        <div className="mt-2 p-2 rounded bg-amber-200">
          <div className="text-sm text-gray-800">
            <strong>Comment:</strong> {issue.comment}
          </div>
        </div>
      )}

      {/* Update Status button (only for interface) */}
      {mode === "interface" && (
        <Button
          onClick={() => setUpdateDialogOpen(true)}
          variant="secondary"
          className="mt-2 w-fit"
        >
          Update Status
        </Button>
      )}

      {/* Images dialog */}
      <Dialog open={viewImagesOpen} onOpenChange={setViewImagesOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Attached Images</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
            {photoPreviews.map((src, idx) => (
              <img
                key={idx}
                src={src}
                alt={`issue-photo-${idx}`}
                className="w-full h-40 object-cover rounded border cursor-pointer"
                onClick={() => handleThumbnailClick(src)}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Fullscreen image modal */}
      <Dialog open={imageModalOpen} onOpenChange={setImageModalOpen}>
        <DialogContent className="w-[80vh] h-[80vh] max-w-none flex items-center justify-center p-2">
          {modalImage && (
            <img
              src={modalImage}
              alt="Full"
              className="w-full h-full object-contain rounded"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Update status dialog */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Issue Status</DialogTitle>
          </DialogHeader>
          <div className="mt-3">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="border rounded px-2 py-1 w-full"
            >
              <option value="Created">Created</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>
          <DialogFooter>
            <Button onClick={() => setUpdateDialogOpen(false)} variant="outline">
              Cancel
            </Button>
            <Button onClick={handleSaveStatus}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

