import { useState, useEffect, useMemo } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { X, Search, Mail, Layout, Info, Send, ArrowLeft, UserPlus } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Link } from '@tanstack/react-router';

export const Route = createFileRoute('/_navbarLayout/notification/create')({
  component: NotificationCreate,
});

function NotificationCreate() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const { user } = useAuth(); // Assuming useAuth hook provides user permissions

  // Permissions Check
  const canAddBcc = user?.access?.notification?.create?.addBcc;

  // Form State
  const [selectedToIds, setSelectedToIds] = useState<string[]>([]);
  const [selectedBccIds, setSelectedBccIds] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  // Data State
  const [templates, setTemplates] = useState([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // UI State
  const [dialogConfig, setDialogConfig] = useState<{ open: boolean, mode: 'to' | 'bcc' }>({
    open: false,
    mode: 'to'
  });
  const [searchTerm, setSearchTerm] = useState('');

  // Helper to handle selection based on mode
  const currentSelection = dialogConfig.mode === 'to' ? selectedToIds : selectedBccIds;

  // 1. Fetch Templates and Users
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tRes, uRes] = await Promise.all([
          axios.get('/api/notification/template', { headers: { Authorization: `Bearer ${token}`, "X-Required-Permission": "notification.create" } }),
          axios.get('/api/users/populate-roles', { headers: { Authorization: `Bearer ${token}`, "X-Required-Permission": "notification.create" } })
        ]);
        const customOnly = tRes.data.filter((t: any) => t.type === 'custom');
        setTemplates(customOnly);
        // setTemplates(tRes.data);
        setAllUsers(uRes.data);
      } catch (err) {
        console.error("Initialization error", err);
      }
    };
    fetchData();
  }, []);

  // Filtered users for Dialog
  const filteredUsers = useMemo(() => {
    return allUsers.filter(u =>
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, allUsers]);

  const toggleUser = (id: string) => {
    if (dialogConfig.mode === 'to') {
      setSelectedToIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    } else {
      setSelectedBccIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    }
  };

  const selectAll = () => {
    const activeIds = allUsers.filter(u => u.is_active !== false).map(u => u._id);
    if (dialogConfig.mode === 'to') setSelectedToIds(activeIds);
    else setSelectedBccIds(activeIds);
  };

  const handleSend = async () => {
    if (!selectedTemplate || (selectedToIds.length === 0 && selectedBccIds.length === 0) || !subject) {
      return alert("Details missing.");
    }
    setLoading(true);
    try {
      await axios.post('/api/notification', {
        templateId: selectedTemplate._id,
        recipientIds: selectedToIds,
        bccUserIds: selectedBccIds,
        subject,
        fieldValues
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert("Sent!");
      navigate({ to: '/notification' });
    } catch (err) { alert("Error sending"); } finally { setLoading(false); }
  };

  // Live Preview Helper
  const getPreviewHtml = () => {
    if (!selectedTemplate) return "";
    let html = selectedTemplate.contentLayout;
    selectedTemplate.fields.forEach((f: any) => {
      const regex = new RegExp(`{{${f.key}}}`, 'g');
      html = html.replace(regex, fieldValues[f.key] || `<span style="color:red">(${f.label})</span>`);
    });
    return html;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-65px)] bg-gray-50/30 relative overflow-y-auto">

      {/* Navigation/Back Header Area */}
      <div className="absolute top-6 left-6 z-10">
        <Link to="/notification">
          <Button variant="ghost" size="sm" className="gap-2 text-gray-600 hover:text-black hover:bg-white/50 shadow-sm border border-transparent hover:border-gray-200 transition-all">
            <ArrowLeft className="h-4 w-4" />
            Back to Notifications
          </Button>
        </Link>
      </div>

      {/* Main Scrollable Content */}
      <div className="w-full max-w-4xl mx-auto p-6 pt-20 space-y-8 pb-20">

        {/* Page Title */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Send Notification</h1>
          <p className="text-muted-foreground">Send a manual notification to specific hub users.</p>
        </div>

        <div className="grid gap-6">
          {/* RECIPIENTS SECTION */}
          <section className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-lg font-semibold flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-500" /> Recipients
              </Label>
              <div className="flex gap-2">
                {canAddBcc && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setDialogConfig({ open: true, mode: 'bcc' })}
                    className="bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200"
                  >
                    Add BCC
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setDialogConfig({ open: true, mode: 'to' })} className="gap-2">
                  <UserPlus className="h-4 w-4" /> Add Users
                </Button>
              </div>
            </div>

            {/* TO List */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Direct Recipients (To)</p>
              <div className="flex flex-wrap gap-2 min-h-[48px] p-3 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                {selectedToIds.length === 0 && <span className="text-xs text-slate-400 italic">No recipients selected</span>}
                {selectedToIds.map(id => {
                  const u = allUsers.find(user => user._id === id);
                  return (
                    <div key={id} className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1 rounded-full text-xs shadow-sm group">
                      <span className="font-medium">{u?.firstName} {u?.lastName}</span>
                      <X
                        className="h-3.5 w-3.5 cursor-pointer text-slate-400 group-hover:text-red-500 transition-colors"
                        onClick={() => setSelectedToIds(prev => prev.filter(i => i !== id))}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* BCC List */}
            {selectedBccIds.length > 0 && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <p className="text-[10px] font-bold uppercase text-orange-500 tracking-wider">BCC Recipients (Private)</p>
                <div className="flex flex-wrap gap-2 min-h-[48px] p-3 bg-orange-50/30 rounded-lg border border-dashed border-orange-200">
                  {selectedBccIds.map(id => {
                    const u = allUsers.find(user => user._id === id);
                    return (
                      <div key={id} className="flex items-center gap-2 bg-white border border-orange-100 px-3 py-1 rounded-full text-xs shadow-sm group">
                        <span className="font-medium text-orange-700">{u?.firstName} {u?.lastName}</span>
                        <X
                          className="h-3.5 w-3.5 cursor-pointer text-orange-300 group-hover:text-red-500 transition-colors"
                          onClick={() => setSelectedBccIds(prev => prev.filter(i => i !== id))}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* CONTENT SECTION */}
          <section className="bg-white p-6 rounded-xl border shadow-sm space-y-6">
            <div className="space-y-2">
              <Label className="text-base font-semibold">Subject Line</Label>
              <Input
                placeholder="e.g. Action Required: Document Update"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-base font-semibold">Select Template</Label>
              <Select onValueChange={(val) => {
                const t = templates.find((x: any) => x._id === val);
                setSelectedTemplate(t);
                setFieldValues({}); // Reset fields on template change
              }}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Choose a layout..." /></SelectTrigger>
                <SelectContent>
                  {templates.map((t: any) => (
                    <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTemplate?.description && (
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                  <Info className="h-3 w-3" /> {selectedTemplate.description}
                </p>
              )}
            </div>
          </section>

          {/* DYNAMIC FIELDS & PREVIEW */}
          {selectedTemplate && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <section className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
                <Label className="text-lg font-semibold flex items-center gap-2">
                  <Layout className="h-5 w-5 text-orange-500" /> Information Fields
                </Label>
                <div className="space-y-4">
                  {selectedTemplate.fields.map((field: any) => (
                    <div key={field.key} className="space-y-1.5">
                      <Label className="text-sm text-slate-600">{field.label}</Label>
                      {field.fieldType === 'textarea' ? (
                        <textarea
                          className="w-full rounded-md border p-2 text-sm min-h-[100px]"
                          onChange={e => setFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                        />
                      ) : (
                        <Input
                          type={field.fieldType}
                          onChange={e => setFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-slate-900 rounded-xl border shadow-sm overflow-hidden flex flex-col h-full min-h-[400px]">
                <div className="bg-slate-800 px-4 py-2 border-b border-slate-700">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Live Message Preview</span>
                </div>
                <div className="p-6 bg-white flex-1 overflow-y-auto m-4 rounded-lg">
                  <div dangerouslySetInnerHTML={{ __html: getPreviewHtml() }} />
                </div>
              </section>
            </div>
          )}

          <Button
            className="w-full h-14 text-lg gap-2 shadow-lg"
            disabled={loading || !selectedTemplate}
            onClick={handleSend}
          >
            <Send className="h-5 w-5" /> {loading ? "Sending..." : "Send Notification Now"}
          </Button>

          {/* REUSABLE USER DIALOG */}
          <Dialog open={dialogConfig.open} onOpenChange={(val) => setDialogConfig(prev => ({ ...prev, open: val }))}>
            <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
              <DialogHeader>
                <div className="flex justify-between items-end">
                  <DialogTitle>Select {dialogConfig.mode === 'to' ? 'Recipients' : 'BCC Recipients'}</DialogTitle>
                  <Button variant="link" size="sm" onClick={selectAll} className="text-blue-600">Select All Active</Button>
                </div>
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input placeholder="Search..." className="pl-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto py-4 space-y-2">
                {filteredUsers.map((u) => (
                  <div
                    key={u._id}
                    onClick={() => u.is_active !== false && toggleUser(u._id)}
                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer ${currentSelection.includes(u._id) ? "bg-blue-50 border-blue-200" : "hover:bg-slate-50"
                      } ${u.is_active === false && "opacity-50 grayscale cursor-not-allowed"}`}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{u.firstName} {u.lastName}</span>
                      <span className="text-[11px] text-slate-500">{u.email} • {u.role?.role_name}</span>
                    </div>
                    <input type="checkbox" readOnly checked={currentSelection.includes(u._id)} className="h-4 w-4" />
                  </div>
                ))}
              </div>
              <DialogFooter className="border-t pt-4">
                <Button onClick={() => setDialogConfig(prev => ({ ...prev, open: false }))} className="w-full">
                  Confirm {dialogConfig.mode.toUpperCase()} ({currentSelection.length})
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div >
      </div>
    </div>
  );
}