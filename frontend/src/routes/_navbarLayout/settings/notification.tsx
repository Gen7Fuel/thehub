import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Megaphone, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import axios from 'axios';

export const Route = createFileRoute('/_navbarLayout/settings/notification')({
  component: NotificationSettings,
})

function NotificationSettings() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState("");

  const handleTriggerIntroduction = async () => {
    const confirmed = window.confirm(
      "Are you sure? This will send an email and Hub notification to EVERY active user."
    );
    if (!confirmed) return;

    setLoading(true);
    setStatus('idle');
    setErrorMessage("");

    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/notification/introduction', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setStatus('success');
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMessage(err.response?.data?.message || "Failed to broadcast introduction.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Notification Management</CardTitle>
          <CardDescription>
            Control system-wide notification broadcasts and templates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Status Feedback Area */}
          {status === 'success' && (
            <div className="flex items-center gap-3 p-4 mb-4 text-green-800 border border-green-200 rounded-lg bg-green-50 animate-in fade-in slide-in-from-top-1">
              <CheckCircle2 className="h-5 w-5" />
              <div>
                <p className="text-sm font-bold">Broadcast Successful</p>
                <p className="text-xs">The introduction has been sent to all active Hub users.</p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-center gap-3 p-4 mb-4 text-red-800 border border-red-200 rounded-lg bg-red-50">
              <AlertCircle className="h-5 w-5" />
              <div>
                <p className="text-sm font-bold">Error</p>
                <p className="text-xs">{errorMessage}</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50">
            <div className="space-y-1">
              <p className="text-sm font-semibold">System Introduction</p>
              <p className="text-xs text-muted-foreground max-w-[300px]">
                Sends a one-time onboarding notification and email blast to all active users.
              </p>
            </div>
            
            <Button 
              onClick={handleTriggerIntroduction} 
              disabled={loading || status === 'success'}
              variant={status === 'success' ? "outline" : "default"}
              className="gap-2 min-w-[140px]"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : status === 'success' ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Completed
                </>
              ) : (
                <>
                  <Megaphone className="h-4 w-4" />
                  Launch Intro
                </>
              )}
            </Button>
          </div>

          {status === 'success' && (
            <p className="text-[10px] text-center text-gray-400 italic">
              Refresh the page if you need to re-trigger this broadcast.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}