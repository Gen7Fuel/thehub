import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check, X, ChevronDown, ChevronRight } from "lucide-react";
import { camelCaseToCapitalized } from "@/lib/utils";
import _ from "lodash";

interface PermissionNode {
  name: string;
  value?: boolean;
  children?: PermissionNode[];
  collapsed?: boolean;
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
  fromUserPage?: boolean;
}

export function RolePermissionEditor({
  role,
  onSave,
  onChange,
  fromUserPage,
}: Props) {
  const [permissions, setPermissions] = useState<PermissionNode[]>([]);

  // Initialize collapsed state
  const initializeCollapsed = (nodes: PermissionNode[]): PermissionNode[] =>
    nodes.map((n) => ({
      ...n,
      collapsed: true,
      children: n.children ? initializeCollapsed(n.children) : [],
    }));
  // Recursive sort helper
  const sortPermissionsRecursively = (nodes: PermissionNode[]): PermissionNode[] => {
    return [...nodes]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((n) => ({
        ...n,
        children: n.children ? sortPermissionsRecursively(n.children) : [],
      }));
  };

  // Load role.permissions into state while preserving collapsed state
  useEffect(() => {
    setPermissions((prev) => {
      const unsorted_permissions = _.cloneDeep(role.permissions || []);
      const newPermissions = sortPermissionsRecursively(unsorted_permissions);
      const applyCollapseState = (
        newNodes: PermissionNode[],
        oldNodes: PermissionNode[]
      ): PermissionNode[] => {
        return newNodes.map((n) => {
          const oldMatch = oldNodes.find((o) => o.name === n.name);
          return {
            ...n,
            collapsed: oldMatch?.collapsed ?? true,
            children: n.children
              ? applyCollapseState(n.children, oldMatch?.children || [])
              : [],
          };
        });
      };

      return prev.length === 0
        ? initializeCollapsed(newPermissions)
        : applyCollapseState(newPermissions, prev);
    });
  }, [role._id, role.role_name, role.permissions]);

  // --- Permission Logic ---
  const toggleAll = (nodes: PermissionNode[], value: boolean): PermissionNode[] =>
    nodes.map((n) => ({
      ...n,
      value,
      children: n.children ? toggleAll(n.children, value) : [],
    }));

  const hasAnyTrueChild = (node: PermissionNode): boolean =>
    node.value || (node.children ? node.children.some(hasAnyTrueChild) : false);

  // This updates a node's value and propagates true upwards
  const setPermissionValue = (path: string[], value: boolean) => {
    const update = (nodes: PermissionNode[], path: string[]): PermissionNode[] =>
      nodes.map((node) => {
        if (node.name === path[0]) {
          if (path.length === 1) {
            // Toggle node itself
            return {
              ...node,
              value,
              children: node.children ? (value ? node.children : toggleAll(node.children, false)) : [],
            };
          } else if (node.children) {
            // Recurse into child
            const updatedChildren = update(node.children, path.slice(1));
            const anyChildTrue = updatedChildren.some((c) => c.value || hasAnyTrueChild(c));
            return {
              ...node,
              value: node.value || anyChildTrue, // propagate true upwards
              children: updatedChildren,
            };
          }
        }
        return node;
      });

    setPermissions((prev) => {
      const updated = update(prev, path);
      if (onChange) onChange(updated);
      return updated;
    });
  };

  const toggleCollapse = (path: string[]) => {
    const update = (nodes: PermissionNode[], path: string[]): PermissionNode[] =>
      nodes.map((n) => {
        if (n.name === path[0]) {
          if (path.length === 1) return { ...n, collapsed: !n.collapsed };
          else if (n.children) return { ...n, children: update(n.children, path.slice(1)) };
        }
        return n;
      });
    setPermissions((prev) => update(prev, path));
  };

  // --- Render ---
  const renderTree = (nodes: PermissionNode[], parentPath: string[] = []) => (
    <ul className="space-y-2 ml-4">
      {nodes.map((node) => {
        const fullPath = [...parentPath, node.name];
        const hasChildren = node.children && node.children.length > 0;

        const nodeValue = node.value ?? false;
        const anyChildTrue = node.children ? node.children.some(hasAnyTrueChild) : false;
        const allChildrenTrue = node.children ? node.children.every((c) => c.value) : false;

        // Partial font logic
        const isPartial = nodeValue && !allChildrenTrue;

        const bgClass = nodeValue
          ? "bg-green-100 border-green-400"
          : anyChildTrue
          ? "bg-blue-50 border-blue-300 opacity-80"
          : "bg-gray-50 border-gray-300 opacity-60";

        const fontClass = isPartial ? "text-blue-700 font-semibold" : "text-gray-900 font-medium";

        return (
          <li key={fullPath.join(".")}>
            <div
              className={`flex items-center p-2 border rounded-md shadow-sm space-x-2 transition-colors ${bgClass}`}
            >
              {hasChildren ? (
                <button onClick={() => toggleCollapse(fullPath)}>
                  {node.collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                </button>
              ) : (
                <div className="w-4" />
              )}

              <span className={`flex-1 ${fontClass}`}>{camelCaseToCapitalized(node.name)}</span>

              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className={`${
                    nodeValue
                      ? "bg-green-500 text-white"
                      : "text-green-600 border border-green-500"
                  }`}
                  onClick={() => setPermissionValue(fullPath, true)}
                >
                  <Check size={14} />
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  className={`${
                    !nodeValue
                      ? "bg-red-500 text-white"
                      : "text-red-600 border border-red-500"
                  }`}
                  onClick={() => setPermissionValue(fullPath, false)}
                >
                  <X size={14} />
                </Button>
              </div>
            </div>

            {!node.collapsed && hasChildren && renderTree(node.children || [], fullPath)}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto bg-gray-50 rounded-lg shadow-sm">
      {!fromUserPage && (
        <h2 className="text-2xl font-semibold">Edit Permissions for {role.role_name}</h2>
      )}

      {renderTree(permissions)}

      {onSave && (
        <div className="pt-6">
          <Button
            onClick={() => onSave(permissions)}
            className="bg-blue-600 text-white hover:bg-blue-500"
          >
            Save Permissions
          </Button>
        </div>
      )}
    </div>
  );
}