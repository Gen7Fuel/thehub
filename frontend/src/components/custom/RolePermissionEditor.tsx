// import { useState, useEffect } from "react";
// import { Button } from "@/components/ui/button";
// import { Check, X, ChevronDown, ChevronRight } from "lucide-react";
// import { camelCaseToCapitalized } from "@/lib/utils";
// import _ from "lodash";

// interface PermissionNode {
//   name: string;
//   value?: boolean;
//   children?: PermissionNode[];
//   collapsed?: boolean;
// }

// interface Role {
//   _id?: string;
//   role_name: string;
//   description?: string;
//   permissions: PermissionNode[];
// }

// interface Props {
//   role: Role;
//   onSave?: (updatedPermissions: PermissionNode[]) => void;
//   onChange?: (updatedPermissions: PermissionNode[]) => void;
//   fromUserPage?: boolean;
// }

// export function RolePermissionEditor({
//   role,
//   onSave,
//   onChange,
//   fromUserPage,
// }: Props) {
//   const [permissions, setPermissions] = useState<PermissionNode[]>([]);

//   // Initialize collapsed state
//   const initializeCollapsed = (nodes: PermissionNode[]): PermissionNode[] =>
//     nodes.map((n) => ({
//       ...n,
//       collapsed: true,
//       children: n.children ? initializeCollapsed(n.children) : [],
//     }));
//   // Recursive sort helper
//   const sortPermissionsRecursively = (nodes: PermissionNode[]): PermissionNode[] => {
//     return [...nodes]
//       .sort((a, b) => a.name.localeCompare(b.name))
//       .map((n) => ({
//         ...n,
//         children: n.children ? sortPermissionsRecursively(n.children) : [],
//       }));
//   };

//   // Load role.permissions into state while preserving collapsed state
//   useEffect(() => {
//     setPermissions((prev) => {
//       const unsorted_permissions = _.cloneDeep(role.permissions || []);
//       const newPermissions = sortPermissionsRecursively(unsorted_permissions);
//       const applyCollapseState = (
//         newNodes: PermissionNode[],
//         oldNodes: PermissionNode[]
//       ): PermissionNode[] => {
//         return newNodes.map((n) => {
//           const oldMatch = oldNodes.find((o) => o.name === n.name);
//           return {
//             ...n,
//             collapsed: oldMatch?.collapsed ?? true,
//             children: n.children
//               ? applyCollapseState(n.children, oldMatch?.children || [])
//               : [],
//           };
//         });
//       };

//       return prev.length === 0
//         ? initializeCollapsed(newPermissions)
//         : applyCollapseState(newPermissions, prev);
//     });
//   }, [role._id, role.role_name, role.permissions]);

//   // --- Permission Logic ---
//   const toggleAll = (nodes: PermissionNode[], value: boolean): PermissionNode[] =>
//     nodes.map((n) => ({
//       ...n,
//       value,
//       children: n.children ? toggleAll(n.children, value) : [],
//     }));

//   const hasAnyTrueChild = (node: PermissionNode): boolean =>
//     node.value || (node.children ? node.children.some(hasAnyTrueChild) : false);

//   // This updates a node's value and propagates true upwards
//   const setPermissionValue = (path: string[], value: boolean) => {
//     const update = (nodes: PermissionNode[], path: string[]): PermissionNode[] =>
//       nodes.map((node) => {
//         if (node.name === path[0]) {
//           if (path.length === 1) {
//             // Toggle node itself
//             return {
//               ...node,
//               value,
//               children: node.children ? (value ? node.children : toggleAll(node.children, false)) : [],
//             };
//           } else if (node.children) {
//             // Recurse into child
//             const updatedChildren = update(node.children, path.slice(1));
//             const anyChildTrue = updatedChildren.some((c) => c.value || hasAnyTrueChild(c));
//             return {
//               ...node,
//               value: node.value || anyChildTrue, // propagate true upwards
//               children: updatedChildren,
//             };
//           }
//         }
//         return node;
//       });

//     setPermissions((prev) => {
//       const updated = update(prev, path);
//       if (onChange) onChange(updated);
//       return updated;
//     });
//   };

//   const toggleCollapse = (path: string[]) => {
//     const update = (nodes: PermissionNode[], path: string[]): PermissionNode[] =>
//       nodes.map((n) => {
//         if (n.name === path[0]) {
//           if (path.length === 1) return { ...n, collapsed: !n.collapsed };
//           else if (n.children) return { ...n, children: update(n.children, path.slice(1)) };
//         }
//         return n;
//       });
//     setPermissions((prev) => update(prev, path));
//   };

//   // --- Render ---
//   const renderTree = (nodes: PermissionNode[], parentPath: string[] = []) => (
//     <ul className="space-y-2 ml-4">
//       {nodes.map((node) => {
//         const fullPath = [...parentPath, node.name];
//         const hasChildren = node.children && node.children.length > 0;

//         const nodeValue = node.value ?? false;
//         const anyChildTrue = node.children ? node.children.some(hasAnyTrueChild) : false;
//         const allChildrenTrue = node.children ? node.children.every((c) => c.value) : false;

