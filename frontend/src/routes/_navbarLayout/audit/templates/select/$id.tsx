import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import axios from "axios";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmailChipInput } from "@/components/custom/emailChipInput";

export const Route = createFileRoute(
  '/_navbarLayout/audit/templates/select/$id',
)({
  component: RouteComponent,
});

interface SiteOverride {
  site: string;
  to: string;
  cc: string;
}

interface Option {
  text: string;
  email?: string;
  cc?: string;
  siteOverrides?: SiteOverride[];
  _overridesOpen?: boolean;
}

interface SiteLocation {
  _id: string;
  stationName: string;
}

const emptyOption = (): Option => ({
  text: "",
  email: "",
  cc: "",
  siteOverrides: [],
  _overridesOpen: false,
});

function RouteComponent() {
  const { id } = useParams({ from: '/_navbarLayout/audit/templates/select/$id' });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState<Option[]>([emptyOption()]);
  const [sites, setSites] = useState<SiteLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const headers = {
      Authorization: `Bearer ${token}`,
      "X-Required-Permission": "stationAudit.template",
    };

    Promise.all([
      axios.get(`/api/audit/select-templates/${id}`, { headers }),
      axios.get("/api/locations", { headers }),
    ])
      .then(([templateRes, sitesRes]) => {
        setName(templateRes.data.name || "");
        setDescription(templateRes.data.description || "");
        setOptions(
          templateRes.data.options && templateRes.data.options.length > 0
            ? templateRes.data.options.map((o: any) => ({
                text: o.text || "",
                email: o.email || "",
                cc: o.cc || "",
                siteOverrides: (o.siteOverrides || []).map((ov: any) => ({
                  site: ov.site,
                  to: ov.to || "",
                  cc: ov.cc || "",
                })),
                _overridesOpen: false,
              }))
            : [emptyOption()]
        );
        setSites(sitesRes.data || []);
      })
      .catch(err => {
        if (err.response?.status === 403) {
          navigate({ to: "/no-access" });
        } else {
          setError("Failed to load template");
        }
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);


  const handleOptionChange = (idx: number, field: "text" | "email" | "cc", value: string) => {
    setOptions(prev =>
      prev.map((opt, i) =>
        i === idx ? { ...opt, [field]: value } : opt
      )
    );
  };

  const toggleOverrides = (idx: number) => {
    setOptions(prev =>
      prev.map((opt, i) =>
        i === idx ? { ...opt, _overridesOpen: !opt._overridesOpen } : opt
      )
    );
  };

  const getOverrideValue = (option: Option, site: string, field: "to" | "cc"): string =>
    option.siteOverrides?.find(ov => ov.site === site)?.[field] || "";

  const handleOverrideChange = (optIdx: number, site: string, field: "to" | "cc", value: string) => {
    setOptions(prev =>
      prev.map((opt, i) => {
        if (i !== optIdx) return opt;
        const existing = opt.siteOverrides || [];
        const rowIdx = existing.findIndex(ov => ov.site === site);
        const updated =
          rowIdx === -1
            ? [...existing, { site, to: "", cc: "", [field]: value }]
            : existing.map((ov, j) => (j === rowIdx ? { ...ov, [field]: value } : ov));
        return { ...opt, siteOverrides: updated };
      })
    );
  };

  const setAllSites = (idx: number) => {
    const option = options[idx];
    if (
      !window.confirm(
        `Set every site's TO/CC to this option's default (${option.email || "no TO"} / ${option.cc || "no CC"})? This overwrites any per-site values already entered.`
      )
    ) {
      return;
    }
    setOptions(prev =>
      prev.map((opt, i) =>
        i === idx
          ? {
              ...opt,
              siteOverrides: sites.map(s => ({
                site: s.stationName,
                to: opt.email || "",
                cc: opt.cc || "",
              })),
            }
          : opt
      )
    );
  };

  const addOption = () => setOptions([...options, emptyOption()]);
  const removeOption = (idx: number) =>
    setOptions(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const cleanedOptions = options
        .filter(o => o.text.trim() !== "")
        .map(o => ({
          text: o.text.trim(),
          ...(name === "Assigned To"
            ? {
                email: o.email?.trim() || "",
                cc: o.cc?.trim() || "",
                siteOverrides: (o.siteOverrides || [])
                  .filter(ov => (ov.to && ov.to.trim() !== "") || (ov.cc && ov.cc.trim() !== ""))
                  .map(ov => ({
                    site: ov.site,
                    to: ov.to?.trim() || "",
                    cc: ov.cc?.trim() || "",
                  })),
              }
            : {}),
        }));

      const res = await axios.put(
        `/api/audit/select-templates/${id}`,
        {
          name,
          description,
          options: cleanedOptions,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "X-Required-Permission": "stationAudit.template",
          },
        }
      );

      if (res.status === 403) {
        navigate({ to: "/no-access" });
        return;
      }

      navigate({ to: "/audit/templates/select/list" });
    } catch (err: any) {
      if (err.response?.status === 403) {
        navigate({ to: "/no-access" });
      } else {
        setError(err?.response?.data?.message || "Failed to update template");
      }
    }

  };

  if (loading) return <div className="text-center mt-8">Loading...</div>;
  if (error) return <div className="text-red-600 text-center mt-8">{error}</div>;

  return (
    <div className="max-w-3xl mx-auto mt-8 p-4 border rounded">
      <h2 className="text-xl font-bold mb-4">Edit Select Template</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-medium">Template Name</label>
          <input
            className="border px-2 py-1 w-full"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block font-medium">Description</label>
          <input
            className="border px-2 py-1 w-full"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Options</label>
          {options.map((option, idx) => (
            <div key={idx} className="mb-3 border rounded p-3">
              <div className="flex items-center gap-2">
                <input
                  className="border px-2 py-1 flex-1"
                  placeholder="Option text"
                  value={option.text}
                  onChange={e => handleOptionChange(idx, "text", e.target.value)}
                  required
                />

                {options.length > 1 && (
                  <button
                    type="button"
                    className="text-red-500"
                    onClick={() => removeOption(idx)}
                  >
                    Remove
                  </button>
                )}
              </div>

              {name === "Assigned To" && (
                <div className="mt-2 space-y-2">
                  <div className="flex gap-2">
                    <EmailChipInput
                      className="flex-1"
                      placeholder="Default TO email(s)"
                      value={option.email}
                      onChange={value => handleOptionChange(idx, "email", value)}
                    />
                    <EmailChipInput
                      className="flex-1"
                      placeholder="Default CC email(s)"
                      value={option.cc}
                      onChange={value => handleOptionChange(idx, "cc", value)}
                    />
                  </div>

                  <div>
                    <button
                      type="button"
                      className="text-blue-600 text-sm"
                      onClick={() => toggleOverrides(idx)}
                    >
                      {option._overridesOpen ? "− Hide" : "+ Manage"} site overrides
                      {option.siteOverrides && option.siteOverrides.filter(ov => ov.to || ov.cc).length > 0
                        ? ` (${option.siteOverrides.filter(ov => ov.to || ov.cc).length} customized)`
                        : ""}
                    </button>

                    {option._overridesOpen && (
                      <div className="mt-2 border rounded">
                        <div className="flex justify-between items-center px-2 py-1 bg-gray-50 border-b">
                          <span className="text-xs text-gray-500">
                            Blank TO/CC inherits this option's default above.
                          </span>
                          <button
                            type="button"
                            className="text-xs text-blue-600 whitespace-nowrap"
                            onClick={() => setAllSites(idx)}
                          >
                            Set for all sites
                          </button>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Site</TableHead>
                              <TableHead>TO</TableHead>
                              <TableHead>CC</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sites.map(site => (
                              <TableRow key={site._id}>
                                <TableCell className="whitespace-nowrap">{site.stationName}</TableCell>
                                <TableCell>
                                  <EmailChipInput
                                    placeholder="Uses default"
                                    value={getOverrideValue(option, site.stationName, "to")}
                                    onChange={value =>
                                      handleOverrideChange(idx, site.stationName, "to", value)
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <EmailChipInput
                                    placeholder="Uses default"
                                    value={getOverrideValue(option, site.stationName, "cc")}
                                    onChange={value =>
                                      handleOverrideChange(idx, site.stationName, "cc", value)
                                    }
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          <button
            type="button"
            className="mt-1 text-blue-600"
            onClick={addOption}
          >
            + Add Option
          </button>
        </div>

        {error && <div className="text-red-600">{error}</div>}
        <button
          type="submit"
          className="bg-gray-700 text-white px-4 py-2 rounded"
        >
          Save Changes
        </button>
      </form>
    </div>
  );
}
