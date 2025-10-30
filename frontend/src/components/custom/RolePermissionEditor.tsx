import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import _ from "lodash";

interface PermissionNode {
  name: string;
  value?: boolean;
  children?: PermissionNode[];
}

interface Role {
  _id?: string;
  role_name: string;
  description?: string;
  permissions: PermissionNode[];
}

interface Props {
  role: Role;
  onSave?: (updatedPermissions: PermissionNode[]) => void;
  onChange?: (updatedPermissions: PermissionNode[]) => void;
}

export function RolePermissionEditor({ role, onSave, onChange }: Props) {
  const [permissions, setPermissions] = useState<PermissionNode[]>([]);

  // Initialize from role only once or when it actually changes
  useEffect(() => {
    setPermissions(_.cloneDeep(role.permissions || []));
  }, [role._id, role.role_name]); // ✅ avoids looping when permission changes

  const capitalize = (str: string) =>
    str
      .replace(/-/g, " ")
      .split(" ")
      .map(
        (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join(" ");

  const toggleValue = (nodes: PermissionNode[], path: string[]): PermissionNode[] => {
    return nodes.map((node) => {
      if (node.name === path[0]) {
        if (path.length === 1) {
          const newValue = !node.value;
          const updatedNode = {
            ...node,
            value: newValue,
            children: newValue
              ? node.children
                ? _.cloneDeep(node.children)
                : []
              : node.children
              ? toggleAll(node.children, false)
              : [],
          };
          return updatedNode;
        } else if (node.children) {
          const updatedChildren = toggleValue(node.children, path.slice(1));
          const anyChildTrue = updatedChildren.some(
            (child) => child.value || hasAnyTrueChild(child)
          );
          return {
            ...node,
            value: anyChildTrue || node.value,
            children: updatedChildren,
          };
        }
      }
      return node;
    });
  };

  const toggleAll = (nodes: PermissionNode[], value: boolean): PermissionNode[] =>
    nodes.map((node) => ({
      ...node,
      value,
      children: node.children ? toggleAll(node.children, value) : [],
    }));

  const hasAnyTrueChild = (node: PermissionNode): boolean => {
    if (node.value) return true;
    return node.children ? node.children.some(hasAnyTrueChild) : false;
  };

  const isPartiallyEnabled = (node: PermissionNode): boolean => {
    if (!node.children || node.children.length === 0) return false;
    const onCount = node.children.filter((child) => child.value).length;
    return onCount > 0 && onCount < node.children.length;
  };

  // 🔹 Handle toggle
  const handleToggle = (path: string[]) => {
    setPermissions((prev) => {
      const updated = toggleValue(prev, path);
      if (onChange) onChange(updated); // 🔥 trigger only on toggle
      return updated;
    });
  };

  const renderTree = (nodes: PermissionNode[], parentPath: string[] = []) => (
    <ul className="ml-6 space-y-1">
      {nodes.map((node) => {
        const fullPath = [...parentPath, node.name];
        const partial = isPartiallyEnabled(node);
        return (
          <li key={fullPath.join(".")}>
            <div className="flex items-center space-x-2">
              <Switch
                checked={!!node.value}
                onCheckedChange={() => handleToggle(fullPath)}
              />
              <span
                className={`${
                  partial ? "font-bold text-blue-800" : "font-medium"
                }`}
              >
                {capitalize(node.name)}
              </span>
            </div>
            {node.children && node.children.length > 0 && renderTree(node.children, fullPath)}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">
        Edit Permissions for {role.role_name}
      </h2>
      {renderTree(permissions)}

      {onSave && (
        <Button
          className="bg-blue-600 text-white hover:bg-blue-500"
          onClick={() => onSave(permissions)}
        >
          Save Permissions
        </Button>
      )}
    </div>
  );
}