//         // Partial font logic
//         const isPartial = nodeValue && !allChildrenTrue;

//         const bgClass = nodeValue
//           ? "bg-green-100 border-green-400"
//           : anyChildTrue
//           ? "bg-blue-50 border-blue-300 opacity-80"
//           : "bg-gray-50 border-gray-300 opacity-60";

//         const fontClass = isPartial ? "text-blue-700 font-semibold" : "text-gray-900 font-medium";

//         return (
//           <li key={fullPath.join(".")}>
//             <div
//               className={`flex items-center p-2 border rounded-md shadow-sm space-x-2 transition-colors ${bgClass}`}
//             >
//               {hasChildren ? (
//                 <button onClick={() => toggleCollapse(fullPath)}>
//                   {node.collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
//                 </button>
//               ) : (
//                 <div className="w-4" />
//               )}

//               <span className={`flex-1 ${fontClass}`}>{camelCaseToCapitalized(node.name)}</span>

//               <div className="flex items-center space-x-2">
//                 <Button
//                   size="sm"
//                   variant="ghost"
//                   className={`${
//                     nodeValue
//                       ? "bg-green-500 text-white"
//                       : "text-green-600 border border-green-500"
//                   }`}
//                   onClick={() => setPermissionValue(fullPath, true)}
//                 >
//                   <Check size={14} />
//                 </Button>

//                 <Button
//                   size="sm"
//                   variant="ghost"
//                   className={`${
//                     !nodeValue
//                       ? "bg-red-500 text-white"
//                       : "text-red-600 border border-red-500"
//                   }`}
//                   onClick={() => setPermissionValue(fullPath, false)}
//                 >
//                   <X size={14} />
//                 </Button>
//               </div>
//             </div>

//             {!node.collapsed && hasChildren && renderTree(node.children || [], fullPath)}
//           </li>
//         );
//       })}
//     </ul>
//   );

//   return (
//     <div className="p-6 space-y-4 max-w-3xl mx-auto bg-gray-50 rounded-lg shadow-sm">
//       {!fromUserPage && (
//         <h2 className="text-2xl font-semibold">Edit Permissions for {role.role_name}</h2>
//       )}

//       {renderTree(permissions)}

//       {onSave && (
//         <div className="pt-6">
//           <Button
//             onClick={() => onSave(permissions)}
//             className="bg-blue-600 text-white hover:bg-blue-500"
//           >
//             Save Permissions
//           </Button>
//         </div>
//       )}
//     </div>
//   );
// }
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronRight,
  CheckSquare,
  MinusSquare,
  Square,
} from "lucide-react";
import { camelCaseToCapitalized } from "@/lib/utils";
import _ from "lodash";

interface PermissionNode {
  name: string;
  value?: boolean;
  permId: number;
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

  const initializeCollapsed = (nodes: PermissionNode[]): PermissionNode[] =>
    nodes.map((n) => ({
      ...n,
      collapsed: true,
      children: n.children ? initializeCollapsed(n.children) : [],
    }));

  const sortPermissionsRecursively = (nodes: PermissionNode[]): PermissionNode[] =>
    [...nodes]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((n) => ({
        ...n,
        children: n.children ? sortPermissionsRecursively(n.children) : [],
      }));

  useEffect(() => {
    setPermissions((prev) => {
      const unsorted = _.cloneDeep(role.permissions || []);
      const newPermissions = sortPermissionsRecursively(unsorted);

      const applyCollapseState = (
        newNodes: PermissionNode[],
        oldNodes: PermissionNode[]
      ): PermissionNode[] =>
        newNodes.map((n) => {
          const oldMatch = oldNodes.find((o) => o.name === n.name);
          return {
            ...n,
            collapsed: oldMatch?.collapsed ?? true,
            children: n.children
              ? applyCollapseState(n.children, oldMatch?.children || [])
              : [],
          };
        });

      return prev.length === 0
        ? initializeCollapsed(newPermissions)
        : applyCollapseState(newPermissions, prev);
    });
  }, [role._id, role.role_name, role.permissions]);

  // Helper: set all descendants of node to value (used when parent unchecked)
  const setAllDescendants = (node: PermissionNode, value: boolean): PermissionNode => {
    return {
      ...node,
      value,
      children: node.children ? node.children.map((c) => setAllDescendants(c, value)) : [],
    };
  };

  // Helper: check if any descendant (any depth) is true
  const anyDescendantTrue = (node: PermissionNode): boolean => {
    if (node.children && node.children.length) {
      return node.children.some((c) => (c.value ? true : anyDescendantTrue(c)));
    }
    return false;
  };

