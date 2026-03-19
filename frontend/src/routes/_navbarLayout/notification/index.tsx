import { useState, useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ChevronLeft, Inbox, Bell, PlusCircle, LayoutTemplate, Send, Info } from 'lucide-react';
import { Button } from "@/components/ui/button";
import axios from 'axios';
import { getSocket } from '@/lib/websocket';
import { useAuth } from '@/context/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export const Route = createFileRoute('/_navbarLayout/notification/')({
  component: NotificationPage,
});

function NotificationPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const access = user?.access || {};

  const [view, setView] = useState<'inbox' | 'sent'>('inbox');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedNotif, setSelectedNotif] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 1. Fetch List (Depends on View)
  const fetchList = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const endpoint = view === 'inbox' ? '/api/notification' : '/api/notification/sent';
      const res = await axios.get(endpoint, {
        headers: {
          Authorization: `Bearer ${token || ''}`,
          'X-Required-Permission': 'notification'
        }
      });
      setNotifications(res.data);
    } catch (err: any) {
      console.error("Error fetching list", err);
      // FIX: Check the error response status here
      if (err.response && err.response.status === 403) {
        navigate({ to: '/no-access' });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    setSelectedId(null);
    setSelectedNotif(null);
  }, [view]);

  // Socket Integration
  useEffect(() => {
    if (view !== 'inbox') return;
    const socket = getSocket();
    const handleNew = (data: any) => {
      if (data?.notification) {
        setNotifications(prev => {
          const exists = prev.find(n => n._id === data.notification._id);
          if (exists) return prev;
          return [data.notification, ...prev];
        });
      }
    };
    socket.on("new-notification", handleNew);
    return () => { socket.off("new-notification", handleNew); };
  }, [view]);

  // Handle Selection & Fetch Detail
  useEffect(() => {
    if (selectedId) {
      const token = localStorage.getItem('token');
      const currentNotif = notifications.find(n => n._id === selectedId);

      // Fix: Only trigger 'notificationRead' if we are in INBOX and item is unread
      const wasUnread = view === 'inbox' && currentNotif && !currentNotif.isRead;

      axios.get(`/api/notification/${selectedId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => {
          setSelectedNotif(res.data);
          if (wasUnread) {
            setNotifications(prev =>
              prev.map(n => n._id === selectedId ? { ...n, isRead: true } : n)
            );
            window.dispatchEvent(new Event('notificationRead'));
          }
        })
        .catch(err => {
          console.error("Error fetching detail", err);
          setSelectedNotif(null);
        });
    }
  }, [selectedId, view]);

  return (
    <div className="flex h-[calc(100vh-65px)] overflow-hidden bg-white">
      {/* LEFT SIDE: List */}
      <div className={`${selectedId ? 'hidden md:flex' : 'flex'} w-full md:w-1/3 flex-col border-r border-gray-200`}>

        {/* Header Section */}
        <div className="p-4 border-b bg-gray-50/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-600" />
              <h2 className="text-xl font-bold tracking-tight">Notification Center</h2>

              {/* Policy Info Dialog */}
              <Dialog>
                <DialogTrigger asChild>
                  <button className="text-gray-400 hover:text-blue-600 transition-colors">
                    <Info className="h-4 w-4" />
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5 text-blue-600" />
                      Notification Policy
                    </DialogTitle>
                  </DialogHeader>
                  <div className="py-4 space-y-4 text-sm text-gray-600 leading-relaxed">
                    <div className="flex gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <div className="h-2 w-2 mt-1.5 rounded-full bg-blue-600 shrink-0" />
                      <p>
                        <strong>Auto-Archive:</strong> Notifications that have been read by all recipients are automatically moved to archives after <strong>8 days</strong>.
                      </p>
                    </div>
                    <div className="flex gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                      <div className="h-2 w-2 mt-1.5 rounded-full bg-amber-600 shrink-0" />
                      <p>
                        <strong>Permanent Removal:</strong> To keep your workspace clean, all notifications (including unread and archived) are permanently deleted after <strong>30 days</strong>.
                      </p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            {/* Find this line in your Header Section */}
            {view === 'inbox' && (
              <span className="text-xs bg-blue-100 px-2 py-1 rounded-full text-blue-600 font-bold">
                {notifications.filter(n => !n.isRead && n.status !== 'archived').length} Unread
              </span>
            )}
          </div>

          {/* Admin Actions Group */}
          {access?.notification?.create?.value && (
            <>
              <div className="flex gap-2 mb-4">
                <Button size="sm" variant="outline" className="flex-1 gap-1 text-[11px] h-8" onClick={() => navigate({ to: '/notification/create' })}>
                  <PlusCircle className="h-3.5 w-3.5" /> Notification
                </Button>
                {access?.notification?.template && (
                  <Button size="sm" variant="outline" className="flex-1 gap-1 text-[11px] h-8" onClick={() => navigate({ to: '/notification/template' })}>
                    <LayoutTemplate className="h-3.5 w-3.5" /> Template
                  </Button>
                )}
              </div>

              <div className="flex bg-gray-200/50 p-1 rounded-lg">
                <button
                  onClick={() => setView('inbox')}
                  className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-semibold rounded-md transition-all ${view === 'inbox' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Inbox className="h-3.5 w-3.5" /> Inbox
                </button>
                <button
                  onClick={() => setView('sent')}
                  className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-semibold rounded-md transition-all ${view === 'sent' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Send className="h-3.5 w-3.5" /> Sent
                </button>
              </div>
            </>
          )}
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-10 text-center text-gray-400 italic text-sm">Syncing...</div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-40">
              <Inbox className="h-12 w-12 mb-2" />
              <p className="text-sm font-medium">No {view} found</p>
            </div>
          ) : (
            notifications
              .filter((n) => n.status !== 'archived')
              .map((n) => (
                <div
                  key={n._id}
                  onClick={() => setSelectedId(n._id)}
                  className={`p-4 border-b cursor-pointer transition-all hover:bg-slate-50 relative ${selectedId === n._id ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'bg-white'}`}
                >
                  <div className="flex justify-between text-[10px] mb-1 uppercase tracking-wider text-gray-400">
                    <span>{new Date(n.createdAt).toLocaleString()}</span>
                    {view === 'inbox' && !n.isRead && <span className="h-2 w-2 bg-blue-600 rounded-full animate-pulse"></span>}
                    {view === 'sent' && <span className="text-blue-500 font-bold">{n.recipientCount || 0} Sent</span>}
                  </div>
                  <h4 className={`text-sm truncate ${view === 'inbox' && !n.isRead ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
                    {n.subject}
                  </h4>
                  <div className="text-[10px] mt-1 text-gray-400 font-medium uppercase truncate">
                    {view === 'sent' ? (
                      // Show notification type in Sent folder
                      <span>Type: {n.notificationType}</span>
                    ) : (
                      // Show conditional logic in Inbox
                      n.notificationType === 'system' ? (
                        <span className="flex items-center gap-1">System Generated</span>
                      ) : (
                        <span className="text-blue-600 lowercase">
                          <strong className="uppercase text-[9px] mr-1">From:</strong>
                          <span className="capitalize">
                            {n.senderId?.firstName} {n.senderId?.lastName}
                          </span>
                          <span className="text-gray-400 ml-1">[{n.senderId?.email}]</span>
                        </span>
                      )
                    )}
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
            {/* Back Button for Mobile */}
            <div className="md:hidden p-2 bg-white border-b">
              <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back to {view.toLocaleUpperCase()}
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8">
              {selectedNotif ? (
                <div className="max-w-3xl mx-auto w-full">
                  <div className="mb-6 flex justify-between items-start">
                    <div>
                      <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">
                        {selectedNotif.subject}
                      </h1>
                      {/* ... inside the detail view ... */}
                      <p className="text-sm text-gray-500 mt-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        {view === 'inbox' ? (
                          selectedNotif.notificationType === 'system' ? (
                            "From: System Generated"
                          ) : (
                            <span>
                              From: <strong className="capitalize">{selectedNotif.senderId?.firstName} {selectedNotif.senderId?.lastName}</strong>
                              <span className="ml-1 text-xs">[{selectedNotif.senderId?.email}]</span>
                            </span>
                          )
                        ) : (
                          <span className="flex items-center gap-1">
                            To: <RecipientListDialog recipients={selectedNotif.recipientIds} />
                          </span>
                        )}
                        {' • '}{new Date(selectedNotif.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white shadow-md border border-gray-200 rounded-xl overflow-hidden">
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
            <p className="text-lg font-medium">Select a message from your {view}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function RecipientListDialog({ recipients }: { recipients: any[] }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <span className="text-blue-600 underline cursor-pointer hover:text-blue-800 transition-colors">
          {recipients?.length || 0} Recipients
        </span>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Recipient List</DialogTitle>
        </DialogHeader>
        <div className="max-h-[300px] overflow-y-auto space-y-2 mt-4">
          {recipients?.map((user) => (
            <div key={user._id} className="flex flex-col border-b pb-2 last:border-0">
              <span className="text-sm font-semibold">{user.firstName} {user.lastName}</span>
              <span className="text-xs text-gray-500">{user.email}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
// import { useState, useEffect } from 'react';
// import { createFileRoute } from '@tanstack/react-router';
// import { ChevronLeft, Inbox, Bell } from 'lucide-react';
// import { Button } from "@/components/ui/button";
// import axios from 'axios';
// import { getSocket } from '@/lib/websocket';

// export const Route = createFileRoute('/_navbarLayout/notification')({
//   component: NotificationPage,
// });

// function NotificationPage() {
//   const [notifications, setNotifications] = useState<any[]>([]);
//   const [selectedId, setSelectedId] = useState<string | null>(null);
//   const [selectedNotif, setSelectedNotif] = useState<any>(null);
//   const [loading, setLoading] = useState(true);

//   // 1. Fetch Inbox List
//   useEffect(() => {
//     const fetchList = async () => {
//       try {
//         const token = localStorage.getItem('token');
//         const res = await axios.get('/api/notification', {
//           headers: { Authorization: `Bearer ${token || ''}` }
//         });
//         setNotifications(res.data);
//       } catch (err) {
//         console.error("Error fetching notifications", err);
//       } finally {
//         setLoading(false);
//       }
//     };
//     fetchList();
//   }, []);

//   // socket integration for real-time updates
//   useEffect(() => {
//     const socket = getSocket();

//     const handleSocketNewNotification = (data?: any) => {
//       console.log("🔔 Socket: New Notification received", data);

//       if (data && data.notification) {
//         // 1. Add to the top of the list immediately
//         setNotifications(prev => {
//           // Prevent duplicate if the socket fires twice
//           const exists = prev.find(n => n._id === data.notification._id);
//           if (exists) return prev;
//           return [data.notification, ...prev];
//         });

//         // 2. Optional: If no notification is selected, you could auto-select it
//         // if (!selectedId) setSelectedId(data.notification._id);

//       } else {
//         // Fallback: If for some reason data is missing, fetch the list
//         refreshList();
//       }
//     };

//     const refreshList = async () => {
//       try {
//         const token = localStorage.getItem('token');
//         const res = await axios.get('/api/notification', {
//           headers: { Authorization: `Bearer ${token || ''}` }
//         });
//         setNotifications(res.data);
//       } catch (err) {
//         console.error("Error refreshing list", err);
//       }
//     };

//     socket.on("new-notification", handleSocketNewNotification);
//     return () => {
//       socket.off("new-notification", handleSocketNewNotification);
//     };
//   }, [selectedId]); // Added selectedId dependency if you use auto-select logic

//   // Inside NotificationPage.tsx -> useEffect for [selectedId]
//   useEffect(() => {
//     if (selectedId) {
//       const token = localStorage.getItem('token');

//       // Check if the item in our list is currently unread before we fetch
//       const currentNotif = notifications.find(n => n._id === selectedId);
//       const wasUnread = currentNotif && !currentNotif.isRead;

//       axios.get(`/api/notification/${selectedId}`, {
//         headers: { Authorization: `Bearer ${token || ''}` }
//       })
//         .then(res => {
//           setSelectedNotif(res.data);

//           if (wasUnread) {
//             // 1. Update local list state
//             setNotifications(prev =>
//               prev.map(n => n._id === selectedId ? { ...n, isRead: true } : n)
//             );

//             // 2. Broadcast to Navbar to decrease count
//             setTimeout(() => {
//               window.dispatchEvent(new Event('notificationRead'));
//             }, 10);
//           }
//         })
//         .catch(err => console.error(err));
//     }
//   }, [selectedId]);
//   // 3. Effect to handle dynamic time conversion in rendered HTML
//   useEffect(() => {
//     if (selectedNotif) {
//       // Small delay to ensure the DOM is painted by React
//       const timer = setTimeout(() => {
//         const elements = document.querySelectorAll('.local-time');
//         elements.forEach((el: any) => {
//           const utcStr = el.getAttribute('data-utc');
//           if (utcStr && utcStr !== 'undefined') {
//             try {
//               const localTime = new Date(utcStr).toLocaleString(undefined, {
//                 weekday: 'short',
//                 month: 'short',
//                 day: 'numeric',
//                 hour: '2-digit',
//                 minute: '2-digit',
//                 timeZoneName: 'short'
//               });
//               el.innerText = localTime;
//             } catch (e) {
//               console.error("Date conversion failed", e);
//             }
//           }
//         });
//       }, 50);
//       return () => clearTimeout(timer);
//     }
//   }, [selectedNotif]);

//   return (
//     <div className="flex h-[calc(100vh-65px)] overflow-hidden bg-white">
//       {/* LEFT SIDE: List */}
//       <div className={`${selectedId ? 'hidden md:flex' : 'flex'} w-full md:w-1/3 flex-col border-r border-gray-200`}>
//         <div className="p-4 border-b flex items-center justify-between bg-gray-50/50">
//           <div className="flex items-center gap-2">
//             <Bell className="h-5 w-5 text-blue-600" />
//             <h2 className="text-xl font-bold">Notification Center</h2>
//           </div>
//           <span className="text-xs bg-gray-200 px-2 py-1 rounded-full text-gray-600 font-medium">
//             {notifications.filter(n => !n.isRead).length} Unread
//           </span>
//         </div>

//         <div className="flex-1 overflow-y-auto">
//           {loading ? (
//             <div className="p-10 text-center text-gray-400 italic">Syncing notifications...</div>
//           ) : notifications.length === 0 ? (
//             <div className="flex flex-col items-center justify-center h-full text-gray-400">
//               <Inbox className="h-12 w-12 mb-2 opacity-20" />
//               <p>You have no new notifications</p>
//             </div>
//           ) : (
//             notifications.map((n) => (
//               <div
//                 key={n._id}
//                 onClick={() => setSelectedId(n._id)}
//                 className={`p-4 border-b cursor-pointer transition-all hover:bg-slate-50 relative ${selectedId === n._id ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'bg-white'
//                   }`}
//               >
//                 <div className="flex justify-between text-[10px] mb-1 uppercase tracking-wider text-gray-400">
//                   <span>{new Date(n.createdAt).toLocaleDateString()}</span>
//                   {/* NEW LOGIC: Use isRead boolean */}
//                   {!n.isRead && <span className="h-2 w-2 bg-blue-600 rounded-full animate-pulse"></span>}
//                 </div>

//                 {/* NEW LOGIC: Bold text if not read */}
//                 <h4 className={`text-sm truncate ${!n.isRead ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
//                   {n.subject}
//                 </h4>
//                 <div className="text-[10px] mt-1 text-blue-500 font-medium uppercase">
//                   {n.notificationType}
//                 </div>
//               </div>
//             ))
//           )}
//         </div>
//       </div>

//       {/* RIGHT SIDE: Detail View */}
//       <div className={`${!selectedId ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-gray-50`}>
//         {selectedId ? (
//           <div className="flex flex-col h-full">
//             <div className="md:hidden p-2 bg-white border-b">
//               <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
//                 <ChevronLeft className="h-4 w-4 mr-1" /> Notification Center
//               </Button>
//             </div>

//             <div className="flex-1 overflow-y-auto p-4 md:p-8">
//               {selectedNotif ? (
//                 <div className="max-w-3xl mx-auto">
//                   <div className="mb-6 flex justify-between items-start">
//                     <div>
//                       <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">
//                         {selectedNotif.subject}
//                       </h1>
//                       <p className="text-sm text-gray-500 mt-2 flex items-center gap-2">
//                         <span className="w-2 h-2 rounded-full bg-green-500"></span>
//                         From: {selectedNotif.senderId ? "Administrator" : "Hub System"}
//                         • {new Date(selectedNotif.createdAt).toLocaleString()}
//                       </p>
//                     </div>
//                   </div>

//                   <div className="bg-white shadow-md border border-gray-200 rounded-xl overflow-hidden">
//                     {/* Rendered HTML */}
//                     <div
//                       className="p-1 prose prose-blue max-w-none"
//                       dangerouslySetInnerHTML={{ __html: selectedNotif.html }}
//                     />
//                   </div>
//                 </div>
//               ) : (
//                 <div className="flex flex-col items-center justify-center h-full text-gray-400 animate-pulse">
//                   <p>Loading secure content...</p>
//                 </div>
//               )}
//             </div>
//           </div>
//         ) : (
//           <div className="hidden md:flex flex-col items-center justify-center h-full text-gray-400">
//             <Inbox className="h-16 w-16 mb-4 opacity-10" />
//             <p className="text-lg font-medium">Select a message to view details</p>
//             <p className="text-sm">Manage your station alerts and system updates here.</p>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }