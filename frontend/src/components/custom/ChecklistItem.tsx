import { useState } from "react";
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
    category?: string;
    status?: string;
    followUp?: string;
    assignedTo?: string;
    issueRaised?: boolean;
    checkedAt?: string;
    requestOrder?: boolean;
    orderCreated?: boolean;
    statusTemplate: string;
    followUpTemplate: string;
    commentRequired?: boolean;
  };
  onCheck?: (checked: boolean) => void;
  onComment?: (comment: string) => void;
  onPhotos?: (photos: string[]) => void;
  onFieldChange?: (field: "status" | "followUp" | "assignedTo" | "issueRaised", value: string | boolean) => void;
  selectTemplates?: SelectTemplate[];
  borderColor?: string;
  lastChecked?: string;
  onIssueToggle?: (raised: boolean) => void;
  mode?: "station" | "interface"; // New prop  
  templateName?: string;
  type?: "store" | "visitor";
}

export function ChecklistItemCard({
  item,
  onCheck = () => { },
  onComment = () => { },
  onPhotos = () => { },
  onFieldChange = () => { },
  selectTemplates = [],
  borderColor = "border-gray-300",
  lastChecked,
  mode = "station",
  templateName,
  type = "store",
}: ChecklistItemCardProps) {
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentValue, setCommentValue] = useState(item.comment || "");
  const [photoPreviews, setPhotoPreviews] = useState<string[]>(
    (item.photos || []).map(name => `/cdn/download/${name}`)
  );
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [viewImagesOpen, setViewImagesOpen] = useState(false);

  const disabledControls = mode === "interface" || item.checked;
  // const FIELD_TO_TEMPLATE: Record<string, string> = {
  //   status: "Status",    // the template name in selectTemplates
  //   followUp: "Follow Up",
  // };


  const getOptions = (name: string) =>
    selectTemplates.find(t => t.name === name)?.options || [];
  // const getOptionsForField = (field: "status" | "followUp") => {
  //   const temp = FIELD_TO_TEMPLATE[field];
  //   console.log(temp)
  //   return selectTemplates.find(t => t.name === temp)?.options || [];
  // };


  // const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  //   if (mode === "interface") return; // read-only
  //   const files = Array.from(e.target.files || []);
  //   if (files.length === 0) return;
  //   const uploadedFilenames: string[] = [];
  //   for (const file of files) {
  //     const formData = new FormData();
  //     formData.append("file", file);
  //     try {
  //       const res = await fetch("/cdn/upload", {
  //         method: "POST",
  //         body: formData,
  //       });
  //       if (res.ok) {
  //         const data = await res.json();
  //         uploadedFilenames.push(data.filename);
  //       }
  //     } catch { }
  //   }
  //   const newPhotos = [...(item.photos || []), ...uploadedFilenames];
  //   setPhotoPreviews(newPhotos.map(name => `/cdn/download/${name}`));
  //   onPhotos(newPhotos);
  // };
  const handleCameraPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (mode === "interface") return; // read-only

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

        if (!res.ok) throw new Error("Image upload failed");

        const data = await res.json();
        uploadedFilenames.push(data.filename);
      } catch (err) {
        console.error(err);
        alert("Failed to upload image");
      }
    }

    const newPhotos = [...(item.photos || []), ...uploadedFilenames];
    setPhotoPreviews(newPhotos.map(name => `/cdn/download/${name}`));
    onPhotos(newPhotos);

    e.target.value = ""; // reset input
  };


  const handleCommentSave = () => {
    onComment(commentValue);
    setCommentOpen(false);

    // If this item requires a comment and user added one → now allow checking
    // if (item.commentRequired && !item.checked && commentValue.trim() !== "") {
    //   onCheck(true);
    // }
  };

  const handleThumbnailClick = (src: string) => {
    setModalImage(src);
    setImageModalOpen(true);
  };

  const handleDisabledClick = () => {
    if (item.checked) {
      alert("Uncheck to edit this item.");
      return true;
    }
    return false;
  };

  const handleCheckClick = () => {
    if (mode !== "station") return;

    // 1. If the item requires a comment and doesn't have one yet
    if (item.commentRequired && !item.comment) {
      alert("Comment is required for this checklist item.");
      setCommentOpen(true); // open dialog
      return;
    }

    // 2. Otherwise, allow checking
    onCheck(!item.checked);
  };

  return (
    <div
      className={`border-2 rounded-2xl p-4 mb-3 flex flex-col gap-2 w-130 transition-colors
        ${item.issueRaised ? "bg-red-300" : item.checked ? "bg-green-100" : "bg-gray-50"}
        ${borderColor} border-t-5`}
    >
      <div className="flex items-center w-full">
        <Label className="font-medium text-lg cursor-pointer">{item.item}</Label>

        <div className="flex items-center ml-auto gap-2">
          {/* Comment button – only show in station mode */}
          {mode === "station" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => !handleDisabledClick() && setCommentOpen(true)}
              className="bg-sky-100 border-gray-300"
            >
              {item.comment ? (
                <Edit className="w-6 h-6 text-gray-700" />
              ) : (
                <MessageSquareText className="w-6 h-6 text-gray-700" />
              )}
            </Button>
          )}

          {/* Attach Photo – only in station mode */}
          {/* {mode === "station" && (
            <label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="bg-sky-100 border-gray-300"
                disabled={disabledControls}
                asChild
              >
                <span>
                  <ImagePlus className="w-6 h-6 text-gray-700" />
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
          )} */}
          {mode === "station" && (
            <label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="bg-sky-100 border-gray-300"
                disabled={disabledControls}
                asChild
              >
                <span>
                  <ImagePlus className="w-6 h-6 text-gray-700" />
                </span>
              </Button>
              <input
                type="file"
                accept="image/*"
                capture="environment" // open rear camera
                multiple
                className="hidden"
                onChange={handleCameraPhotoChange} // updated handler
                disabled={disabledControls}
              />
            </label>
          )}


          {/* View images – always visible if photos exist */}
          {photoPreviews.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setViewImagesOpen(true)}
              className="bg-sky-100 border-gray-300"
            >
              <ImageIcon size={16} className="text-gray-600" />
            </Button>
          )}

          {/* Checkbox – only clickable in station mode */}
          {/* <span onClick={() => mode === "station" && onCheck(!item.checked)}>
            {item.checked ? (
              <CheckSquare size={28} className="text-green-600" />
            ) : (
              <Square size={28} className="text-gray-500" />
            )}
          </span> */}
          <span onClick={handleCheckClick}>
            {item.checked ? (
              <CheckSquare size={28} className="text-green-600" />
            ) : (
              <Square size={28} className="text-gray-500" />
            )}
          </span>
        </div>
      </div>
      {/* CheckedAt display in interface mode */}
      {mode === "interface" ? (
        <div className={`text-sm ${item.checkedAt ? "text-gray-500" : "text-gray-400 italic"}`}>
          Completed at: {item.checkedAt ? new Date(item.checkedAt).toLocaleString() : "Not Checked Yet"}
        </div>
      ) : (
        <div className={`text-sm ${lastChecked ? "text-gray-500" : "text-gray-400 italic"}`}>
          {type === "visitor" ? "Last Check By Station:" : "Last checked:"}{" "}
          {lastChecked ? new Date(lastChecked).toLocaleString() : "Date not available"}
        </div>
      )}

      {/* Fields */}
      <div className="flex gap-4 items-center mt-2">
        {/* --- STATUS DROPDOWN --- */}
        <div className="flex-1 flex flex-col">
          <Select
            value={item.status || undefined}
            onValueChange={(val) => !handleDisabledClick() && onFieldChange("status", val)}
          >
            <SelectTrigger className="w-[150px] bg-gray-100 border-gray-300 focus:ring-2 focus:ring-green-500">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {getOptions(item.statusTemplate).map((opt) => (
                <SelectItem key={opt._id} value={opt.text}>
                  {opt.text}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* --- FOLLOW UP DROPDOWN --- */}
        {/* <div className="flex-1 flex flex-col">
          <Select
            value={item.followUp || undefined}
            onValueChange={(val) => !handleDisabledClick() && onFieldChange("followUp", val)}
          >
            <SelectTrigger className="w-[150px] bg-gray-100 border-gray-300 focus:ring-2 focus:ring-green-500">
              <SelectValue placeholder="Follow Up" />
            </SelectTrigger>
            <SelectContent>
              {getOptions(item.followUpTemplate).map((opt) => (
                <SelectItem key={opt._id} value={opt.text}>
                  {opt.text}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div> */}
        {/* Request Order / Raise Issue / Order Created */}
        <div className="flex justify-end mt-2">
          {item.orderCreated !== true ? (
            templateName === "Orders" ? (
              <>
                <span className="text-sm font-medium mr-2">Request Order</span>
                <input
                  type="checkbox"
                  checked={item.requestOrder || false}
                  onChange={() => {
                    if (!handleDisabledClick() && mode === "station") {
                      onFieldChange("requestOrder" as any, !item.requestOrder);
                    }
                  }}
                  className="w-5 h-5 accent-gray-600 rounded cursor-pointer"
                />
              </>
            ) : (
              <>
                <span className="text-sm font-medium mr-2">Raise Issue</span>
                {item.issueRaised ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!handleDisabledClick() && mode === "station") {
                        onFieldChange("issueRaised", !item.issueRaised);
                      }
                    }}
                    className="w-6 h-6 flex items-center justify-center rounded border bg-red-100 border-red-400"
                  >
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  </button>
                ) : (
                  <input
                    type="checkbox"
                    checked={item.issueRaised || false}
                    onChange={() => {
                      if (!handleDisabledClick() && mode === "station") {
                        onFieldChange("issueRaised", !item.issueRaised);
                      }
                    }}
                    className="w-5 h-5 accent-gray-600 rounded cursor-pointer"
                  />
                )}
              </>
            )
          ) : (
            <span className="px-3 py-1 rounded-full text-black text-sm bg-green-500 text-black">
              Order Created
            </span>
          )}
        </div>

      </div>

      {/* Dialogs */}
      <Dialog open={imageModalOpen} onOpenChange={setImageModalOpen}>
        <DialogContent className="w-[80vh] h-[80vh] max-w-none flex items-center justify-center p-2">
          {modalImage && <img src={modalImage} alt="Full" className="w-full h-full object-contain rounded" />}
        </DialogContent>
      </Dialog>
      <Dialog open={viewImagesOpen} onOpenChange={setViewImagesOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Attached Images</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
            {photoPreviews.map((src, idx) => (
              <img key={idx} src={src} alt={`photo-${idx}`} className="w-full h-40 object-cover rounded border cursor-pointer" onClick={() => handleThumbnailClick(src)} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
      {mode === "station" && (
        <Dialog open={commentOpen} onOpenChange={setCommentOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Comment</DialogTitle>
            </DialogHeader>
            <textarea
              className="border rounded w-full p-2 mt-2"
              rows={3}
              value={commentValue}
              onChange={(e) => setCommentValue(e.target.value)}
            />
            <div className="flex justify-end mt-2">
              <Button size="sm" onClick={handleCommentSave}>Add</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {item.comment && (
        <div className="mt-2 p-2 rounded bg-amber-200">
          <div className="text-sm text-gray-800"><strong>Comment:</strong> {item.comment}</div>
        </div>
      )}
    </div>
  );
}
