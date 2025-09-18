import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  };
  onCheck: (checked: boolean) => void;
  onComment: (comment: string) => void;
  onPhotos: (photos: string[]) => void;
  onFieldChange?: (field: "status" | "followUp" | "assignedTo", value: string) => void;
  selectTemplates?: SelectTemplate[];
}

export function ChecklistItemCard({
  item,
  onCheck,
  onComment,
  onPhotos,
  onFieldChange,
  selectTemplates = [],
}: ChecklistItemCardProps) {
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentValue, setCommentValue] = useState(item.comment || "");
  const [photoPreviews, setPhotoPreviews] = useState<string[]>(
    (item.photos || []).map(name => `/cdn/download/${name}`)
  );
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);

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

  return (
    <div className="border rounded p-4 mb-3 flex flex-col gap-2 bg-muted/50 w-150">
      <div className="flex items-center gap-3">
        <Checkbox
          id={`checklist-item-${(item.item || "item").replace(/\s+/g, "-")}`}
          checked={!!item.checked}
          onCheckedChange={onCheck}
        />
        <Label
          htmlFor={`checklist-item-${(item.item || "item").replace(/\s+/g, "-")}`}
          className="font-medium cursor-pointer"
        >
          {item.item}
        </Label>
      </div>
      {/* Category */}
      {item.category && (
        <div>
          <span className="font-medium">Category:</span> {item.category}
        </div>
      )}
      <div className="flex gap-4">
        <div className="flex-1">
          {/* Status Dropdown */}
          <div>
            <label className="block font-medium mb-1">Status</label>
            <Select
              value={item.status || ""}
              onValueChange={val => onFieldChange?.("status", val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {getOptions(item.status || "").map(opt => (
                  <SelectItem key={opt._id} value={opt.text}>
                    {opt.text}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex-1">
          {/* Follow Up Dropdown */}
          <div>
            <label className="block font-medium mb-1">Follow Up</label>
            <Select
              value={item.followUp || ""}
              onValueChange={val => onFieldChange?.("followUp", val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select follow up" />
              </SelectTrigger>
              <SelectContent>
                {getOptions(item.followUp || "").map(opt => (
                  <SelectItem key={opt._id} value={opt.text}>
                    {opt.text}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex-1">
          {/* Assigned To Dropdown */}
          <div>
            <label className="block font-medium mb-1">Assigned To</label>
            <Select
              value={item.assignedTo || ""}
              onValueChange={val => onFieldChange?.("assignedTo", val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select assigned to" />
              </SelectTrigger>
              <SelectContent>
                {getOptions(item.assignedTo || "").map(opt => (
                  <SelectItem key={opt._id} value={opt.text}>
                    {opt.text}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      {/* Comment and Photos */}
      <div className="flex gap-2 mt-2">
        <Button variant="outline" type="button" size="sm" onClick={() => setCommentOpen(true)}>
          {item.comment ? "Edit Comment" : "Add Comment"}
        </Button>
        <label>
          <Button variant="outline" type="button" size="sm" asChild>
            <span>Attach Photos</span>
          </Button>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handlePhotoChange}
          />
        </label>
      </div>
      {photoPreviews.length > 0 && (
        <div className="flex gap-2 mt-2 flex-wrap">
          {photoPreviews.map((src, idx) => (
            <img key={idx} src={src} alt={`photo-${idx}`} className="w-16 h-16 object-cover rounded border"
              onClick={() => handleThumbnailClick(src)}
            />
          ))}
        </div>
      )}
      <Dialog open={imageModalOpen} onOpenChange={setImageModalOpen}>
        <DialogContent>
          {modalImage && (
            <img src={modalImage} alt="Full" className="max-w-full max-h-[70vh] mx-auto rounded" />
          )}
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
        <div className="mt-2 text-sm text-muted-foreground">
          <strong>Comment:</strong> {item.comment}
        </div>
      )}
    </div>
  );
}