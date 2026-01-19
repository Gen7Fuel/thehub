import { useState, useEffect, useMemo } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useAuth } from "@/context/AuthContext";
import { SitePicker } from '@/components/custom/sitePicker';
import { Button } from '@/components/ui/button';
import { ChevronRight, Package } from 'lucide-react';
import axios from 'axios';

export const Route = createFileRoute('/_navbarLayout/write-off/requests')({
  component: RouteComponent,
  validateSearch: (search: { site: string }) => ({
    site: search.site,
  }),
  loaderDeps: ({ search: { site } }) => ({ site }),
  loader: async ({ deps: { site } }) => {
    if (!site) return { data: [], accessDenied: false };

    try {
      const res = await axios.get(`/api/write-off/list?site=${site}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          "X-Required-Permission": "writeOff.requests"
        }
      });
      return { data: res.data, accessDenied: false };
    } catch (err: any) {
      return { data: [], accessDenied: err.response?.status === 403 };
    }
  }
});

export const getStatusStyles = (status: string) => {
  switch (status) {
    case 'Complete': return 'bg-green-100 text-green-700 border-green-200';
    case 'Partial': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'Incomplete': return 'bg-slate-100 text-slate-500 border-slate-200';
    default: return 'bg-slate-50 text-slate-400';
  }
};

function RouteComponent() {
  const { user } = useAuth();
  const { site } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data, accessDenied } = Route.useLoaderData() as any;

  useEffect(() => {
    if (accessDenied) navigate({ to: "/no-access" });
  }, [accessDenied, navigate]);

  useEffect(() => {
    if (!site && user?.location) {
      navigate({ search: { site: user.location } });
    }
  }, [site, user?.location]);

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const order: Record<string, number> = { Incomplete: 0, Partial: 1, Complete: 2 };
      if (order[a.status] !== order[b.status]) {
        return order[a.status] - order[b.status];
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [data]);

  return (
    <div className="min-w-2xl mx-auto p-6 h-[calc(100vh-120px)] flex flex-col antialiased font-sans">

      {/* Site Picker */}
      <div className="flex justify-center mb-8">
        <SitePicker value={site} onValueChange={(s) => navigate({ search: { site: s } })} />
      </div>

      {/* Container */}
      <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
            Write-Off Requests
          </h2>
          <span className="px-2.5 py-1 rounded-md bg-slate-100 text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
            {sortedData.length} Records
          </span>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {sortedData.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-20">
              <Package className="w-10 h-10 mb-3 text-slate-200" />
              <p className="text-sm font-medium text-slate-400">
                No pending write-offs for this site.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {sortedData.map((wo: any) => (
                <li
                  key={wo._id}
                  onClick={() => navigate({ to: `/write-off/$id`, params: { id: wo._id } })}
                  className="group px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  {/* Left */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-900 tracking-tight group-hover:text-primary">
                        {new Date(wo.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                        <span className="ml-2 text-slate-400 font-medium">
                          {new Date(wo.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </span>

                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${getStatusStyles(wo.status)}`}>
                        {wo.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[12px] text-slate-400 font-medium tracking-normal">
                      <Package className="w-3.5 h-3.5" />
                      {wo.items.length} Items to Review
                    </div>
                  </div>

                  {/* Right */}
                  <div className="flex items-center gap-2">
                    <span className="hidden group-hover:block text-[10px] font-semibold text-primary uppercase tracking-wide">
                      Review
                    </span>
                    <div className="p-2 rounded-full group-hover:bg-primary/10 transition-colors">
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}