  /**
   * setPermissionValue rules:
   * - If toggling a node to true:
   *   - If it's a parent (has children) and user clicked parent => set only that node to true (do NOT touch children).
   *   - If it's a child (path deeper) => set that node true and propagate true up the branch (ancestors become true).
   *
   * - If toggling a node to false:
   *   - If user clicked parent => set parent false and set ALL descendants false.
   *   - If user clicked child => set only that child false (do NOT change parent).
   */
  const setPermissionValue = (path: string[], value: boolean) => {
    const update = (
      nodes: PermissionNode[],
      path: string[],
      depth = 0
    ): { nodes: PermissionNode[]; changedUp: boolean } => {
      let changedUp = false;

      const updatedNodes = nodes.map((node) => {
        if (node.name !== path[0]) return node;

        // found matching node at this level
        if (path.length === 1) {
          if (value) {
            // toggling true
            // parent → only itself
            changedUp = true; // true should bubble upward
            return { ...node, value: true };
          } else {
            // toggling false
            // parent → uncheck itself + all descendants
            return setAllDescendants(node, false);
          }
        } else {
          // deeper recursion into children
          if (!node.children) return node;
          const { nodes: updatedChildren, changedUp: childChangedUp } = update(
            node.children,
            path.slice(1),
            depth + 1
          );

          // propagate true upward only if a child was newly checked
          let newValue = node.value || childChangedUp;

          return {
            ...node,
            value: newValue,
            children: updatedChildren,
          };
        }
      });

      return { nodes: updatedNodes, changedUp };
    };

    setPermissions((prev) => {
      const { nodes: newTree } = update(prev, path);
      if (onChange) onChange(newTree);
      return newTree;
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

  // Row component (hooks safe here if needed later)
const PermissionRow = ({ node, path }: { node: PermissionNode; path: string[] }) => {
  const hasChildren = node.children && node.children.length > 0;
  const nodeValue = !!node.value;

  // Helper: check if ALL descendants are checked
  const allDescendantsTrue = (n: PermissionNode): boolean => {
    if (!n.children || n.children.length === 0) return !!n.value;
    return n.children.every(allDescendantsTrue);
  };

  // Helper: check if ANY descendant is checked
  const anyDescendantTrue = (n: PermissionNode): boolean => {
    if (!n.children || n.children.length === 0) return !!n.value;
    return n.children.some(anyDescendantTrue);
  };

  const anyTrue = nodeValue || anyDescendantTrue(node);
  const allTrue = allDescendantsTrue(node);

  let bgClass = "bg-gray-50 border-gray-300";
  let Icon = Square;
  let iconColor = "text-gray-400";

  if (anyTrue) {
    if (allTrue) {
      bgClass = "bg-green-50 border-green-400";
      Icon = CheckSquare;
      iconColor = "text-green-600";
    } else {
      bgClass = "bg-yellow-50 border-yellow-400";
      Icon = MinusSquare;
      iconColor = "text-yellow-500";
    }
  }

  // const handleClick = () => setPermissionValue(path, !nodeValue);
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    setPermissionValue(path, !nodeValue);
  };


  return (
    <li key={path.join(".")}>
      <div
        className={`flex items-center justify-between p-2 border rounded-md shadow-sm transition-colors ${bgClass}`}
      >
        <div className="flex items-center space-x-2">
          {/* {hasChildren ? (
            <button onClick={() => toggleCollapse(path)} aria-label="toggle">
              {node.collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            </button>
          ) : (
            <div className="w-4" />
          )} */}
          {hasChildren ? (
            <button type="button" onClick={() => toggleCollapse(path)} aria-label="toggle">
              {node.collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            </button>
          ) : (
            <div className="w-4" />
          )}

          <span className="flex-1 text-gray-900 font-medium">
            {camelCaseToCapitalized(node.name)}
          </span>
        </div>

        {/* <button
          onClick={handleClick}
          className="flex items-center justify-center px-2 py-1 rounded hover:opacity-90 active:scale-95"
          aria-pressed={nodeValue}
          aria-label={nodeValue ? "Unset permission" : "Set permission"}
        >
          <Icon size={22} className={iconColor} />
        </button> */}
        <button
          type="button"
          onClick={handleClick}
          className="flex items-center justify-center px-2 py-1 rounded hover:opacity-90 active:scale-95"
          aria-pressed={nodeValue}
          aria-label={nodeValue ? "Unset permission" : "Set permission"}
        >
          <Icon size={22} className={iconColor} />
        </button>
      </div>

      {!node.collapsed && hasChildren && (
        <ul className="ml-4 space-y-2">
          {node.children!.map((child) => (
            <PermissionRow key={child.name} node={child} path={[...path, child.name]} />
          ))}
        </ul>
      )}
    </li>
  );
};


  const renderTree = (nodes: PermissionNode[], parentPath: string[] = []) => (
    <ul className="space-y-2 ml-4">
      {nodes.map((n) => (
        <PermissionRow key={n.name} node={n} path={[...parentPath, n.name]} />
      ))}
    </ul>
  );

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto bg-gray-50 rounded-lg shadow-sm">
      {!fromUserPage && <h2 className="text-2xl font-semibold">Edit Permissions for {role.role_name}</h2>}

      {renderTree(permissions)}

      {onSave && (
        <div className="pt-6 text-right">
          <Button onClick={() => onSave(permissions)} className="bg-blue-600 text-white hover:bg-blue-500">
            Save Permissions
          </Button>
        </div>
      )}
    </div>
  );
}