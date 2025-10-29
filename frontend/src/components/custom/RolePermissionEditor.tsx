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
  _id: string;
  role_name: string;
  description?: string;
  permissions: PermissionNode[];
}

interface Props {
  role: Role;
  onSave: (updatedPermissions: PermissionNode[]) => void;
}

export function RolePermissionEditor({ role, onSave }: Props) {
  const [permissions, setPermissions] = useState<PermissionNode[]>([]);

  useEffect(() => {
    setPermissions(_.cloneDeep(role.permissions || []));
  }, [role]);

  const capitalize = (str: string) =>
    str
      .replace(/-/g, " ")
      .split(" ")
      .map((word) =>
        word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : ""
      )
      .join(" ");

  // -----------------------------
  // Recursive toggle handler
  // -----------------------------
  const toggleValue = (nodes: PermissionNode[], path: string[]): PermissionNode[] => {
    return nodes.map((node) => {
      if (node.name === path[0]) {
        if (path.length === 1) {
          // Leaf or direct toggle of this node
          const newValue = !node.value;

          if (!newValue) {
            // Turning OFF — apply to all children recursively
            return {
              ...node,
              value: false,
              children: node.children ? toggleAll(node.children, false) : [],
            };
          } else {
            // Turning ON — only this node changes, children untouched
            return {
              ...node,
              value: true,
              children: node.children ? _.cloneDeep(node.children) : [],
            };
          }
        } else if (node.children) {
          // Traverse deeper
          const updatedChildren = toggleValue(node.children, path.slice(1));

          // If any child true → parent true, else parent false
          const anyChildTrue = updatedChildren.some(
            (child) => child.value || hasAnyTrueChild(child)
          );

          return {
            ...node,
            value: anyChildTrue,
            children: updatedChildren,
          };
        }
      }
      return node;
    });
  };

  // Helper: recursively toggle all descendants
  const toggleAll = (nodes: PermissionNode[], value: boolean): PermissionNode[] =>
    nodes.map((node) => ({
      ...node,
      value,
      children: node.children ? toggleAll(node.children, value) : [],
    }));

  // Helper: check if any descendant is true
  const hasAnyTrueChild = (node: PermissionNode): boolean => {
    if (node.value) return true;
    return node.children ? node.children.some(hasAnyTrueChild) : false;
  };

  // Render tree recursively
  const renderTree = (nodes: PermissionNode[], parentPath: string[] = []) => (
    <ul className="ml-6 space-y-1">
      {nodes.map((node) => {
        const fullPath = [...parentPath, node.name];
        return (
          <li key={fullPath.join(".")}>
            <div className="flex items-center space-x-2">
              <Switch
                checked={!!node.value}
                onCheckedChange={() =>
                  setPermissions((prev) => toggleValue(prev, fullPath))
                }
              />
              <span className="font-medium">{capitalize(node.name)}</span>
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
      <Button
        className="bg-blue-600 text-white hover:bg-blue-500"
        onClick={() => onSave(permissions)}
      >
        Save Permissions
      </Button>
    </div>
  );
}