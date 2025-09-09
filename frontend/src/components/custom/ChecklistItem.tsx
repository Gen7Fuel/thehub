import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ChecklistItemCardProps {
  item: {
    text: string;
    required: boolean;
    checked?: boolean;
    comment?: string;
    photos?: string[];
  };
  onCheck: (checked: boolean) => void;
  onComment: (comment: string) => void;
  onPhotos: (photos: string[]) => void;
}

export function ChecklistItemCard({ item, onCheck, onComment, onPhotos }: ChecklistItemCardProps) {
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentValue, setCommentValue] = useState(item.comment || "");
  // const [, setPhotoFiles] = useState<File[]>([]);
  // const [photoPreviews, setPhotoPreviews] = useState<string[]>(item.photos || []);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>(
    (item.photos || []).map(name => `/cdn/download/${name}`)
  );
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);

  // Handle photo upload
  // const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const files = Array.from(e.target.files || []);
  //   setPhotoFiles(files);
  //   const previews = files.map(file => URL.createObjectURL(file));
  //   setPhotoPreviews(previews);
  //   // You may want to upload files here and get URLs, then call onPhotos(urls)
  //   onPhotos(previews);
  // };
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Upload each file to CDN and collect their filenames
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
          uploadedFilenames.push(data.filename); // Save the filename returned by the CDN
        }
      } catch (err) {
        // Optionally handle upload error
      }
    }

    // Update the checklist item with the new photo references
    const newPhotos = [...(item.photos || []), ...uploadedFilenames];
    setPhotoPreviews(newPhotos.map(name => `/cdn/download/${name}`));
    onPhotos(newPhotos);
  };

  // Handle comment save
  const handleCommentSave = () => {
    onComment(commentValue);
    setCommentOpen(false);
  };

  const handleThumbnailClick = (src: string) => {
    setModalImage(src);
    setImageModalOpen(true);
  };

  return (
    <div className="border rounded p-4 mb-3 flex flex-col gap-2 bg-muted/50">
      <div className="flex items-center gap-3">
        <Checkbox
          id={`checklist-item-${item.text.replace(/\s+/g, "-")}`}
          checked={!!item.checked}
          onCheckedChange={onCheck}
        />
        <Label
          htmlFor={`checklist-item-${item.text.replace(/\s+/g, "-")}`}
          className="font-medium cursor-pointer"
        >
          {item.text}
        </Label>
      </div>
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
      {/* {photoPreviews.length > 0 && (
        <div className="flex gap-2 mt-2 flex-wrap">
          {photoPreviews.map((src, idx) => (
            <img key={idx} src={src} alt={`photo-${idx}`} className="w-16 h-16 object-cover rounded border" />
          ))}
        </div>
      )} */}
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