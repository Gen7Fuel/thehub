import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Info, Eye, Plus, Trash2, HelpCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import axios from 'axios';

export const Route = createFileRoute('/_navbarLayout/notification/template/')({
  component: TemplateBuilder,
});

function TemplateBuilder() {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    contentLayout: '',
    fields: [] as any[]
  });
  
  const [previewValues, setPreviewValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Field Management
  const addField = () => {
    setFormData(prev => ({
      ...prev,
      fields: [...prev.fields, { key: '', label: '', fieldType: 'text', required: false }]
    }));
  };

  const updateField = (index: number, key: string, value: any) => {
    const newFields = [...formData.fields];
    newFields[index][key] = value;
    setFormData(prev => ({ ...prev, fields: newFields }));
  };

  const removeField = (index: number) => {
    setFormData(prev => ({ ...prev, fields: prev.fields.filter((_, i) => i !== index) }));
  };

  // Live Preview Logic
  const getRenderedHtml = () => {
    let html = formData.contentLayout;
    Object.keys(previewValues).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, previewValues[key] || `<span class="text-red-400 underline">{{${key}}}</span>`);
    });
    return html;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.post('/api/notification-template', formData);
      alert("Template Saved Successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to save template.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white border rounded-xl shadow-sm mb-10">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-800">New Template Builder</h2>
        <div className="flex gap-2">
          {/* INFO DIALOG */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <HelpCircle className="h-4 w-4" /> Syntax Guide
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>How Dynamic Fields Work</DialogTitle></DialogHeader>
              <div className="space-y-3 text-sm text-gray-600">
                <p>1. Define a <strong>Key</strong> (e.g., <code>user_name</code>).</p>
                <p>2. Use that key inside double curly braces in your HTML: <code>{`Hello {{user_name}}!`}</code></p>
                <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-xs">
                  {`<div>`} <br/>
                  {`  <h1>Update for {{feature_name}}</h1>`} <br/>
                  {`  <p>{{description}}</p>`} <br/>
                  {`</div>`}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* PREVIEW DIALOG */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 border-blue-200 text-blue-600 hover:bg-blue-50">
                <Eye className="h-4 w-4" /> Live Preview
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
              <DialogHeader><DialogTitle>Template Preview</DialogTitle></DialogHeader>
              <div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded border overflow-y-auto max-h-40">
                {formData.fields.map(f => (
                  <div key={f.key}>
                    <label className="text-[10px] font-bold uppercase">{f.label || f.key}</label>
                    <Input 
                      placeholder="Value..." 
                      className="h-8 text-sm"
                      onChange={(e) => setPreviewValues(prev => ({...prev, [f.key]: e.target.value}))}
                    />
                  </div>
                ))}
              </div>
              <div className="flex-1 border rounded-lg overflow-hidden bg-white">
                <div className="p-4 prose prose-blue max-w-none h-full overflow-y-auto" dangerouslySetInnerHTML={{ __html: getRenderedHtml() }} />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold">Template Name</label>
            <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. System Alert" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold">Unique Slug</label>
            <Input required value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} placeholder="system-alert-v1" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold">Short Description</label>
            <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Brief internal notes" />
          </div>
        </div>

        <hr />

        {/* FIELDS GENERATOR */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold flex items-center gap-2 text-blue-700">
              <Plus className="h-4 w-4" /> Dynamic Variables
            </h3>
            <Button type="button" size="sm" onClick={addField} variant="secondary">Add Input Field</Button>
          </div>
          
          <div className="space-y-3">
            {formData.fields.map((field, idx) => (
              <div key={idx} className="flex gap-3 items-end bg-gray-50 p-3 rounded-lg border border-dashed">
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-500">Key (No Spaces)</label>
                  <Input value={field.key} onChange={e => updateField(idx, 'key', e.target.value)} placeholder="feature_name" className="bg-white h-9" />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-500">Label in Form</label>
                  <Input value={field.label} onChange={e => updateField(idx, 'label', e.target.value)} placeholder="Enter Feature Name" className="bg-white h-9" />
                </div>
                <div className="w-40 space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-500">Field Type</label>
                  <Select value={field.fieldType} onValueChange={val => updateField(idx, 'fieldType', val)}>
                    <SelectTrigger className="bg-white h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="textarea">Textarea</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="url">URL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeField(idx)} className="text-red-400 hover:text-red-600">
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <hr />

        {/* HTML LAYOUT AREA */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-sm font-bold text-gray-700 font-mono">CONTENT LAYOUT (HTML)</label>
            <Info className="h-3 w-3 text-gray-400" />
          </div>
          <Textarea 
            required
            className="min-h-[350px] font-mono text-sm bg-slate-900 text-slate-100 p-4 border-2 border-slate-700 focus:border-blue-500" 
            placeholder={`<div class="card">\n  <h1>{{title}}</h1>\n  <p>{{body}}</p>\n</div>`}
            value={formData.contentLayout}
            onChange={e => setFormData({...formData, contentLayout: e.target.value})}
          />
        </div>

        <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={saving}>
          {saving ? "Publishing..." : "Create Template"}
        </Button>
      </form>
    </div>
  );
}