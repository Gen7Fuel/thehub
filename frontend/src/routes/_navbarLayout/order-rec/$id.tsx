import { createFileRoute } from '@tanstack/react-router'
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
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute('/_navbarLayout/order-rec/$id')({
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()

  const [orderRec, setOrderRec] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<{catIdx: number, itemIdx: number} | null>(null)
  const [notifying, setNotifying] = useState<boolean>(false)

  const [extraNote, setExtraNote] = useState(orderRec?.extraItemsNote || '');
  const [savingNote, setSavingNote] = useState(false);
  const [noteSuccess, setNoteSuccess] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [switchLoading, setSwitchLoading] = useState(false);

  // Keep textarea in sync if orderRec changes
  useEffect(() => {
    setExtraNote(orderRec?.extraItemsNote || '');
  }, [orderRec]);

  useEffect(() => {
    const fetchOrderRec = async () => {
      try {
        const res = await axios.get(`/api/order-rec/${id}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        })
        setOrderRec(res.data)
      } catch (err) {
        setError('Failed to fetch order rec')
      } finally {
        setLoading(false)
      }
    }
    fetchOrderRec()
  }, [id])

  const handleSwitchChange = async (field: "orderPlaced" | "delivered", value: boolean) => {
    setSwitchLoading(true);
    console.log("Fetching with:", field, value)
    try {
      await axios.put(`/api/order-rec/${id}`, { [field]: value }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      setOrderRec((prev: any) => ({ ...prev, [field]: value }));
    } catch (err) {
      alert("Failed to update status.");
    }
    setSwitchLoading(false);
  };

  const handleDelete = async () => {
    const confirmed = window.confirm("Are you sure you want to delete this order rec? This action cannot be undone.");
    if (!confirmed) return;
    try {
      await axios.delete(`/api/order-rec/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      // Redirect to the list page after deletion
      window.location.href = "/order-rec/list";
    } catch (err) {
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
    const userEmail = localStorage.getItem('email');
    // If the uploader is the current user, notify the store only (do NOT mark as completed)
    if (userEmail === orderRec.email) {
      const confirmed = window.confirm(
        "Are you sure you want to notify the store that a new order rec has been uploaded?"
      );
      if (!confirmed) return;

      try {
        // Get the site value from the order rec
        const site = orderRec.site;

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

        // Prepare subject and body (same as index.tsx)
        const subject = `Order Rec Uploaded for ${site}`;
        const html = `
          A new order rec has been uploaded for ${site}.
          Please log in to The Hub to review the order recommendation.
        `;

        // Send the email
        await axios.post("/api/send-email", {
          to: storeEmail,
          cc: ["grayson@gen7fuel.com", "mohammad@gen7fuel.com", userEmail],
          subject,
          text: html,
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

    // Default notify logic for other users (mark as completed and notify)
    const confirmed = window.confirm('Are you sure you want to notify that this order rec has been reconciled?');
    if (!confirmed) return;

    setNotifying(true);
    try {
      await axios.post('/api/send-email', {
        to: orderRec.email,
        cc: ['grayson@gen7fuel.com', 'mohammad@gen7fuel.com'],
        subject: 'Order Reconciliation Completed',
        text: `Order reconciliation file "${orderRec.filename}" has been reconciled from site "${orderRec.site}".`,
        isHtml: false
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

  // Toggle item completion
  const handleToggleItemCompleted = async (catIdx: number, itemIdx: number, completed: boolean) => {
    try {
      console.log(`Toggling completion for item at catIdx ${catIdx}, itemIdx ${itemIdx} to ${completed}`);
      // add authorization header with bearer token
      const res = await axios.put(`/api/order-rec/${id}/item/${catIdx}/${itemIdx}`, { completed }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      console.log('Update response:', res.data);
      setOrderRec(res.data);
    } catch (err) {
      alert('Failed to update completion status.');
    }
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

  async function exportOrderRecToExcel(orderRec: any) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Order Reconciliation');

    let currentRow = 1;

    // Add column headers
    const headers = [
      'GTIN', 'VIN', 'Item Name', 'Size', 'On Hand Qty', 'Forecast', 'Min Stock',
      'Items To Order', 'Unit In Case', 'Cases To Order'
    ];
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
      worksheet.mergeCells(currentRow, 1, currentRow, 10);
      currentRow++;

      // Add items
      for (const item of category.items) {
        if (Number(item.casesToOrder) === 0) continue; // <-- Skip if casesToOrder is 0
        const row = worksheet.getRow(currentRow);
        row.height = 22.5;
        row.getCell(1).value = item.gtin;
        row.getCell(2).value = item.vin;
        row.getCell(3).value = item.itemName;
        row.getCell(4).value = item.size;
        row.getCell(5).value = item.onHandQty;
        row.getCell(6).value = item.forecast;
        row.getCell(7).value = item.minStock;
        row.getCell(8).value = item.itemsToOrder;
        row.getCell(9).value = item.unitInCase;
        row.getCell(10).value = item.casesToOrder;

        for (let colIndex = 1; colIndex <= 10; colIndex++) {
          row.getCell(colIndex).alignment = { vertical: 'middle' };
        }
        row.getCell(1).numFmt = '@';
        row.getCell(2).numFmt = '@';
        for (let colIndex = 5; colIndex <= 10; colIndex++) {
          row.getCell(colIndex).numFmt = '#,##0';
        }
        currentRow++;
      }
      currentRow++; // Empty row between categories
    }

    worksheet.columns.forEach(column => {
      column.width = 15;
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

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{orderRec.filename}</h1>
        <span className={`px-3 py-1 rounded ${orderRec.completed ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>
          {orderRec.completed ? 'Completed' : 'Incomplete'}
        </span>
        <div className="flex gap-2">
        {/* If the order rec vendor is 'CoreMark' then show another button here called 'Template' */}
        <Button
          variant="destructive"
          onClick={handleDelete}
          title="Delete Order Rec"
        >
          <Trash2 className="w-5 h-5" />
        </Button>
        {orderRec.filename?.includes('CoreMark') && (
          <Button
            variant="outline"
            onClick={handleTemplate}
          >
            Template
          </Button>
        )}
          <Button
            variant="outline"
            disabled={ notifying || (!orderRec.completed && localStorage.getItem('email') !== orderRec.email)}
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

      <div className="flex gap-8 items-center my-4">
        <div className="flex items-center gap-2">
          <Switch
            checked={!!orderRec?.orderPlaced}
            disabled={switchLoading}
            onCheckedChange={(val:boolean) => handleSwitchChange("orderPlaced", val)}
            id="orderPlaced-switch"
            className="data-[state=checked]:bg-green-500 relative"
          />
          <label htmlFor="orderPlaced-switch" className="text-sm">Order Placed</label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={!!orderRec?.delivered}
            disabled={switchLoading}
            onCheckedChange={(val:boolean) => handleSwitchChange("delivered", val)}
            id="delivered-switch"
            className="data-[state=checked]:bg-green-500 relative"
          />
          <label htmlFor="delivered-switch" className="text-sm">Delivered</label>
        </div>
      </div>

      <div className="mb-8 max-w-2xl mx-auto">
        <form
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
                      <th className="sticky top-0 bg-white z-10 px-4 py-3">Size</th>
                      <th className="sticky top-0 bg-white z-10 px-4 py-3">On Hand Qty</th>
                      <th className="sticky top-0 bg-white z-10 px-4 py-3">Forecast</th>
                      <th className="sticky top-0 bg-white z-10 px-4 py-3">Min Stock</th>
                      <th className="sticky top-0 bg-white z-10 px-4 py-3">Items To Order</th>
                      <th className="sticky top-0 bg-white z-10 px-4 py-3">Unit In Case</th>
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
                          className="cursor-pointer flex justify-center items-center"
                          onClick={async e => {
                            e.stopPropagation();
                            const newCompleted = !cat.items.every((item: any) => item.completed);
                            for (let itemIdx = 0; itemIdx < cat.items.length; itemIdx++) {
                              if (cat.items[itemIdx].completed !== newCompleted) {
                                await handleToggleItemCompleted(catIdx, itemIdx, newCompleted);
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
                        onClick={() => setEditItem({ catIdx, itemIdx })}
                        style={{ height: '56px' }}
                      >
                        {/* <td className="px-4 py-3">{item.gtin}</td>
                        <td className="px-4 py-3">{item.vin}</td> */}
                        <td className="px-4 py-3 flex flex-col">
                          <span>{item.gtin}</span>
                          <span>{item.vin}</span>
                          <span>{item.itemName}</span>
                        </td>
                        <td className="px-4 py-3 text-center">{item.size}</td>
                        <td className="px-4 py-3 text-center">
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
                        <td className="px-4 py-3 text-center">{item.forecast}</td>
                        <td className="px-4 py-3 text-center">{item.minStock}</td>
                        <td className="px-4 py-3 text-center">{item.itemsToOrder}</td>
                        <td className="px-4 py-3 text-center">{item.unitInCase}</td>
                        <td className="px-4 py-3 text-center"> 
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
                            className="cursor-pointer flex justify-center items-center"
                            onClick={e => {
                              e.stopPropagation();
                              handleToggleItemCompleted(catIdx, itemIdx, !item.completed);
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
      <Dialog open={!!editItem} onOpenChange={(open:boolean) => !open && setEditItem(null)}>
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
            const isFirst = itemIdx === 0
            const isLast = itemIdx === orderRec.categories[catIdx].items.length - 1

            return (
              <form
                onSubmit={async e => {
                  e.preventDefault()
                  try {
                    // add authorization header with bearer token
                    await axios.put(`/api/order-rec/${id}`, {
                      categories: orderRec.categories
                    }, {
                      headers: {
                        Authorization: `Bearer ${localStorage.getItem('token')}`
                      }
                    })
                    setEditItem(null)
                  } catch (err) {
                    setError('Failed to save changes')
                  }
                }}
                className="space-y-4"
              >
                {['onHandQty', 'forecast', 'minStock', 'itemsToOrder', 'unitInCase', 'casesToOrder'].map(field => (
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
                  <Button type="submit">
                    Save
                  </Button>
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