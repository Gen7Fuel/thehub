import { useState } from "react";
// import { Checkbox } from "@/components/ui/checkbox";
import { Edit, MessageSquareText, ImagePlus, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CheckSquare, Square, AlertCircle } from "lucide-react"; 
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

interface SelectOption {
  text: string;
  _id: string;
}
interface SelectTemplate {
  _id: string;
  name: string;
  options: SelectOption[];
}
interface ChecklistItemCardProps {
  item: {
    item: string;
    required: boolean;
    checked?: boolean;
    comment?: string;
    photos?: string[];
    // New fields:
    category?: string;
    status?: string;
    followUp?: string;
    assignedTo?: string;
    issueRaised?: boolean;
  };
  onCheck: (checked: boolean) => void;
  onComment: (comment: string) => void;
  onPhotos: (photos: string[]) => void;
  onFieldChange?: (field: "status" | "followUp" | "assignedTo" | "issueRaised", value: string | boolean) => void;
  selectTemplates?: SelectTemplate[];
  borderColor: string;
  lastChecked?: string;
  onIssueToggle: (raised: boolean) => void;
}

export function ChecklistItemCard({
  item,
  onCheck,
  onComment,
  onPhotos,
  onFieldChange,
  selectTemplates = [],
  borderColor,
  lastChecked,
}: ChecklistItemCardProps) {
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentValue, setCommentValue] = useState(item.comment || "");
  const [photoPreviews, setPhotoPreviews] = useState<string[]>(
    (item.photos || []).map(name => `/cdn/download/${name}`)
  );
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [viewImagesOpen, setViewImagesOpen] = useState(false);
  const disabledControls = item.checked;

  // Helper to get options for a select template by name
  const getOptions = (name: string) =>
    selectTemplates.find(t => t.name === name)?.options || [];

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const uploadedFilenames: string[] = [];
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch("/cdn/upload", {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          uploadedFilenames.push(data.filename);
        }
      } catch (err) {}
    }
    const newPhotos = [...(item.photos || []), ...uploadedFilenames];
    setPhotoPreviews(newPhotos.map(name => `/cdn/download/${name}`));
    onPhotos(newPhotos);
  };

  const handleCommentSave = () => {
    onComment(commentValue);
    setCommentOpen(false);
  };

  const handleThumbnailClick = (src: string) => {
    setModalImage(src);
    setImageModalOpen(true);
  };

  // Example for dropdown / buttons
  const handleDisabledClick = () => {
    if (item.checked) {
      alert("Uncheck first to edit this item.");
      return true; // stop propagation
    }
    return false;
  };

  return (
  //   <div className="border rounded p-4 mb-3 flex flex-col gap-2 bg-muted/50 w-150">
  //     <div className="flex items-center gap-3">
  //       <Checkbox
  //         id={`checklist-item-${(item.item || "item").replace(/\s+/g, "-")}`}
  //         checked={!!item.checked}
  //         onCheckedChange={onCheck}
  //       />
  //       <Label
  //         htmlFor={`checklist-item-${(item.item || "item").replace(/\s+/g, "-")}`}
  //         className="font-medium cursor-pointer"
  //       >
  //         {item.item}
  //       </Label>
  //     </div>
    <div
      className={`border-2 rounded-2xl p-4 mb-3 flex flex-col gap-2 w-130 transition-colors
        ${item.issueRaised ? "bg-red-300" : item.checked ? "bg-green-100" : "bg-gray-50"}
        ${borderColor || "border-gray-300"} border-t-5`}
    >
      <div className="flex items-center w-full">
        {/* Label on the left */}
        <Label className="font-medium text-lg cursor-pointer">
          {item.item}
        </Label>

        {/* Buttons container pushed to the right */}
        <div className="flex items-center ml-auto gap-2">
          {/* Comment button */}
          <Button
            variant="outline"
            type="button"
            size="sm"
            onClick={() => {if (!handleDisabledClick()) setCommentOpen(true);}}
            className="bg-sky-100 border-gray-300"
          >
            {item.comment ? (
              <Edit className="w-6 h-6 cursor-pointer text-gray-700" />
            ) : (
              <MessageSquareText className="w-6 h-6 cursor-pointer text-gray-700" />
            )}
          </Button>

          {/* Attach photo */}
          <label>
            <Button variant="outline" type="button" size="sm" className="bg-sky-100 border-gray-300" disabled={disabledControls} asChild>
              <span>
                <ImagePlus className="w-6 h-6 cursor-pointer text-gray-700" />
              </span>
            </Button>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handlePhotoChange}
              disabled={disabledControls}
            />
          </label>

          {/* View images */}
          {photoPreviews.length > 0 && (
            <Button
              variant="outline"
              type="button"
              size="sm"
              onClick={() => {if (!handleDisabledClick()) setViewImagesOpen(true);}}
              className="bg-sky-100 border-gray-300"
            >
              <ImageIcon size={16} className="text-gray-600" />
            </Button>
          )}
          <span onClick={() => onCheck(!item.checked)}>
            {/* Check toggle */}
            {item.checked ? (
              <CheckSquare size={28} className="text-green-600" />
            ) : (
              <Square size={28} className="text-gray-500" />
            )}
          </span>
        </div>
      </div>

      {/* LAst Checked */}
      {lastChecked ? (
        <div className="text-sm text-gray-500">
          Last checked: {new Date(lastChecked).toLocaleString()}
        </div>
      ) : (
        <div className="text-sm text-gray-400 italic">
          Last checked: Date not available
        </div>
      )}


      <div className="flex gap-4 items-center">
        {/* Status */}
        <div className="flex-1 flex flex-col">
          <label className="mb-1 font-medium text-sm">Status</label>
          <Select
            value={item.status || ""}
            onValueChange={(val) => {if (!handleDisabledClick()) onFieldChange?.("status", val);}}
          >
            <SelectTrigger className="w-[100px] bg-gray-100 border-gray-300 focus:ring-2 focus:ring-green-500"
              onClick={(e) => {
                if (item.checked) {
                  e.preventDefault(); // stops dropdown from opening
                  alert("Uncheck first to edit this item.");
                }
              }}
            >
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {getOptions("Status").map((opt) => (
                <SelectItem key={opt._id} value={opt.text}>
                  {opt.text}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Follow Up */}
        <div className="flex-1 flex flex-col">
          <label className="mb-1 font-medium text-sm">Follow Up</label>
          <Select
            value={item.followUp || ""}
            onValueChange={(val) => {if (!handleDisabledClick()) onFieldChange?.("followUp", val);}}
            // disabled={disabledControls}
          >
            <SelectTrigger className="w-[100px] bg-gray-100 border-gray-300 focus:ring-2 focus:ring-green-500"
              onClick={(e) => {
                if (item.checked) {
                  e.preventDefault(); // stops dropdown from opening
                  alert("Uncheck first to edit this item.");
                }
              }}
            >
              <SelectValue placeholder="Follow Up" />
            </SelectTrigger>
            <SelectContent>
              {getOptions("Follow Up").map((opt) => (
                <SelectItem key={opt._id} value={opt.text}>
                  {opt.text}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* <div className="flex justify-end mt-2">
          <label className="flex items-center gap-1 cursor-pointer">
            {/* <span className="text-sm font-medium">Raise Issue</span>
            <input
              type="checkbox"
              checked={item.issueRaised}
              onChange={(e) => {if (!handleDisabledClick()) onFieldChange?.("issueRaised", e.target.checked);}}
              onClick={(e) => {
                if (item.checked) {
                  e.preventDefault(); // stops dropdown from opening
                  alert("Uncheck first to edit this item.");
                }
              }}
              className="w-5 h-5 accent-red-600 rounded"
            /> */}
            {/*<Button
              type="button"
              onClick={(e) => {
                if (item.checked) {
                  e.preventDefault();
                  alert("Uncheck first to edit this item.");
                  return;
                }
                onFieldChange?.("issueRaised", !item.issueRaised);
              }}
              className={`w-6 h-6 flex items-center justify-center rounded border 
                ${item.issueRaised ? "bg-red-100 border-red-400" : "bg-gray-100 border-gray-300"}
              `}
            >
              {item.issueRaised ? (
                <AlertCircle className="h-4 w-4 text-red-600" />
              ) : (
                <Check className="h-4 w-4 text-green-600" />
              )}
              {item.issueRaised ? "Issue Raised" : "Raise Issue"}
            </Button>
          </label>
        </div> */}
        <div className="flex justify-end mt-2">
          <span className="text-sm font-medium mr-2">Raise Issue</span>

          {item.issueRaised ? (
            // ⚠️ Show alert symbol if raised
            <button
              type="button"
              onClick={(e) => {
                if (item.checked) {
                  e.preventDefault();
                  alert("Uncheck first to edit this item.");
                  return;
                }
                onFieldChange?.("issueRaised", false);
              }}
              className="w-6 h-6 flex items-center justify-center rounded border bg-red-100 border-red-400"
            >
              <AlertCircle className="h-4 w-4 text-red-600" />
            </button>
          ) : (
            // ☐ Show normal checkbox if not raised
            <input
              type="checkbox"
              checked={false}
              onChange={(e) => {
                if (item.checked) {
                  e.preventDefault();
                  alert("Uncheck first to edit this item.");
                  return;
                }
                onFieldChange?.("issueRaised", true);
              }}
              className="w-5 h-5 accent-gray-600 rounded cursor-pointer"
            />
          )}
        </div>





      </div>

      
      <Dialog open={imageModalOpen} onOpenChange={setImageModalOpen}>
        <DialogContent className="w-[80vh] h-[80vh] max-w-none flex items-center justify-center p-2">
          {modalImage && (
            <img src={modalImage} alt="Full" className="w-full h-full object-contain rounded" />
          )}
        </DialogContent>
      </Dialog>
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
                alt={`photo-${idx}`}
                className="w-full h-40 object-cover rounded border cursor-pointer"
                onClick={() => handleThumbnailClick(src)} // optional: open in new tab
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={commentOpen} onOpenChange={setCommentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Comment</DialogTitle>
          </DialogHeader>
          <textarea
            className="border rounded w-full p-2 mt-2"
            rows={3}
            value={commentValue}
            onChange={e => setCommentValue(e.target.value)}
          />
          <div className="flex justify-end mt-2">
            <Button size="sm" onClick={handleCommentSave}>Add</Button>
          </div>
        </DialogContent>
      </Dialog>
      {item.comment && (
        <div className="mt-2 p-2 rounded bg-amber-200">
          <div className="text-sm text-gray-800">
            <strong>Comment:</strong> {item.comment}
          </div>
        </div>
      )}
    </div>
  );
}