import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { camelCaseToTitleCase } from '@/lib/utils'
import { Square, CheckSquare, MinusSquare, Plus, Minus } from 'lucide-react';
import ExcelJS from 'exceljs';
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Trash2 } from 'lucide-react'
import { getOrderRecStatusColor } from "@/lib/utils"
import { getOrderRecById, saveOrderRec, savePendingAction, hasPendingActionsForId, deletePendingActionsForId } from "@/lib/orderRecIndexedDB"
import { useAuth } from "@/context/AuthContext";
import { isActuallyOnline } from "@/lib/network";
// import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute('/_navbarLayout/order-rec/$id')({
  component: RouteComponent,
})

interface Item {
  gtin: string;
  onHandQty: number;
  onHandQtyOld: number;
  // casesToOrder: number;
  // casesToOrderOld: number;
}

function RouteComponent() {
  const { id } = Route.useParams()
  const { user } = useAuth()
  const [orderRec, setOrderRec] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<{ catIdx: number, itemIdx: number } | null>(null)
  const [notifying, setNotifying] = useState<boolean>(false)

  const [extraNote, setExtraNote] = useState(orderRec?.extraItemsNote || '');
  const [savingNote, setSavingNote] = useState(false);
  const [noteSuccess, setNoteSuccess] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const navigate = useNavigate()
  // const [switchLoading, setSwitchLoading] = useState(false);

  // Keep textarea in sync if orderRec changes
  useEffect(() => {
    setExtraNote(orderRec?.extraItemsNote || '');
  }, [orderRec]);

  // useEffect(() => {
  //   const fetchOrderRec = async () => {
  //     try {
  //       const res = await axios.get(`/api/order-rec/${id}`, {
  //         headers: {
  //           Authorization: `Bearer ${localStorage.getItem('token')}`
  //         }
  //       })
  //       setOrderRec(res.data)
  //     } catch (err) {
  //       setError('Failed to fetch order rec')
  //     } finally {
  //       setLoading(false)
  //     }
  //   }
  //   fetchOrderRec()
  // }, [id])

  // useEffect(() => {
  //   const fetchOrderRec = async () => {
  //     try {
  //       const res = await axios.get(`/api/order-rec/${id}`, {
  //         headers: {
  //           Authorization: `Bearer ${localStorage.getItem('token')}`
  //         }
  //       })
  //       setOrderRec(res.data)
  //     } catch (err) {
  //       setError('Failed to fetch order rec')
  //     } finally {
  //       setLoading(false)
  //     }
  //   }
  //   fetchOrderRec()
  // }, [id])
  useEffect(() => {
    const fetchOrderRec = async () => {
      try {
        // 1️⃣ Load cached data for instant UI
        const cached = await getOrderRecById(id);
        if (cached) {
          console.log("📦 Using cached order rec");
          setOrderRec(cached);
        }

        // 2️⃣ Check if we can safely refresh
        // const pendingExists = await hasPendingActions();
        // if (pendingExists) {
        //   console.log("⏸️ Skipping backend fetch — pending actions exist");
        //   return; // prevent overwrite until sync completes
        // }
        const pendingExists = await hasPendingActionsForId(id);
        if (pendingExists) {
          console.log("⏸️ Skipping backend fetch — pending actions exist for this order only");
          return;
        }

        // 3️⃣ Safe to refresh from backend
        const online = await isActuallyOnline();
        if (online) {
          const res = await axios.get(`/api/order-rec/${id}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, "X-Required-Permission": "orderRec.id" },
          });

          if (res.status === 403) {
            navigate({ to: "/no-access" });
            return;
          }
          const orderRecToSave = { ...res.data, id: res.data._id, _id: res.data._id };

          console.log("🌐 Refreshed from backend");
          setOrderRec(orderRecToSave);
          await saveOrderRec(orderRecToSave);
        } else if (!cached) {
          console.warn("⚠️ Offline and no cache available");
          setError("Offline and no cached data available");
        }
      } catch (err) {
        console.error("❌ Failed to fetch order rec", err);
        if (!orderRec) setError("Failed to fetch order rec");
      } finally {
        setLoading(false);
      }
    };
    if (user?.access?.orderRec?.id) {
      fetchOrderRec();
    } else {
      navigate({ to: "/no-access" });
    }
  }, [id]);


  // useEffect(() => {
  //   let interval: NodeJS.Timeout | null = null;

  //   const fetchOrderRec = async () => {
  //   try {
  //     const online = await isActuallyOnline();

  //     if (online) {
  //       const res = await axios.get(`/api/order-rec/${id}`, {
  //         headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  //       });
  //       const orderRecToSave = { ...res.data, id: res.data._id || res.data.id };

  //       setOrderRec(orderRecToSave);
  //       await saveOrderRec(orderRecToSave);
  //     } else {
  //       // Only load cached data if offline
  //       const cached = await getOrderRecById(id);
  //       if (cached) setOrderRec(cached);
  //       else setError('Offline and no cached data available');
  //     }
  //   } catch (err) {
  //     console.error('Failed to fetch order rec', err);
  //     // Optional: fallback to cache
  //     const cached = await getOrderRecById(id);
  //     if (cached) setOrderRec(cached);
  //     else setError('Failed to fetch order rec');
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  //   // 🟢 Initial fetch
  //   fetchOrderRec();

  //   // 🔁 Periodic backend refresh (every minute)
  //   interval = setInterval(async () => {
  //     const online = await isActuallyOnline();
  //     if (online) {
  //       await fetchOrderRec(); // skip cache, force backend fetch
  //     } else {
  //       console.warn('⚠️ Skipping refresh — still offline');
  //     }
  //   }, 60 * 1000);

  //   return () => {
  //     if (interval) clearInterval(interval);
  //   };
  // }, [id]);



  // const handleSwitchChange = async (field: "orderPlaced" | "delivered", value: boolean) => {
  //   setSwitchLoading(true);
  //   console.log("Fetching with:", field, value)
  //   try {
  //     await axios.put(`/api/order-rec/${id}`, { [field]: value }, {
  //       headers: {
  //         Authorization: `Bearer ${localStorage.getItem('token')}`
  //       }
  //     });
  //     setOrderRec((prev: any) => ({ ...prev, [field]: value }));
  //   } catch (err) {
  //     alert("Failed to update status.");
  //   }
  //   setSwitchLoading(false);
  // };

  const handleDelete = async () => {
    const confirmed = window.confirm("Are you sure you want to delete this order rec? This action cannot be undone.");
    if (!confirmed) return;

    try {
      const response = await axios.delete(`/api/order-rec/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          "X-Required-Permission": "orderRec.id.deleteButton",
        },
      });

      // ✅ Handle 403 Forbidden
      if (response.status === 403) {
        navigate({ to: "/no-access" });
        return;
      }

      await deletePendingActionsForId(id);

      // ✅ Redirect to list after successful delete
      navigate({ to: "/order-rec/list" });

    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        navigate({ to: "/no-access" });
        return;
      }

      console.error("Delete order rec error:", err);
      alert("Failed to delete order rec.");
    }
  };


  const handleChange = (catIdx: number, itemIdx: number, field: string, value: number) => {
    setOrderRec((prev: any) => {
      const updated = { ...prev }
      updated.categories[catIdx].items[itemIdx][field] = value
      return updated
    })
  }

  // const handleNotify = async () => {
  //   const confirmed = window.confirm('Are you sure you want to notify that this order rec has been reconciled?')
  //   if (!confirmed) return

  //   setNotifying(true)
  //   try {
  //     await axios.post('/api/send-email', {
  //       to: orderRec.email,
  //       cc: ['grayson@gen7fuel.com', 'mohammad@gen7fuel.com'],
  //       subject: 'Order Reconciliation Completed',
  //       text: `Order reconciliation file "${orderRec.filename}" has been reconciled from site "${orderRec.site}".`,
  //       isHtml: false
  //     }, {
  //       headers: {
  //         Authorization: `Bearer ${localStorage.getItem('token')}`
  //       }
  //     })
  //     alert('Notification sent!')
  //   } catch (err) {
  //     alert('Failed to send notification.')
  //   } finally {
  //     setNotifying(false)
  //   }
  // }
  const handleNotify = async () => {
    const userEmail = user?.email;
    // Get the site value from the order rec
    const site = orderRec?.site;
    interface Vendor {
      name: string;
    }
    // make a call to /api/vendors/:id to get the vendor name
    const response = await axios.get(`/api/vendors/${orderRec?.vendor}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    });

    const vendor: Vendor = response.data;
    const vendorName = vendor.name || 'Unknown';
    // If the uploader is the current user, notify the store only (do NOT mark as completed)
    if (userEmail === orderRec?.email) {
      const confirmed = window.confirm(
        "Are you sure you want to notify the store that a new order rec has been uploaded?"
      );
      if (!confirmed) return;

      try {
        // Fetch the store email from the location API
        const locationRes = await axios.get(`/api/locations?stationName=${encodeURIComponent(site)}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
        const storeEmail = locationRes.data?.email;

        if (!storeEmail) {
          alert("Store email not found for this site.");
          return;
        }

        const subjectCreated = `📦 New Order Recommendation for Site ${site}`;
        const textCreated = `A new order recommendation has been uploaded for site ${site}.
        Vendor: ${vendorName}
        File: ${orderRec?.filename}

        Please review it in The Hub: https://app.gen7fuel.com/order-rec/${orderRec?._id}`;

        const htmlCreated = `
        <div style="
          font-family: 'Segoe UI', Arial, sans-serif;
          background-color: #f7f9fc;
          padding: 30px;
        ">
          <div style="
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.08);
            overflow: hidden;
          ">
            <!-- Header -->
            <div style="
              background-color: #2563eb;
              color: #ffffff;
              text-align: center;
              padding: 16px 0;
            ">
              <h1 style="margin: 0; font-size: 22px;">📦 New Order Recommendation Uploaded</h1>
            </div>

            <!-- Body -->
            <div style="padding: 24px 30px;">
              <p style="font-size: 16px; color: #333;">
                A new order recommendation has been uploaded for the following site:
              </p>

              <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                <tr>
                  <td style="padding: 8px; font-weight: bold; color: #555;">🏪 Site:</td>
                  <td style="padding: 8px; color: #222;">${site}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; font-weight: bold; color: #555;">🧾 Vendor:</td>
                  <td style="padding: 8px; color: #222;">${vendorName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; font-weight: bold; color: #555;">📄 File:</td>
                  <td style="padding: 8px; color: #222;">${orderRec.filename}</td>
                </tr>
              </table>

              <div style="
                margin-top: 24px;
                background-color: #e0f7fa;
                border-left: 6px solid #00acc1;
                padding: 16px;
                border-radius: 8px;
              ">
                <p style="margin: 0; color: #006064; font-size: 15px;">
                  ℹ️ Please review this order in <strong>The Hub → Order Recommendations</strong> and proceed as needed.
                </p>
              </div>

              <div style="text-align: center; margin-top: 30px;">
                <a href="https://app.gen7fuel.com/order-rec/${orderRec._id}" 
                  style="
                    background-color: #2563eb;
                    color: #ffffff;
                    padding: 12px 22px;
                    text-decoration: none;
                    font-weight: 600;
                    border-radius: 6px;
                    display: inline-block;
                    font-size: 15px;
                  ">
                  🔗 View Order Recommendation
                </a>
              </div>

              <p style="color: #777; font-size: 13px; margin-top: 32px; text-align: center;">
                This is an automated message from the Gen7Fuel Hub.<br>
                Please do not reply to this email.
              </p>
            </div>
          </div>
        </div>
        `;
        // Send the email
        await axios.post("/api/send-email", {
          to: storeEmail,
          cc: ["grayson@gen7fuel.com", userEmail, "daksh@gen7fuel.com"],
          subject: subjectCreated,
          text: textCreated,
          html: htmlCreated,
          isHtml: true,
        }, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });

        alert("Notification email sent to the store.");
        // Do NOT mark as completed
        return;
      } catch (err) {
        alert('Failed to send notification.');
        return;
      }
    }

    // Make sure orderRec.completed is true before notifying
    if (orderRec?.completed !== 'Complete') {
      alert('Please make sure all line items are checked before notifying.');
      return; // stay on page, do nothing else
    }
    // Default notify logic for other users (mark as completed and notify)
    const confirmed = window.confirm('Are you sure you want to notify that this order rec has been reconciled?');
    if (!confirmed) return;
    setNotifying(true);
    const subjectCompleted = `✅ Order Reconciliation Completed for Site ${site}`;
    const textCompleted = `The order reconciliation for site ${site} has been completed.
      Vendor: ${vendorName}
      File: ${orderRec.filename}

      You can now review and proceed with placing the order in The Hub: https://app.gen7fuel.com/order-rec/${orderRec._id}`;

    const htmlCompleted = `
      <div style="
        font-family: 'Segoe UI', Arial, sans-serif;
        background-color: #f7f9fc;
        padding: 30px;
      ">
        <div style="
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 12px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.08);
          overflow: hidden;
        ">
          <!-- Header -->
          <div style="
            background-color: #22c55e;
            color: #ffffff;
            text-align: center;
            padding: 16px 0;
          ">
            <h1 style="margin: 0; font-size: 22px;">✅ Order Reconciliation Completed</h1>
          </div>

          <!-- Body -->
          <div style="padding: 24px 30px;">
            <p style="font-size: 16px; color: #333;">
              The order reconciliation has been completed for the following site:
            </p>

            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
              <tr>
                <td style="padding: 8px; font-weight: bold; color: #555;">🏪 Site:</td>
                <td style="padding: 8px; color: #222;">${site}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold; color: #555;">🧾 Vendor:</td>
                <td style="padding: 8px; color: #222;">${vendorName}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold; color: #555;">📄 File:</td>
                <td style="padding: 8px; color: #222;">${orderRec.filename}</td>
              </tr>
            </table>

            <div style="
              margin-top: 24px;
              background-color: #d1fae5;
              border-left: 6px solid #10b981;
              padding: 16px;
              border-radius: 8px;
            ">
              <p style="margin: 0; color: #065f46; font-size: 15px;">
                ✅ The order is ready for review and processing in <strong>The Hub → Order Recommendations</strong>.
              </p>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <a href="https://app.gen7fuel.com/order-rec/${orderRec._id}" 
                style="
                  background-color: #22c55e;
                  color: #ffffff;
                  padding: 12px 22px;
                  text-decoration: none;
                  font-weight: 600;
                  border-radius: 6px;
                  display: inline-block;
                  font-size: 15px;
                ">
                🔗 View Completed Order
              </a>
            </div>

            <p style="color: #777; font-size: 13px; margin-top: 32px; text-align: center;">
              This is an automated message from the Gen7Fuel Hub.<br>
              Please do not reply to this email.
            </p>
          </div>
        </div>
      </div>
      `;
    try {
      await axios.post('/api/send-email', {
        to: orderRec.email,
        cc: ['grayson@gen7fuel.com', 'daksh@gen7fuel.com'],
        subject: subjectCompleted,
        text: textCompleted,
        html: htmlCompleted,
        isHtml: true
      }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      alert('Notification sent!');
      // Optionally mark as completed here if needed
    } catch (err) {
      alert('Failed to send notification.');
    } finally {
      setNotifying(false);
    }
  };

  const isChanged = (item: Item) => {
    return item.onHandQty !== item.onHandQtyOld;
  }

  // Toggle item completion
  // const handleToggleItemCompleted = async (catIdx: number, itemIdx: number, completed: boolean, isChanged: boolean) => {
  //   try {
  //     console.log(`Toggling completion for item at catIdx ${catIdx}, itemIdx ${itemIdx} to ${completed}`);
  //     // add authorization header with bearer token
  //     const res = await axios.put(`/api/order-rec/${id}/item/${catIdx}/${itemIdx}`, { completed, isChanged },  {
  //       headers: {
  //         Authorization: `Bearer ${localStorage.getItem('token')}`
  //       }
  //     });
  //     console.log('Update response:', res.data);
  //     setOrderRec(res.data);
  //   } catch (err) {
  //     alert('Failed to update completion status.');
  //   }
  // };
  // const handleToggleItemCompleted = async (
  //   catIdx: number,
  //   itemIdx: number,
  //   completed: boolean,
  //   isChanged: boolean
  // ) => {
  //   if (!orderRec) return;

  //   // 1️⃣ Create updated copy of orderRec
  //   const updatedOrderRec = {
  //     ...orderRec,
  //     categories: orderRec.categories.map((cat: any, cIdx: any) =>
  //       cIdx === catIdx
  //         ? {
  //             ...cat,
  //             items: cat.items.map((item: any, iIdx: any) =>
  //               iIdx === itemIdx ? { ...item, completed } : item
  //             ),
  //           }
  //         : cat
  //     ),
  //   };

  //   // 2️⃣ Update React state
  //   setOrderRec(updatedOrderRec);

  //   // 3️⃣ Always save locally first
  //   try {
  //     await saveOrderRec(updatedOrderRec);
  //   } catch (err) {
  //     console.error('Failed to save locally:', err);
  //   }
  // };
  //   const handleToggleItemCompleted = async (
  //     catIdx: number,
  //     itemIdx: number,
  //     completed: boolean,
  //     isChanged: boolean
  //   ) => {
  //     if (!orderRec) return;

  //     const orderId = orderRec.id || orderRec._id; // <- fallback to _id
  //     if (!orderId) {
  //       console.error("❌ No orderId available!");
  //       return;
  //     }

  //     const updatedOrderRec = {
  //       ...orderRec,
  //       categories: orderRec.categories.map((cat: any, cIdx: any) =>
  //         cIdx === catIdx
  //           ? {
  //               ...cat,
  //               items: cat.items.map((item: any, iIdx: any) =>
  //                 iIdx === itemIdx ? { ...item, completed } : item
  //               ),
  //             }
  //           : cat
  //       ),
  //     };

  //     setOrderRec(updatedOrderRec);
  //     await saveOrderRec(updatedOrderRec);

  //     const action = {
  //       type: 'TOGGLE_ITEM',
  //       orderId,      // ✅ ensure it's always defined
  //       catIdx,
  //       itemIdx,
  //       completed,
  //       isChanged,
  //       timestamp: Date.now(),
  //     };

  //     try {
  //       const online = await isActuallyOnline();
  //       if (online) {
  //         const res = await axios.put(
  //           `/api/order-rec/${orderId}/item/${catIdx}/${itemIdx}`,
  //           { completed, isChanged },
  //           { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
  //         );

  //         const orderToSave = { ...res.data, id: res.data._id || res.data.id };
  //         await saveOrderRec(orderToSave);
  //         setOrderRec(orderToSave);
  //       } else {
  //         console.warn('Offline — saving toggle action for later');
  //         await savePendingAction(action);
  //       }
  //     } catch (err: unknown) {
  //       console.error('Online update failed, saving action offline', err);
  //       await savePendingAction(action);
  //     }
  // };

  let saveTimer: NodeJS.Timeout | null = null;

  const debouncedSaveOrderRec = async (orderRec: any) => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      await saveOrderRec(orderRec); // always save locally
    }, 200);
  };

  const handleToggleItemCompleted = async (
    catIdx: number,
    itemIdx: number,
    completed: boolean,
    isChanged: boolean
  ) => {
    if (!orderRec) return;

    const orderId = orderRec.id;
    if (!orderId) return console.error("❌ No orderId available!");

    // 1️⃣ Update UI immediately
    setOrderRec((prev: any) => {
      if (!prev) return prev;

      const updatedCategories = prev.categories.map((cat: any, cIdx: number) => {
        if (cIdx !== catIdx) return cat;
        const updatedItems = cat.items.map((item: any, iIdx: number) =>
          iIdx === itemIdx ? { ...item, completed } : item
        );
        return {
          ...cat,
          items: updatedItems,
          completed: updatedItems.every((i: any) => i.completed),
        };
      });

      const allCompleted = updatedCategories.every((cat: any) => cat.completed);
      const nextOrderRec = {
        ...prev,
        categories: updatedCategories,
        currentStatus: allCompleted ? "Completed" : "Created",
        completed: allCompleted ? "Complete" : "Incomplete",
      };

      debouncedSaveOrderRec(nextOrderRec); // save locally
      return nextOrderRec;
    });

    // 2️⃣ Queue action for sync
    const action = {
      type: "TOGGLE_ITEM",
      orderId,
      catIdx,
      itemIdx,
      completed,
      isChanged,
      timestamp: Date.now(),
    };

    await savePendingAction(action); // always save in IndexedDB
  };

  const handleExport = async () => {
    if (!orderRec) return;
    try {
      const blob = await exportOrderRecToExcel(orderRec);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${orderRec.filename || 'order-reconciliation'}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export Excel file.');
    }
  };

  const handleRowClick = (catIdx: number, itemIdx: number, completed: boolean) => {
    if (completed) {
      alert("Completed items cannot be edited. To edit, uncheck the button first.");
      return;
    }
    setEditItem({ catIdx, itemIdx });
  };

  // async function exportOrderRecToExcel(orderRec: any) {
  //   const workbook = new ExcelJS.Workbook();
  //   const worksheet = workbook.addWorksheet('Order Reconciliation');

  //   let currentRow = 1;

  //   // Add column headers
  //   const headers = [
  //     'GTIN', 'VIN', 'Item Name', 'Size', 'On Hand Qty', 'Forecast', 'Min Stock',
  //     'Items To Order', 'Unit In Case', 'Cases To Order'
  //   ];
  //   headers.forEach((header, index) => {
  //     const headerCell = worksheet.getCell(currentRow, index + 1);
  //     headerCell.value = header;
  //     headerCell.font = { bold: true };
  //     headerCell.fill = {
  //       type: 'pattern',
  //       pattern: 'solid',
  //       fgColor: { argb: 'FFE2EFDA' }
  //     };
  //   });
  //   currentRow++;

  //   for (const category of orderRec.categories) {
  //     // Add category header
  //     const categoryCell = worksheet.getCell(currentRow, 1);
  //     categoryCell.value = `${category.number} | ${category.name}`;
  //     categoryCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  //     categoryCell.fill = {
  //       type: 'pattern',
  //       pattern: 'solid',
  //       fgColor: { argb: 'FF4472C4' }
  //     };
  //     worksheet.mergeCells(currentRow, 1, currentRow, 10);
  //     currentRow++;

  //     // Add items
  //     for (const item of category.items) {
  //       if (Number(item.casesToOrder) === 0) continue; // <-- Skip if casesToOrder is 0
  //       const row = worksheet.getRow(currentRow);
  //       row.height = 22.5;
  //       row.getCell(1).value = item.gtin;
  //       row.getCell(2).value = item.vin;
  //       row.getCell(3).value = item.itemName;
  //       if (item.strainName) {
  //         row.getCell(4).value = item.strainName;
  //         row.getCell(5).value = item.size;
  //         row.getCell(6).value = item.onHandQty;
  //         row.getCell(7).value = item.forecast;
  //         row.getCell(8).value = item.minStock;
  //         row.getCell(9).value = item.itemsToOrder;
  //         row.getCell(10).value = item.casesToOrder;
  //       }
  //       row.getCell(4).value = item.size;
  //       row.getCell(5).value = item.onHandQty;
  //       row.getCell(6).value = item.forecast;
  //       row.getCell(7).value = item.minStock;
  //       row.getCell(8).value = item.itemsToOrder;
  //       row.getCell(9).value = item.unitInCase;
  //       row.getCell(10).value = item.casesToOrder;

  //       for (let colIndex = 1; colIndex <= 10; colIndex++) {
  //         row.getCell(colIndex).alignment = { vertical: 'middle' };
  //       }
  //       row.getCell(1).numFmt = '@';
  //       row.getCell(2).numFmt = '@';
  //       for (let colIndex = 5; colIndex <= 10; colIndex++) {
  //         row.getCell(colIndex).numFmt = '#,##0';
  //       }
  //       currentRow++;
  //     }
  //     currentRow++; // Empty row between categories
  //   }

  //   worksheet.columns.forEach(column => {
  //     column.width = 15;
  //   });

  //   const buffer = await workbook.xlsx.writeBuffer();
  //   return new Blob([buffer], {
  //     type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  //   });
  // }
  async function exportOrderRecToExcel(orderRec: any) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Order Reconciliation');

    let currentRow = 1;

    // 1. Determine if ANY item in the order has a strainName
    const hasStrain = orderRec.categories.some((cat: any) =>
      cat.items.some((item: any) => item.strainName)
    );

    // 2. Build Headers dynamically
    const headers = ['GTIN', 'VIN', 'Item Name'];
    if (hasStrain) headers.push('Strain');
    headers.push('Size', 'On Hand Qty', 'Forecast', 'Min Stock', 'Items To Order', 'Unit In Case', 'Cases To Order');

    const totalCols = headers.length;

    headers.forEach((header, index) => {
      const headerCell = worksheet.getCell(currentRow, index + 1);
      headerCell.value = header;
      headerCell.font = { bold: true };
      headerCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2EFDA' }
      };
    });
    currentRow++;

    for (const category of orderRec.categories) {
      // Add category header
      const categoryCell = worksheet.getCell(currentRow, 1);
      categoryCell.value = `${category.number} | ${category.name}`;
      categoryCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      categoryCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };
      worksheet.mergeCells(currentRow, 1, currentRow, totalCols);
      currentRow++;

      // Add items
      for (const item of category.items) {
        if (Number(item.casesToOrder) === 0) continue;

        const row = worksheet.getRow(currentRow);
        row.height = 22.5;

        // Column 1, 2, 3 are fixed
        row.getCell(1).value = item.gtin;
        row.getCell(2).value = item.vin;
        row.getCell(3).value = item.itemName;

        // 3. Logic to handle the offset if Strain exists
        let colOffset = 0;
        if (hasStrain) {
          row.getCell(4).value = item.strainName || '';
          colOffset = 1; // Shift subsequent columns by 1
        }

        row.getCell(4 + colOffset).value = item.size;
        row.getCell(5 + colOffset).value = item.onHandQty;
        row.getCell(6 + colOffset).value = item.forecast;
        row.getCell(7 + colOffset).value = item.minStock;
        row.getCell(8 + colOffset).value = item.itemsToOrder;
        row.getCell(9 + colOffset).value = item.unitInCase;
        row.getCell(10 + colOffset).value = item.casesToOrder;

        // Formatting
        row.eachCell((cell) => {
          cell.alignment = { vertical: 'middle' };
        });

        row.getCell(1).numFmt = '@';
        row.getCell(2).numFmt = '@';

        // Format numeric columns (from On Hand to Cases To Order)
        for (let i = 5 + colOffset; i <= 10 + colOffset; i++) {
          row.getCell(i).numFmt = '#,##0';
        }

        currentRow++;
      }
      currentRow++;
    }

    worksheet.columns.forEach(column => {
      column.width = 18;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div>{error}</div>
  if (!orderRec) return <div>Not found</div>

  function handleTemplate(): void {
    if (!orderRec) return;

    // Flatten all items from all categories
    const items = orderRec.categories.flatMap((cat: any) =>
      cat.items
        .filter((item: any) => Number(item.casesToOrder) > 0) // <-- Skip if casesToOrder is 0
        .map((item: any) => {
          // Process UPC (GTIN): remove spaces, take substring from index 2, ensure 12 digits
          let upc = (item.gtin ?? "").replace(/\s+/g, "");
          if (upc.length > 12) upc = upc.substring(2);
          if (!/^\d{12}$/.test(upc)) return null; // Only include valid 12-digit UPCs

          return {
            QuantityOrdered: Number(item.casesToOrder) || 1,
            ItemId: item.itemId ?? null,
            IsBc: true,
            Sku: item.sku ?? "",
            Upc: upc,
            Upc2: item.upc2 ?? null
          };
        })
        .filter(Boolean) // Remove nulls (invalid UPCs)
    );

    const orderData = {
      Version: "3.0",
      ModifiedDate: new Date().toISOString(),
      Data: {
        Items: items,
        OrderType: 1,
        PurchaseOrderNo: "",
        Sic1: "",
        Sic2: "",
        Notes: "",
        SeparateInvoice: false
      }
    };

    const blob = new Blob([JSON.stringify(orderData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${orderRec.filename || "order"}.order`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // const access = user?.access || '{}' //markpoint
  const access = user?.access || {};

  const isLocked =
    ["Placed", "Not Placed", "Delivered", "Invoice Received"].includes(
      orderRec?.currentStatus
    );


  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{orderRec.filename}</h1>
        {/* <span className={`px-3 py-1 rounded ${orderRec.completed ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>
          {orderRec.completed ? 'Completed' : 'Incomplete'}
        </span> */}
        <div className="flex gap-2">
          {/* If the order rec vendor is 'CoreMark' then show another button here called 'Template' */}
          {/* {access.component_order_rec_id_delete_button && ( //markpoint */}
          {access?.orderRec?.id?.deleteButton && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              title="Delete Order Rec"
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          )}
          {orderRec.filename?.includes('Core-Mark') && (
            <Button
              variant="outline"
              onClick={handleTemplate}
            >
              Template
            </Button>
          )}
          <Button
            variant="outline"
            disabled={notifying || (!orderRec.completed && user?.email !== orderRec.email)}
            onClick={handleNotify}
          >
            {notifying ? 'Notifying...' : 'Notify'}
          </Button>
          <Button
            variant="outline"
            onClick={handleExport}
          >
            Export
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-6 my-4 text-base">
        <div className="flex items-center gap-2">
          <span className="font-medium">Site:</span>
          <span
            className="text-medium font-large text-gray-800"
          >
            {orderRec?.site}
          </span>
        </div>
        {/* Current Status */}
        <div className="flex items-center gap-2">
          <span className="font-medium">Current Status:</span>
          <span
            className="px-3 py-1 rounded-full text-sm font-medium text-gray-800"
            style={{
              backgroundColor: getOrderRecStatusColor(orderRec?.currentStatus),
            }}
          >
            {orderRec?.currentStatus || "N/A"}
          </span>
        </div>

        {/* Last Updated */}
        {/* <div className="flex items-center gap-2 text-gray-600">
          <span className="font-medium">Last Updated:</span>
          <span>
            {orderRec?.statusHistory?.length
              ? new Date(
                  orderRec.statusHistory[orderRec.statusHistory.length - 1].timestamp
                ).toLocaleString()
              : "N/A"}
          </span>
        </div> */}
      </div>


      <div className="mb-8 max-w-2xl mx-auto">
        {/* <form
          onSubmit={async e => {
            e.preventDefault();
            setSavingNote(true);
            setNoteSuccess(null);
            setNoteError(null);
            try {
              // add authorization header with bearer token
              await axios.patch(`/api/order-rec/${id}`, { extraItemsNote: extraNote }, {
                headers: {
                  Authorization: `Bearer ${localStorage.getItem('token')}`
                }
              });
              setNoteSuccess('Saved!');
              setOrderRec((prev: any) => ({ ...prev, extraItemsNote: extraNote }));
            } catch (err) {
              setNoteError('Failed to save.');
            } finally {
              setSavingNote(false);
            }
          }}
          className="space-y-2"
        > */}

        <form
          onSubmit={async e => {
            e.preventDefault();
            setSavingNote(true);
            setNoteSuccess(null);
            setNoteError(null);

            try {
              // 1️⃣ Update UI immediately
              setOrderRec((prev: any) => ({ ...prev, extraItemsNote: extraNote }));

              // 2️⃣ Create new pending action
              const action = {
                type: "SAVE_EXTRA_NOTE",
                orderId: orderRec.id || orderRec._id,
                note: extraNote,
                timestamp: Date.now(),
              };

              // 3️⃣ Save action to IndexedDB
              await savePendingAction(action);
            } catch (err) {
              console.error("⚠️ Failed to save note", err);
              setNoteError('Failed to save note.');
            } finally {
              setSavingNote(false);
            }
          }}
          className="space-y-2"
        >
          <label className="block text-sm font-medium mb-1">
            Extra Information (if any items are missing or other notes)
          </label>
          <Textarea
            value={extraNote}
            onChange={e => setExtraNote(e.target.value)}
            rows={4}
            className="w-full"
            placeholder="Add any extra info here..."
            disabled={savingNote}
          />
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={savingNote || extraNote === orderRec?.extraItemsNote}>
              {savingNote ? 'Saving...' : 'Save'}
            </Button>
            {noteSuccess && <span className="text-green-600 text-sm">{noteSuccess}</span>}
            {noteError && <span className="text-red-600 text-sm">{noteError}</span>}
          </div>
        </form>
      </div>

      <Accordion type="single" collapsible className="w-full">
        {orderRec.categories.map((cat: any, catIdx: number) => (
          <AccordionItem key={catIdx} value={cat.name}>
            <AccordionTrigger className="w-full flex items-center">
              <span className="flex-1 flex items-center gap-1">
                {cat.name}
                {cat.items.some(
                  (item: any) =>
                    (item.onHandQtyOld !== undefined && item.onHandQty !== item.onHandQtyOld) ||
                    (item.casesToOrderOld !== undefined && item.casesToOrder !== item.casesToOrderOld)
                ) && (
                    <span className="text-red-500 font-bold" title="This group has changed items">*</span>
                  )}
              </span>
              <span
                className={`px-2 py-1 rounded text-xs mr-2 ${cat.completed ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"}`}>
                {cat.completed ? "Completed" : "Incomplete"}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="overflow-x-auto">
                <table className="w-full border mb-2">
                  <thead>
                    <tr>
                      {/* <th className="sticky top-0 bg-white z-10 px-4 py-3">GTIN</th>
                      <th className="sticky top-0 bg-white z-10 px-4 py-3">VIN</th> */}
                      <th className="sticky top-0 bg-white z-10 px-4 py-3">Item</th>
                      {/* DYNAMIC STRAIN HEADER */}
                      {cat.items.some((item: any) => item.strainName) && (
                        <th className="sticky top-0 bg-white z-10 px-4 py-3">Strain</th>
                      )}
                      <th className="sticky top-0 bg-white z-10 px-4 py-3">Size</th>
                      <th className="sticky top-0 bg-white z-10 px-4 py-3">On Hand Qty</th>
                      {cat.name !== "Station Supplies" && (
                        <>
                          <th className="sticky top-0 bg-white z-10 px-4 py-3">Forecast</th>
                          <th className="sticky top-0 bg-white z-10 px-4 py-3">Min Stock</th>
                          <th className="sticky top-0 bg-white z-10 px-4 py-3">Items To Order</th>
                          <th className="sticky top-0 bg-white z-10 px-4 py-3">Unit In Case</th>
                        </>
                      )}
                      <th className="sticky top-0 bg-white z-10 px-4 py-3">Cases To Order</th>
                      <th className="sticky top-0 bg-white z-10 px-4 py-3 text-center">
                        <span
                          role="checkbox"
                          aria-checked={
                            cat.items.every((item: any) => item.completed)
                              ? 'true'
                              : cat.items.some((item: any) => item.completed)
                                ? 'mixed'
                                : 'false'
                          }
                          tabIndex={0}
                          // className="cursor-pointer flex justify-center items-center"
                          className={`cursor-pointer flex justify-center items-center ${isLocked ? "opacity-50 cursor-not-allowed" : ""
                            }`}
                          onClick={async e => {
                            e.stopPropagation();
                            if (isLocked) {
                              alert("This order has already been placed and cannot be edited.");
                              return;
                            }
                            const newCompleted = !cat.items.every((item: any) => item.completed);
                            for (let itemIdx = 0; itemIdx < cat.items.length; itemIdx++) {
                              if (cat.items[itemIdx].completed !== newCompleted) {
                                await handleToggleItemCompleted(catIdx, itemIdx, newCompleted, isChanged(cat.items[itemIdx]));
                              }
                            }
                          }}
                        >
                          {cat.items.every((item: any) => item.completed) ? (
                            <CheckSquare size={28} className="text-green-600" />
                          ) : cat.items.some((item: any) => item.completed) ? (
                            <MinusSquare size={28} className="text-yellow-500" />
                          ) : (
                            <Square size={28} className="text-gray-400" />
                          )}
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {cat.items.map((item: any, itemIdx: number) => (
                      <tr
                        key={itemIdx}
                        className="cursor-pointer hover:bg-gray-100 transition-all"
                        onClick={() => handleRowClick(catIdx, itemIdx, item.completed)}
                        style={{ height: '56px' }}
                      >
                        {/* <td className="px-4 py-3">{item.gtin}</td>
                        <td className="px-4 py-3">{item.vin}</td> */}
                        <td className="px-4 py-3 flex flex-col">
                          <span>{item.gtin}</span>
                          <span>{item.vin}</span>
                          <span className='font-bold'>{item.itemName}</span>
                        </td>
                        {/* DYNAMIC STRAIN CELL */}
                        {cat.items.some((i: any) => i.strainName) && (
                          <td className="px-4 py-3 italic text-blue-600">
                            {item.strainName || "-"}
                          </td>
                        )}
                        <td className="px-4 py-3 text-center">{item.size}</td>
                        <td className="px-4 py-3 text-center bg-cyan-100">
                          {item.onHandQtyOld !== undefined && item.onHandQty !== item.onHandQtyOld ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="px-3 py-1 bg-gray-800 text-white rounded-lg cursor-pointer shadow-sm hover:bg-gray-700 text-center">
                                    <b>{item.onHandQty}</b>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Previous: {item.onHandQtyOld}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            item.onHandQty
                          )}
                        </td>
                        {cat.name !== "Station Supplies" && (
                          <>
                            <td className="px-4 py-3 text-center">{item.forecast}</td>
                            <td className="px-4 py-3 text-center">{item.minStock}</td>
                            <td className="px-4 py-3 text-center bg-cyan-100">{item.itemsToOrder}</td>
                            <td className="px-4 py-3 text-center">{item.unitInCase}</td>
                          </>
                        )}
                        <td className="px-4 py-3 text-center bg-cyan-100">
                          {item.casesToOrderOld !== undefined && item.casesToOrder !== item.casesToOrderOld ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="px-3 py-1 bg-gray-800 text-white rounded-lg cursor-pointer shadow-sm hover:bg-gray-700 text-center">
                                    <b>{item.casesToOrder}</b>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Previous: {item.casesToOrderOld}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            item.casesToOrder
                          )}
                        </td>
                        <td>
                          <span
                            role="checkbox"
                            aria-checked={item.completed ? 'true' : 'false'}
                            tabIndex={0}
                            // className="cursor-pointer flex justify-center items-center"
                            className={`cursor-pointer flex justify-center items-center ${isLocked ? "opacity-50 cursor-not-allowed" : ""
                              }`}
                            onClick={e => {
                              e.stopPropagation();
                              if (isLocked) {
                                alert("This order has already been placed and cannot be edited.");
                                return;
                              }
                              handleToggleItemCompleted(catIdx, itemIdx, !item.completed, isChanged(item));
                            }}
                          >
                            {item.completed ? (
                              <CheckSquare size={24} className="text-green-600" />
                            ) : (
                              <Square size={24} className="text-gray-400" />
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      {/* Modal for editing item */}
      <Dialog open={!!editItem} onOpenChange={(open: boolean) => !open && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-center">
              {editItem
                ? orderRec.categories[editItem.catIdx].items[editItem.itemIdx].itemName
                : 'Edit Item'}
            </DialogTitle>
          </DialogHeader>

          {editItem && (() => {
            const { catIdx, itemIdx } = editItem
            const item = orderRec.categories[catIdx].items[itemIdx]
            const category = orderRec.categories[catIdx] // ✅ get current category
            const isFirst = itemIdx === 0
            const isLast = itemIdx === orderRec.categories[catIdx].items.length - 1

            // ✅ Hide specific fields only if category.name is "Station Supplies"
            const visibleFields =
              category.name === "Station Supplies"
                ? ['onHandQty', 'casesToOrder']
                : ['onHandQty', 'forecast', 'minStock', 'itemsToOrder', 'unitInCase', 'casesToOrder']

            return (
              // <form
              //   onSubmit={async e => {
              //     e.preventDefault()
              //     try {
              //       await axios.put(`/api/order-rec/${id}`, {
              //         categories: orderRec.categories
              //       }, {
              //         headers: {
              //           Authorization: `Bearer ${localStorage.getItem('token')}`
              //         }
              //       })
              //       setEditItem(null)
              //     } catch (err) {
              //       setError('Failed to save changes')
              //     }
              //   }}
              //   className="space-y-4"
              // >
              <form
                onSubmit={async (e: React.FormEvent) => {
                  e.preventDefault();
                  if (!orderRec) return;

                  const orderId = orderRec.id || orderRec._id;
                  if (!orderId) {
                    setError("Cannot save — missing order ID");
                    return;
                  }

                  const updatedRec = { ...orderRec };
                  const action = {
                    type: "UPDATE_ORDER_REC",
                    id: orderId,
                    payload: { categories: updatedRec.categories },
                    timestamp: Date.now(),
                  };

                  // 1️⃣ Update UI immediately
                  setEditItem(null);
                  setOrderRec(updatedRec);

                  // 2️⃣ Save locally
                  await saveOrderRec(updatedRec);

                  // 3️⃣ Queue action for sync
                  await savePendingAction(action);
                }}
                className="space-y-4"
              >
                {visibleFields.map(field => (
                  <div key={field} className="flex flex-col items-center gap-1">
                    <label className="block text-sm font-medium text-center">{camelCaseToTitleCase(field)}</label>
                    {['onHandQty', 'casesToOrder'].includes(field) ? (
                      <div className="flex items-center gap-2 justify-center">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          tabIndex={-1}
                          onClick={() => handleChange(catIdx, itemIdx, field, Number(item[field]) - 1)}
                        >
                          <Minus size={16} />
                        </Button>
                        <Input
                          type="number"
                          value={item[field]}
                          onChange={e => handleChange(catIdx, itemIdx, field, Number(e.target.value))}
                          onFocus={e => e.target.select()}
                          className="w-24 text-center text-gray-900 font-semibold disabled:text-gray-900"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          tabIndex={-1}
                          onClick={() => handleChange(catIdx, itemIdx, field, Number(item[field]) + 1)}
                        >
                          <Plus size={16} />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <Input
                          type="number"
                          value={item[field]}
                          onChange={e => handleChange(catIdx, itemIdx, field, Number(e.target.value))}
                          onFocus={e => e.target.select()}
                          className="w-24 text-center text-gray-900 font-semibold disabled:text-gray-900"
                          disabled
                        />
                      </div>
                    )}
                  </div>
                ))}

                <div className="flex justify-between gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isFirst}
                    onClick={() => {
                      if (!isFirst) setEditItem({ catIdx, itemIdx: itemIdx - 1 })
                    }}
                  >
                    Back
                  </Button>
                  <Button type="submit">Save</Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isLast}
                    onClick={() => {
                      if (!isLast) setEditItem({ catIdx, itemIdx: itemIdx + 1 })
                    }}
                  >
                    Next
                  </Button>
                </div>
              </form>
            )
          })()}
        </DialogContent>
      </Dialog>

    </div>
  )
}