// import { useState } from 'react';
// import { createFileRoute } from '@tanstack/react-router';
// import { ChevronLeft, Inbox } from 'lucide-react';
// import { Button } from "@/components/ui/button"; // Assuming shadcn/ui

// export const Route = createFileRoute('/_navbarLayout/notification')({
//   component: NotificationPage,
// });

// interface Notification {
//   id: string;
//   subject: string;
//   preview: string;
//   time: string;
//   read: boolean;
// }

// function NotificationPage() {
//   const [selectedId, setSelectedId] = useState<Notification['id'] | null>(null);

//   // Mock Data - We will replace this with your API call later
//   const notifications = [
//     { id: '1', subject: '⚠️ Issue Raised for Site 102', preview: 'An issue has been raised...', time: '2h ago', read: false },
//     { id: '2', subject: '✅ Audit Completed', preview: 'Station 105 audit is now...', time: '5h ago', read: true },
//   ];

//   const selectedNotif = notifications.find(n => n.id === selectedId);

//   return (
//     <div className="flex h-[calc(100vh-65px)] overflow-hidden bg-white">
//       {/* LEFT SIDE: List (Hidden on mobile if a notification is open) */}
//       <div className={`${selectedId ? 'hidden md:flex' : 'flex'} w-full md:w-1/3 flex-col border-r border-gray-200`}>
//         <div className="p-4 border-b flex justify-between items-center bg-gray-50/50">
//           <h2 className="text-xl font-bold">Notifications</h2>
//         </div>

//         <div className="flex-1 overflow-y-auto">
//           {notifications.length === 0 ? (
//             <div className="flex flex-col items-center justify-center h-full text-gray-400">
//               <Inbox className="h-12 w-12 mb-2" />
//               <p>No notifications yet</p>
//             </div>
//           ) : (
//             notifications.map((n) => (
//               <div
//                 key={n.id}
//                 onClick={() => setSelectedId(n.id)}
//                 className={`p-4 border-b cursor-pointer transition-colors hover:bg-blue-50/50 ${
//                   selectedId === n.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
//                 } ${!n.read ? 'bg-white font-semibold' : 'bg-white opacity-70'}`}
//               >
//                 <div className="flex justify-between text-xs mb-1">
//                   <span className={!n.read ? 'text-blue-600' : 'text-gray-500'}>{n.time}</span>
//                   {!n.read && <span className="h-2 w-2 bg-blue-600 rounded-full"></span>}
//                 </div>
//                 <h4 className="text-sm truncate">{n.subject}</h4>
//                 <p className="text-xs text-gray-500 truncate">{n.preview}</p>
//               </div>
//             ))
//           )}
//         </div>
//       </div>

//       {/* RIGHT SIDE: Detail View (Full screen on mobile if open) */}
//       <div className={`${!selectedId ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-gray-50`}>
//         {selectedId ? (
//           <div className="flex flex-col h-full">
//             {/* Mobile Back Button */}
//             <div className="md:hidden p-2 bg-white border-b">
//               <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
//                 <ChevronLeft className="h-4 w-4 mr-1" /> Back
//               </Button>
//             </div>

//             <div className="flex-1 overflow-y-auto p-4 md:p-8">
//               <div className="max-w-3xl mx-auto bg-white shadow-sm border rounded-xl overflow-hidden">
//                 {/* Here we will inject the HTML from your template */}
//                 <div className="p-6 border-b bg-gray-50">
//                    <h1 className="text-2xl font-bold text-gray-800">{selectedNotif?.subject}</h1>
//                 </div>
//                 <div className="p-6">
//                    {/* This is a placeholder for the rendered HTML Template Instance */}
//                    <p className="text-gray-600">Loading notification content...</p>
//                 </div>
//               </div>
//             </div>
//           </div>
//         ) : (
//           <div className="hidden md:flex flex-col items-center justify-center h-full text-gray-400">
//             <p>Select a notification to view details</p>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }
import { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ChevronLeft, Inbox, Bell } from 'lucide-react';
import { Button } from "@/components/ui/button";
import axios from 'axios';

export const Route = createFileRoute('/_navbarLayout/notification')({
  component: NotificationPage,
});

function NotificationPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedNotif, setSelectedNotif] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 1. Fetch Inbox List
  useEffect(() => {
    const fetchList = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('/api/notification', {
          headers: { Authorization: `Bearer ${token || ''}` }
        });
        setNotifications(res.data);
      } catch (err) {
        console.error("Error fetching notifications", err);
      } finally {
        setLoading(false);
      }
    };
    fetchList();
  }, []);

  // Inside NotificationPage.tsx -> useEffect for [selectedId]
  useEffect(() => {
    if (selectedId) {
      const token = localStorage.getItem('token');

      // Check if the item in our list is currently unread before we fetch
      const currentNotif = notifications.find(n => n._id === selectedId);
      const wasUnread = currentNotif && !currentNotif.isRead;

      axios.get(`/api/notification/${selectedId}`, {
        headers: { Authorization: `Bearer ${token || ''}` }
      })
        .then(res => {
          setSelectedNotif(res.data);

          if (wasUnread) {
            // 1. Update local list state
            setNotifications(prev =>
              prev.map(n => n._id === selectedId ? { ...n, isRead: true } : n)
            );

            // 2. Broadcast to Navbar to decrease count
            window.dispatchEvent(new Event('notificationRead'));
          }
        })
        .catch(err => console.error(err));
    }
  }, [selectedId]);
  // Master Styling Effect for Dynamic HTML
  // useEffect(() => {
  //   if (!selectedNotif) return;

  //   const styleNotifications = () => {
  //     console.log("Applying dynamic styles for slug:", selectedNotif.slug);

  //     // --- CASE 1: Write-Off Finalized (Bistro Styling) ---
  //     if (selectedNotif.slug === 'write-off-finalized') {
  //       const container = document.querySelector('[data-listtype]');
  //       const listType = container?.getAttribute('data-listtype');

  //       if (listType === 'BT' && container) {
  //         const header = container.querySelector('[id^="header-"]') as HTMLElement;
  //         const csoCell = container.querySelector('[id^="cso-cell-"]') as HTMLElement;
  //         const hubCell = container.querySelector('[id^="hub-cell-"]') as HTMLElement;
  //         const hubBtn = hubCell?.querySelector('a') as HTMLElement;

  //         if (header) header.style.setProperty('background-color', '#e67e22', 'important');
  //         if (csoCell) csoCell.style.display = 'none';
  //         if (hubCell) hubCell.style.width = '100%';
  //         if (hubBtn) {
  //           hubBtn.style.setProperty('background-color', '#e67e22', 'important');
  //           hubBtn.innerText = '🍔 View Approved Bistro List';
  //         }
  //       }
  //     }

  //     // --- CASE 2: Write-Off Generated (Hide empty button cells) ---
  //     if (selectedNotif.slug === 'write-off-generated') {
  //       // Find all cells ending in -cell-gen
  //       const btnCells = document.querySelectorAll('[id$="-cell-gen"]');

  //       btnCells.forEach((cell: any) => {
  //         const link = cell.querySelector('a');
  //         const href = link?.getAttribute('href') || "";

  //         // If the ID is missing (ends in /) or is literally the word "null"
  //         if (href.endsWith('/undefined') || href.endsWith('/null') || href.endsWith('/')) {
  //           cell.style.display = 'none';
  //         } else {
  //           cell.style.display = 'table-cell';
  //         }
  //       });
  //     }
  //   };

  //   // Run twice to ensure the DOM is painted
  //   styleNotifications();
  //   const timer = setTimeout(styleNotifications, 150);

  //   return () => clearTimeout(timer);
  // }, [selectedNotif]);

  // 3. Effect to handle dynamic time conversion in rendered HTML
  useEffect(() => {
    if (selectedNotif) {
      // Small delay to ensure the DOM is painted by React
      const timer = setTimeout(() => {
        const elements = document.querySelectorAll('.local-time');
        elements.forEach((el: any) => {
          const utcStr = el.getAttribute('data-utc');
          if (utcStr && utcStr !== 'undefined') {
            try {
              const localTime = new Date(utcStr).toLocaleString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short'
              });
              el.innerText = localTime;
            } catch (e) {
              console.error("Date conversion failed", e);
            }
          }
        });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [selectedNotif]);



  return (
    <div className="flex h-[calc(100vh-65px)] overflow-hidden bg-white">
      {/* LEFT SIDE: List */}
      <div className={`${selectedId ? 'hidden md:flex' : 'flex'} w-full md:w-1/3 flex-col border-r border-gray-200`}>
        <div className="p-4 border-b flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-bold">Notification Center</h2>
          </div>
          <span className="text-xs bg-gray-200 px-2 py-1 rounded-full text-gray-600 font-medium">
            {notifications.filter(n => !n.isRead).length} Unread
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-10 text-center text-gray-400 italic">Syncing notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Inbox className="h-12 w-12 mb-2 opacity-20" />
              <p>You have no new notifications</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n._id}
                onClick={() => setSelectedId(n._id)}
                className={`p-4 border-b cursor-pointer transition-all hover:bg-slate-50 relative ${selectedId === n._id ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'bg-white'
                  }`}
              >
                <div className="flex justify-between text-[10px] mb-1 uppercase tracking-wider text-gray-400">
                  <span>{new Date(n.createdAt).toLocaleDateString()}</span>
                  {/* NEW LOGIC: Use isRead boolean */}
                  {!n.isRead && <span className="h-2 w-2 bg-blue-600 rounded-full animate-pulse"></span>}
                </div>

                {/* NEW LOGIC: Bold text if not read */}
                <h4 className={`text-sm truncate ${!n.isRead ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
                  {n.subject}
                </h4>
                <div className="text-[10px] mt-1 text-blue-500 font-medium uppercase">
                  {n.notificationType}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT SIDE: Detail View */}
      <div className={`${!selectedId ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-gray-50`}>
        {selectedId ? (
          <div className="flex flex-col h-full">
            <div className="md:hidden p-2 bg-white border-b">
              <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Notification Center
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8">
              {selectedNotif ? (
                <div className="max-w-3xl mx-auto">
                  <div className="mb-6 flex justify-between items-start">
                    <div>
                      <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">
                        {selectedNotif.subject}
                      </h1>
                      <p className="text-sm text-gray-500 mt-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        From: {selectedNotif.senderId ? "Administrator" : "Hub System"}
                        • {new Date(selectedNotif.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white shadow-md border border-gray-200 rounded-xl overflow-hidden">
                    {/* Rendered HTML */}
                    <div
                      className="p-1 prose prose-blue max-w-none"
                      dangerouslySetInnerHTML={{ __html: selectedNotif.html }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 animate-pulse">
                  <p>Loading secure content...</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="hidden md:flex flex-col items-center justify-center h-full text-gray-400">
            <Inbox className="h-16 w-16 mb-4 opacity-10" />
            <p className="text-lg font-medium">Select a message to view details</p>
            <p className="text-sm">Manage your station alerts and system updates here.</p>
          </div>
        )}
      </div>
    </div>
  );
}