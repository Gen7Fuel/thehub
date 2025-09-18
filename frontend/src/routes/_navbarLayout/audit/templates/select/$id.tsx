import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import axios from "axios";

export const Route = createFileRoute(
  '/_navbarLayout/audit/templates/select/$id',
)({
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = useParams({ from: '/_navbarLayout/audit/templates/select/$id'});
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState<{ text: string }[]>([{ text: "" }]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get(`/api/audit/select-templates/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem(`token`)}`,
        },
      })
      .then(res => {
        setName(res.data.name || "");
        setDescription(res.data.description || "");
        setOptions(res.data.options && res.data.options.length > 0 ? res.data.options : [{ text: "" }]);
      })
      .catch(() => setError("Failed to load template"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleOptionChange = (idx: number, value: string) => {
    setOptions(options =>
      options.map((option, i) => (i === idx ? { text: value } : option))
    );
  };

  const addOption = () => setOptions([...options, { text: "" }]);
  const removeOption = (idx: number) =>
    setOptions(options => options.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await axios.put(
        `/api/audit/select-templates/${id}`,
        {
          name,
          description,
          options: options.filter(o => o.text.trim() !== ""),
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem(`token`)}`,
          },
        }
      );
      navigate({ to: "/audit/templates/select/list" });
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to update template");
    }
  };

  if (loading) return <div className="text-center mt-8">Loading...</div>;
  if (error) return <div className="text-red-600 text-center mt-8">{error}</div>;

  return (
    <div className="max-w-lg mx-auto mt-8 p-4 border rounded">
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
                  onClick={() => removeOption(idx)}
                >
                  Remove
                </button>
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