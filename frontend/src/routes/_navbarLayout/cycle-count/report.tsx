import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import axios from "axios";
import { ArrowUp, ArrowDown } from "lucide-react";
import { LocationPicker } from "@/components/custom/locationPicker";
import { useAuth } from "@/context/AuthContext";
import { DatePicker } from '@/components/custom/datePicker';
import { fetchLocation } from "../dashboard";
import { Input } from "@/components/ui/input"; // or wherever your Button/Input components are
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { MessageSquareText, MessageSquarePlus } from "lucide-react";
import Barcode from "react-barcode";
import { PasswordProtection } from "@/components/custom/PasswordProtection";


export const Route = createFileRoute("/_navbarLayout/cycle-count/report")({
  component: RouteComponent,
});

interface CycleCountItem {
  _id: string;
  site: string;
  name: string;
  upc_barcode: string;
  foh: number;
  boh: number;
  onHandCSO: number;
  totalQty: number;
  comments?: [];
}

function RouteComponent() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const location = user?.location
  const [date, setDate] = useState<Date | undefined>(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)   // yesterday
    return d
  });
  const [site, setSiteName] = useState(location || "");
  const [items, setItems] = useState<CycleCountItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [barcodeValue, setBarcodeValue] = useState<string | null>(null);

  // Track which item ID is currently open for viewing comments
  const [viewCommentsItemId, setViewCommentsItemId] = useState<string | null>(null);

  // Track which item ID is currently adding/editing a comment
  const [addEditCommentItemId, setAddEditCommentItemId] = useState<string | null>(null);

  // Track the comment text input for adding/editing
  const [commentText, setCommentText] = useState<string>("");

  // Store the current comments for the View Comments dialog
  const [currentComments, setCurrentComments] = useState<
    {
      initials: string;
      author: string;
      text: string;
      createdAt: string;
    }[]
  >([]);


  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  // Rendering passcode dialog for manager access 
  useEffect(() => {
    setShowPasswordDialog(true);
  }, []);

  const handlePasswordSuccess = () => {
    setHasAccess(true);
    setShowPasswordDialog(false);
  };

  const handlePasswordCancel = () => {
    setShowPasswordDialog(false)
    // Navigate back to cycle-count main page
    navigate({ to: '/cycle-count/count' })
  }



  // const today = new Date();
  // const yesterday = today.getDate() - 1


  const fetchReport = async () => {
    if (!date || !site) return;

    setLoading(true);
    try {
      const token = localStorage.getItem("token");

      // Prepare startDate and endDate for daily-counts call
      const selectedDate = new Date(date);
      const startDate = new Date(selectedDate);
      startDate.setDate(selectedDate.getDate() - 1);
      const endDate = new Date(selectedDate);
      endDate.setDate(selectedDate.getDate() + 1);
      const timezone = await fetchLocation(site).then(loc => loc.timezone || "UTC");

      const res = await axios.get("/api/cycle-count/daily-counts", {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          site,
          startDate: startDate.toISOString().slice(0, 10), // YYYY-MM-DD
          endDate: endDate.toISOString().slice(0, 10),
          timezone: timezone
        },
      });

      // Filter the items for the exact selected date
      const selectedDateStr = date.toISOString().slice(0, 10);
      const dayData = res.data.data.find((d: any) => d.date === selectedDateStr);
      console.log(dayData.items)
      setItems(dayData?.items || []);

    } catch (err) {
      console.error("Error fetching report", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReport();
  }, [date, site]);

  const handleViewComments = async (id: string) => {
    const token = localStorage.getItem('token');
    const res = await axios.get(`/api/cycle-count/${id}/comments`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setCurrentComments(res.data.comments || []);
    setViewCommentsItemId(id);
  };

  const handleAddEditComment = (id: string) => {
    setAddEditCommentItemId(id);
  };

  const handleComment = async (id: string, text: string) => {
    const token = localStorage.getItem('token');
    const initials = user?.initials || '';
    const author = user?.name || '';
    await axios.post(`/api/cycle-count/${id}/comments`, { initials, author, text }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    // Refresh comments in table
    fetchReport();
  };



  return (
    <>
      {!hasAccess && (
        <PasswordProtection
          isOpen={showPasswordDialog}
          onSuccess={handlePasswordSuccess}
          onCancel={handlePasswordCancel}
          userLocation={user?.location || "Rankin"}
        />
      )}

      {hasAccess && (
        <div className="p-6">
          <Dialog open={!!barcodeValue} onOpenChange={(open) => !open && setBarcodeValue(null)}>
            <h1 className="text-2xl font-bold mb-4">Cycle Count Report</h1>

            {/* Filters */}
            <div className="flex items-center gap-4 mb-6">
              <DatePicker
                date={date}
                setDate={(value) => {
                  if (typeof value === 'function') {
                    const newDate = value(date)
                    if (newDate) setDate(newDate)
                  } else {
                    setDate(value)
                  }
                }}
                restrictToPast   // 👈 this enables "yesterday & before only"
              />


              <LocationPicker
                setStationName={setSiteName}
                value="stationName"
                // {...(!access.component_cycle_count_count_location_filter ? { disabled: true } : {})}
                defaultValue={location}
              />
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border-collapse border rounded-xl overflow-hidden">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">UPC</th>
                    <th className="px-3 py-2">BOH</th>
                    <th className="px-3 py-2">FOH</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">On Hand CSO</th>
                    <th className="px-3 py-2">Variance</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={8} className="text-center py-4">
                        Loading...
                      </td>
                    </tr>
                  )}

                  {!loading && items.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-4 text-gray-500">
                        No cycle count report found for the selected date.
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    items.map((item) => {
                      const hasCSO = item.onHandCSO !== undefined && item.onHandCSO !== null;
                      const variance = hasCSO ? item.totalQty - item.onHandCSO : 0;

                      return (
                        <tr key={item._id} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-2">{item.name}</td>
                          <td
                            className=" px-3 py-2 text-blue-600 cursor-pointer underline hover:text-blue-800"
                            onClick={() => setBarcodeValue(item.upc_barcode)}
                          >
                            {item.upc_barcode}
                          </td>
                          <td className="px-3 py-2">{item.boh}</td>
                          <td className="px-3 py-2">{item.foh}</td>
                          <td className="px-3 py-2 text-center">{item.totalQty}</td>
                          <td className="px-3 py-2 text-center">{hasCSO ? item.onHandCSO : "-"}</td>

                          {/* Variance column */}
                          <td className="px-3 py-2 text-center align-middle">
                            {hasCSO ? (
                              variance === 0 ? (
                                <span className="text-gray-600">0</span>
                              ) : (
                                <span className="inline-flex items-center gap-1">
                                  <span className={variance > 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                                    {variance > 0 ? `+${variance}` : variance}
                                  </span>
                                  {variance > 0 ? (
                                    <ArrowUp className="text-green-600 w-3 h-3" />
                                  ) : (
                                    <ArrowDown className="text-red-600 w-3 h-3" />
                                  )}
                                </span>
                              )
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>

                          {/* Actions column */}
                          <td className="px-3 py-2 align-middle whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <Button
                                className="flex items-center justify-center py-1 px-2 text-sm bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-md"
                                onClick={() => handleAddEditComment(item._id)}
                              >
                                <MessageSquarePlus className="w-2 h-2 text-gray-400" />
                              </Button>
                              {item.comments && item.comments.length > 0 && (
                                <Button
                                  className="flex items-center justify-center py-1 px-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded-md"
                                  onClick={() => handleViewComments(item._id)}
                                >
                                  <MessageSquareText className="w-2 h-2 text-gray-400 mr-1" />
                                  {item.comments.length}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                </tbody>
              </table>
            </div>
            {/* View Comments Dialog */}
            <Dialog open={!!viewCommentsItemId} onOpenChange={() => setViewCommentsItemId(null)}>
              <DialogContent className="w-[400px] max-w-full">
                <DialogHeader>
                  <DialogTitle>Comments</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto mt-2">
                  {currentComments.length > 0 ? (
                    currentComments.map((c, idx) => (
                      <div key={idx} className="text-sm text-gray-700">
                        <span className="text-xs text-gray-400 mr-1">
                          ({new Date(c.createdAt).toLocaleString("en-US", { month: "short", day: "numeric" })})
                        </span>
                        <span className="font-medium">{c.initials}:</span> {c.text}
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-400 text-sm">No comments yet</div>
                  )}
                </div>
                <DialogFooter>
                  <Button onClick={() => setViewCommentsItemId(null)}>Close</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Add/Edit Comment Dialog */}
            <Dialog open={!!addEditCommentItemId} onOpenChange={() => setAddEditCommentItemId(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Comment</DialogTitle>
                </DialogHeader>

                <Input
                  value={commentText}
                  onChange={(e: any) => setCommentText(e.target.value)}
                  placeholder="Enter your comment..."
                />

                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddEditCommentItemId(null)}>Cancel</Button>
                  <Button
                    onClick={() => {
                      if (addEditCommentItemId && commentText.trim()) {
                        handleComment(addEditCommentItemId, commentText.trim());
                        setCommentText("");
                        setAddEditCommentItemId(null);
                      }
                    }}
                  >
                    Add
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>UPC Barcode</DialogTitle>
              </DialogHeader>
              <div className="flex justify-center items-center py-4">
                {barcodeValue && <Barcode value={barcodeValue} />}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </>
  );
}