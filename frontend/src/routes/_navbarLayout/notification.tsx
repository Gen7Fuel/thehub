import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ChevronLeft, Inbox } from 'lucide-react';
import { Button } from "@/components/ui/button"; // Assuming shadcn/ui

export const Route = createFileRoute('/_navbarLayout/notification')({
  component: NotificationPage,
});

interface Notification {
  id: string;
  subject: string;
  preview: string;
  time: string;
  read: boolean;
}

function NotificationPage() {
  const [selectedId, setSelectedId] = useState<Notification['id'] | null>(null);
  
  // Mock Data - We will replace this with your API call later
  const notifications = [
    { id: '1', subject: '⚠️ Issue Raised for Site 102', preview: 'An issue has been raised...', time: '2h ago', read: false },
    { id: '2', subject: '✅ Audit Completed', preview: 'Station 105 audit is now...', time: '5h ago', read: true },
  ];

  const selectedNotif = notifications.find(n => n.id === selectedId);

  return (
    <div className="flex h-[calc(100vh-65px)] overflow-hidden bg-white">
      {/* LEFT SIDE: List (Hidden on mobile if a notification is open) */}
      <div className={`${selectedId ? 'hidden md:flex' : 'flex'} w-full md:w-1/3 flex-col border-r border-gray-200`}>
        <div className="p-4 border-b flex justify-between items-center bg-gray-50/50">
          <h2 className="text-xl font-bold">Notifications</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Inbox className="h-12 w-12 mb-2" />
              <p>No notifications yet</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => setSelectedId(n.id)}
                className={`p-4 border-b cursor-pointer transition-colors hover:bg-blue-50/50 ${
                  selectedId === n.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                } ${!n.read ? 'bg-white font-semibold' : 'bg-white opacity-70'}`}
              >
                <div className="flex justify-between text-xs mb-1">
                  <span className={!n.read ? 'text-blue-600' : 'text-gray-500'}>{n.time}</span>
                  {!n.read && <span className="h-2 w-2 bg-blue-600 rounded-full"></span>}
                </div>
                <h4 className="text-sm truncate">{n.subject}</h4>
                <p className="text-xs text-gray-500 truncate">{n.preview}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT SIDE: Detail View (Full screen on mobile if open) */}
      <div className={`${!selectedId ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-gray-50`}>
        {selectedId ? (
          <div className="flex flex-col h-full">
            {/* Mobile Back Button */}
            <div className="md:hidden p-2 bg-white border-b">
              <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
              <div className="max-w-3xl mx-auto bg-white shadow-sm border rounded-xl overflow-hidden">
                {/* Here we will inject the HTML from your template */}
                <div className="p-6 border-b bg-gray-50">
                   <h1 className="text-2xl font-bold text-gray-800">{selectedNotif?.subject}</h1>
                </div>
                <div className="p-6">
                   {/* This is a placeholder for the rendered HTML Template Instance */}
                   <p className="text-gray-600">Loading notification content...</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden md:flex flex-col items-center justify-center h-full text-gray-400">
            <p>Select a notification to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}