import { createFileRoute } from '@tanstack/react-router'
import { Outlet, Link, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export const Route = createFileRoute('/_navbarLayout/audit/checklist')({
  component: RouteComponent,
})

function RouteComponent() {
  const site = localStorage.getItem("location") || "";
  const [templates, setTemplates] = useState<{ _id: string; name: string }[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchTemplates = async () => {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/audit/templates?site=${encodeURIComponent(site)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
        // Optionally redirect to first tab if none selected
        if (data.length > 0 && router.state.location.pathname.endsWith("/checklist")) {
          router.navigate({ to: `/audit/checklist/${data[0]._id}` });
        }
      }
    };
    if (site) fetchTemplates();
  }, [site, router]);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Station Audit Checklists</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            {templates.map(tpl => (
              <Link
                key={tpl._id}
                to="/audit/checklist/$templateId"
                params={{ templateId: tpl._id }}
                className="px-4 py-2 border rounded"
                activeProps={{ className: "bg-primary text-white" }}
              >
                {tpl.name}
              </Link>
            ))}
          </div>
          <Outlet />
        </CardContent>
      </Card>
    </div>
  );
}