import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

interface AuditTemplate {
  _id: string;
  name: string;
  description?: string;
  items: { text: string; required: boolean }[];
}

export const Route = createFileRoute('/_navbarLayout/audit/list')({
  component: RouteComponent,
})

function RouteComponent() {
  const [templates, setTemplates] = useState<AuditTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/audit", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setTemplates(await res.json());
        } else {
          setTemplates([]);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchTemplates();
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Audit Templates</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div>Loading...</div>
          ) : templates.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No audit templates found.
            </div>
          ) : (
            <table className="min-w-full border text-sm">
              <thead>
                <tr className="bg-muted">
                  <th className="p-2 border">Name</th>
                  <th className="p-2 border">Description</th>
                  <th className="p-2 border"># Items</th>
                  <th className="p-2 border">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((tpl) => (
                  <tr key={tpl._id} className="hover:bg-accent">
                    <td className="p-2 border font-medium">{tpl.name}</td>
                    <td className="p-2 border">{tpl.description || "-"}</td>
                    <td className="p-2 border text-center">{tpl.items.length}</td>
                    <td className="p-2 border text-center">
                      <Link to="/audit/$id" params={{ id: tpl._id }}>
                        <Button size="sm" variant="outline">View</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      <Button asChild className="mt-6">
        <Link to="/audit">Create New Template</Link>
      </Button>
    </div>
  );
}