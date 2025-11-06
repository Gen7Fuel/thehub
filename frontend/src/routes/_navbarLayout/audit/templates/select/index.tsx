import { createFileRoute } from '@tanstack/react-router'
import { useState } from "react";
import axios from "axios";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute('/_navbarLayout/audit/templates/select/')({
  component: RouteComponent,
})

function RouteComponent() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState([{ text: "" }]);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleOptionChange = (idx: number, value: string) => {
    setOptions(options =>
      options.map((s, i) => (i === idx ? { text: value } : s))
    );
  };

  const addSelectOption = () => setOptions([...options, { text: "" }]);
  const removeSelectOption = (idx: number) =>
    setOptions(options => options.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await axios.post(
        "/api/audit/select-templates",
        {
          name,
          description,
          options: options.filter(s => s.text.trim() !== ""),
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
        setError(err?.response?.data?.message || "Failed to create template");
      }
    }
  };


  return (
    <div className="max-w-lg mx-auto mt-8 p-4 border rounded">
      <h2 className="text-xl font-bold mb-4">Create Select Template</h2>
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
            <div key={idx} className="flex items-center mb-2">
              <input
                className="border px-2 py-1 flex-1"
                value={option.text}
                onChange={e => handleOptionChange(idx, e.target.value)}
                required
              />
              {options.length > 1 && (
                <button
                  type="button"
                  className="ml-2 text-red-500"
                  onClick={() => removeSelectOption(idx)}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="mt-1 text-blue-600"
            onClick={addSelectOption}
          >
            + Add Option
          </button>
        </div>
        {error && <div className="text-red-600">{error}</div>}
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Create Template
        </button>
      </form>
    </div>
  );
}