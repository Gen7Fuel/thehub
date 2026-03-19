import { useState, useEffect, useMemo } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { X, Search, Mail, Layout, Info, Send, ArrowLeft, UserPlus, Users } from 'lucide-react';
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
  const canUpdateGroup = user?.access?.notification?.create?.editGroups;

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
  const [groups, setGroups] = useState<any[]>([]);
  const [searchMode, setSearchMode] = useState<'users' | 'groups'>('users');
  const [isGroupManagerOpen, setIsGroupManagerOpen] = useState(false);

  // Inside NotificationCreate
  const [editingGroup, setEditingGroup] = useState<any>(null); // null means "Create New"
  const [groupForm, setGroupForm] = useState({ name: '', description: '', userIds: [] as string[] });
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [selectedPreviewGroup, setSelectedPreviewGroup] = useState<any>(null);

  // Helper to handle selection based on mode
  const currentSelection = dialogConfig.mode === 'to' ? selectedToIds : selectedBccIds;

  // 1. Fetch Templates and Users
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tRes, uRes, gRes] = await Promise.all([
          axios.get('/api/notification/template', { headers: { Authorization: `Bearer ${token}`, "X-Required-Permission": "notification.create" } }),
          axios.get('/api/users/populate-roles', { headers: { Authorization: `Bearer ${token}`, "X-Required-Permission": "notification.create" } }),
          axios.get('/api/user-groups', { headers: { Authorization: `Bearer ${token}`, "X-Required-Permission": "notification.create" } })
        ]);
        const customOnly = tRes.data.filter((t: any) => t.type === 'custom');
        setTemplates(customOnly);
        // setTemplates(tRes.data);
        setAllUsers(uRes.data);
        setGroups(gRes.data);
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

  const toggleGroup = (group: any) => {
    // 1. Extract only active user IDs from the group
    const activeUserIdsFromGroup = group.userIds
      .filter((u: any) => u.is_active !== false)
      .map((u: any) => u._id);

    // 2. Update the selection based on mode (To or BCC)
    if (dialogConfig.mode === 'to') {
      setSelectedToIds(prev => Array.from(new Set([...prev, ...activeUserIdsFromGroup])));
    } else {
      setSelectedBccIds(prev => Array.from(new Set([...prev, ...activeUserIdsFromGroup])));
    }

    // 3. CLOSE THE DIALOG
    // This resets the open state while preserving the 'mode' for the next time it opens
    setDialogConfig(prev => ({ ...prev, open: false }));

    // Optional: Reset search term so it's fresh for next time
    setSearchTerm('');
  };

  const selectAll = () => {
    const activeIds = allUsers.filter(u => u.is_active !== false).map(u => u._id);
    if (dialogConfig.mode === 'to') setSelectedToIds(activeIds);
    else setSelectedBccIds(activeIds);

    // Close after selecting everyone
    setDialogConfig(prev => ({ ...prev, open: false }));
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

  const handleSaveGroup = async () => {
    if (!groupForm.name || groupForm.userIds.length === 0) return alert("Name and users required.");
    setIsSavingGroup(true);
    try {
      const payload = editingGroup?._id ? { ...groupForm, id: editingGroup._id } : groupForm;

      await axios.post('/api/user-groups', payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Required-Permission": "notification.create"
        }
      });

      // 1. Fetch the fresh list from server
      const gRes = await axios.get('/api/user-groups', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGroups(gRes.data);

      // 2. IMPORTANT: Reset these to go back to the List View
      setEditingGroup(null);
      setGroupForm({ name: '', description: '', userIds: [] });

      alert("Group saved successfully!");
    } catch (err: any) {
      // Handle the duplicate key error gracefully for the user
      if (err.response?.data?.message?.includes("E11000")) {
        alert("A group with this name already exists. Please choose a unique name.");
      } else {
        alert("Failed to save group");
      }
    } finally {
      setIsSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!window.confirm("Delete this group? Users will not be deleted, only the group association.")) return;
    try {
      await axios.delete(`/api/user-groups/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      setGroups(groups.filter(g => g._id !== id));
    } catch (err) {
      alert("Error deleting group");
    }
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
                {canUpdateGroup && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsGroupManagerOpen(true)}
                    className="gap-2 border-dashed border-slate-300"
                  >
                    <Users className="h-4 w-4" /> Manage Groups
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

          <Dialog open={dialogConfig.open} onOpenChange={(val) => setDialogConfig(prev => ({ ...prev, open: val }))}>
            <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
              <DialogHeader>
                <div className="flex justify-between items-center">
                  <DialogTitle>Select Recipients</DialogTitle>
                  <div className="flex bg-slate-100 p-1 rounded-md">
                    <button
                      onClick={() => setSearchMode('users')}
                      className={`px-3 py-1 text-xs rounded ${searchMode === 'users' ? 'bg-white shadow-sm' : ''}`}
                    >Users</button>
                    <button
                      onClick={() => setSearchMode('groups')}
                      className={`px-3 py-1 text-xs rounded ${searchMode === 'groups' ? 'bg-white shadow-sm' : ''}`}
                    >Groups</button>
                  </div>
                </div>
                <Input
                  placeholder={`Search ${searchMode}...`}
                  className="mt-4"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </DialogHeader>

              <div className="flex-1 overflow-y-auto py-4">
                {searchMode === 'users' ? (
                  filteredUsers.map(u => (
                    <div
                      key={u._id}
                      onClick={() => u.is_active !== false && toggleUser(u._id)}
                      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer mb-2 ${currentSelection.includes(u._id) ? "bg-blue-50 border-blue-200" : "hover:bg-slate-50"
                        } ${u.is_active === false && "opacity-50 grayscale cursor-not-allowed"}`}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{u.firstName} {u.lastName}</span>
                        <span className="text-[11px] text-slate-500">{u.email} • {u.role?.role_name}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={currentSelection.includes(u._id)}
                        readOnly
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                      />
                    </div>
                  ))
                ) : (
                  groups.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase())).map(g => {
                    const activeCount = g.userIds.filter((u: any) => u.is_active !== false).length;
                    return (
                      <div
                        key={g._id}
                        onClick={() => toggleGroup(g)}
                        className="flex items-center justify-between p-3 border rounded-lg mb-2 hover:bg-blue-50/50 cursor-pointer transition-colors group"
                      >
                        <div className="flex flex-col gap-0.5">
                          <p className="font-semibold text-sm">{g.name}</p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPreviewGroup(g);
                            }}
                            className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 w-fit"
                          >
                            <Info className="h-3 w-3" />
                            {g.userIds.length} total users ({activeCount} active)
                          </button>
                        </div>
                        <Button size="sm" variant="ghost" className="text-blue-600 group-hover:bg-blue-100">
                          Add All Active
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* NEW FOOTER SECTION */}
              {searchMode === 'users' && (
                <DialogFooter className="border-t pt-4 flex items-center justify-between sm:justify-between w-full">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAll}
                    className="text-slate-600"
                  >
                    Select All Active
                  </Button>
                  <div className="flex gap-2">
                    <span className="text-xs text-slate-500 flex items-center mr-2">
                      {currentSelection.length} selected
                    </span>
                    <Button
                      onClick={() => setDialogConfig(prev => ({ ...prev, open: false }))}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Confirm Recipients
                    </Button>
                  </div>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>
          {/* GROUP MANAGER DIALOG */}
          <Dialog open={isGroupManagerOpen} onOpenChange={(val) => {
            setIsGroupManagerOpen(val);
            setEditingGroup(null); // Reset on close
            setGroupForm({ name: '', description: '', userIds: [] });
          }}>
            <DialogContent className="max-w-3xl h-[85vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>{editingGroup ? `Editing: ${editingGroup.name}` : 'Manage User Groups'}</DialogTitle>
              </DialogHeader>

              {editingGroup || groupForm.name !== '' || isSavingGroup ? (
                /* CREATE / EDIT FORM */
                <div className="flex-1 space-y-4 overflow-y-auto p-1">
                  <div className="flex justify-between items-center mb-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingGroup(null);
                        setGroupForm({ name: '', description: '', userIds: [] });
                      }}
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" /> Back to List
                    </Button>
                  </div>
                  <div className="grid gap-2">
                    <Label>Group Name</Label>
                    <Input
                      value={groupForm.name}
                      onChange={e => setGroupForm({ ...groupForm, name: e.target.value })}
                      placeholder="e.g. Morning Shift Team"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Description</Label>
                    <Input
                      value={groupForm.description}
                      onChange={e => setGroupForm({ ...groupForm, description: e.target.value })}
                      placeholder="Who is in this group?"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Select Members ({groupForm.userIds.length})</Label>
                    <div className="border rounded-md h-64 overflow-y-auto p-2 grid grid-cols-2 gap-2">
                      {allUsers.map(u => (
                        <div
                          key={u._id}
                          className={`flex items-center gap-2 p-2 rounded border text-xs cursor-pointer ${groupForm.userIds.includes(u._id) ? 'bg-blue-50 border-blue-200' : ''}`}
                          onClick={() => {
                            const ids = groupForm.userIds.includes(u._id)
                              ? groupForm.userIds.filter(id => id !== u._id)
                              : [...groupForm.userIds, u._id];
                            setGroupForm({ ...groupForm, userIds: ids });
                          }}
                        >
                          <input type="checkbox" checked={groupForm.userIds.includes(u._id)} readOnly />
                          <span className="truncate">{u.firstName} {u.lastName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" className="flex-1" onClick={() => setEditingGroup(null)}>Cancel</Button>
                    <Button className="flex-1" onClick={handleSaveGroup} disabled={isSavingGroup}>
                      {isSavingGroup ? "Saving..." : "Save Group"}
                    </Button>
                  </div>
                </div>
              ) : (
                /* LIST VIEW */
                <div className="flex-1 flex flex-col overflow-hidden">
                  <Button onClick={() => setEditingGroup({})} className="mb-4 gap-2">
                    <UserPlus className="h-4 w-4" /> Create New Group
                  </Button>
                  <div className="flex-1 overflow-y-auto space-y-2">
                    {groups.map(g => (
                      <div key={g._id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50">
                        <div>
                          <p className="font-bold text-sm">{g.name}</p>
                          <p className="text-xs text-slate-500">{g.userIds.length} members</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => {
                            setEditingGroup(g);
                            setGroupForm({
                              name: g.name,
                              description: g.description,
                              userIds: g.userIds.map((u: any) => u._id)
                            });
                          }}>Edit</Button>
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDeleteGroup(g._id)}>Delete</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
          {/* GROUP MEMBERS PREVIEW DIALOG */}
          <Dialog open={!!selectedPreviewGroup} onOpenChange={() => setSelectedPreviewGroup(null)}>
            <DialogContent className="max-w-md max-h-[60vh] flex flex-col">
              <DialogHeader>
                <DialogTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Members of "{selectedPreviewGroup?.name}"
                </DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto py-2 space-y-1">
                {selectedPreviewGroup?.userIds.map((u: any) => (
                  <div
                    key={u._id}
                    className={`flex items-center justify-between p-2 rounded-md border text-xs ${u.is_active === false ? 'bg-gray-50 opacity-60' : 'bg-white'}`}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{u.firstName} {u.lastName}</span>
                      <span className="text-[10px] text-slate-500">{u.email}</span>
                    </div>
                    {u.is_active === false ? (
                      <span className="text-[10px] font-bold text-red-500 uppercase">Inactive</span>
                    ) : (
                      <span className="text-[10px] font-bold text-green-600 uppercase">Active</span>
                    )}
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="secondary" className="w-full" onClick={() => setSelectedPreviewGroup(null)}>
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div >
      </div>
    </div>
  );
}