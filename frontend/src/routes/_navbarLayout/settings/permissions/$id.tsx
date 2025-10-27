import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute('/_navbarLayout/settings/permissions/$id')({
  component: RouteComponent,
  loader: async ({ params }) => {
    try {
      const response = await axios.get(`/api/permissions/${params.id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      return { permission: response.data || null };
    } catch (error) {
      console.error("Error fetching permission:", error);
      return { permission: null };
    }
  },
});

interface Permission {
  _id: string;
  module_name: string;
  components: {
    name: string;
    children: string[];
  }[];
}

function RouteComponent() {
  const { permission } = Route.useLoaderData() as { permission: Permission | null };
  const [moduleName, setModuleName] = useState(permission?.module_name || "");
  const [components, setComponents] = useState(permission?.components || []);
  const navigate = useNavigate();

  useEffect(() => {
    if (permission) {
      setModuleName(permission.module_name);
      setComponents(permission.components);
    }
  }, [permission]);

  // ➕ Add a new component
  const addComponent = () => {
    setComponents([...components, { name: "", children: [] }]);
  };

  // 🧩 Update a component name
  const updateComponentName = (index: number, value: string) => {
    const updated = [...components];
    updated[index].name = value;
    setComponents(updated);
  };

  // ➕ Add a child action to a component
  const addChild = (index: number) => {
    const updated = [...components];
    updated[index].children.push("");
    setComponents(updated);
  };

  // ✏️ Update a specific child action
  const updateChild = (compIndex: number, childIndex: number, value: string) => {
    const updated = [...components];
    updated[compIndex].children[childIndex] = value;
    setComponents(updated);
  };

  // 🗑 Remove a component
  const removeComponent = (index: number) => {
    const updated = components.filter((_, i) => i !== index);
    setComponents(updated);
  };

  // 🗑 Remove a child
  const removeChild = (compIndex: number, childIndex: number) => {
    const updated = [...components];
    updated[compIndex].children = updated[compIndex].children.filter((_, i) => i !== childIndex);
    setComponents(updated);
  };

  // 💾 Save updates
  const handleSave = async () => {
    try {
      await axios.put(`/api/permissions/${permission?._id}`, {
        module_name: moduleName,
        components,
      }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      alert("Permission updated successfully!");
      navigate({ to: "/settings/permissions" });
    } catch (error) {
      console.error("Error updating permission:", error);
      alert("Failed to update permission.");
    }
  };

  if (!permission) {
    return <div className="p-4 text-red-500">Permission not found.</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold mb-2">Edit Permission</h1>

      {/* Module Name */}
      <div>
        <label className="block text-gray-700 mb-1 font-medium">Module Name</label>
        <Input
          value={moduleName}
          onChange={(e) => setModuleName(e.target.value)}
          placeholder="Module name"
          className="w-1/2"
        />
      </div>

      {/* Components */}
      <div className="space-y-6 mt-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Components</h2>
          <Button variant="outline" onClick={addComponent}>+ Add Component</Button>
        </div>

        {components.map((component, i) => (
          <div key={i} className="border p-4 rounded-md space-y-2 bg-gray-50">
            <div className="flex justify-between items-center">
              <Input
                value={component.name}
                onChange={(e) => updateComponentName(i, e.target.value)}
                placeholder="Component name"
                className="w-1/2"
              />
              <Button variant="destructive" onClick={() => removeComponent(i)}>
                Remove Component
              </Button>
            </div>

            <div className="ml-4 mt-2">
              <h3 className="text-sm font-semibold mb-1">Children (Actions)</h3>
              {component.children.map((child, j) => (
                <div key={j} className="flex items-center space-x-2 mb-2">
                  <Input
                    value={child}
                    onChange={(e) => updateChild(i, j, e.target.value)}
                    placeholder="Action (e.g. view, edit)"
                    className="w-1/3"
                  />
                  <Button variant="outline" onClick={() => removeChild(i, j)}>Remove</Button>
                </div>
              ))}
              <Button variant="outline" onClick={() => addChild(i)}>+ Add Child</Button>
            </div>
          </div>
        ))}
      </div>

      {/* Save */}
      <div className="pt-6">
        <Button onClick={handleSave} className="bg-blue-600 text-white hover:bg-blue-500">
          Save Changes
        </Button>
      </div>
    </div>
  );
}