// import { useState, useEffect } from "react";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";

// interface PermissionNode {
//   name: string;            // stored as camelCase
//   displayName?: string;    // what user types (with spaces)
//   children: PermissionNode[];
//   collapsed?: boolean;
// }

// interface Permission {
//   _id?: string;
//   module_name: string;
//   structure: PermissionNode[];
// }

// export function PermissionTree({
//   permission,
//   onSave,
// }: {
//   permission: Permission;
//   onSave: (updated: PermissionNode[], moduleName: string, oldModuleName: string) => void;
// }) {
//   const [moduleName, setModuleName] = useState(permission.module_name);
//   const [oldModuleName] = useState(permission.module_name);
//   const [structure, setStructure] = useState<PermissionNode[]>(permission.structure || []);
//   const [focusedPath, setFocusedPath] = useState<number[] | null>(null);

//   const toCamelCase = (str: string) => {
//     if (!str) return "";
//     return str
//       .replace(/[-_]+/g, " ")
//       .toLowerCase()
//       .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
//         index === 0 ? word.toLowerCase() : word.toUpperCase()
//       )
//       .replace(/\s+/g, "");
//   };

//   const fromCamelCase = (str: string) => {
//     if (!str) return "";
//     return str
//       .replace(/([A-Z])/g, " $1")
//       .replace(/\s+/g, " ")
//       .trim();  // remove .replace(/^./, ...) to keep first letter lowercase if typed
//   };



//   const initializeCollapsed = (nodes: PermissionNode[]): PermissionNode[] =>
//     nodes.map((node) => ({
//       ...node,
//       collapsed: true,
//       displayName: node.displayName || fromCamelCase(node.name),
//       children: initializeCollapsed(node.children),
//     }));

//   useEffect(() => {
//     setModuleName(permission.module_name);
//     setStructure(initializeCollapsed(permission.structure));
//   }, [permission]);

//   const updateNodeName = (path: number[], value: string) => {
//     const updated = [...structure];
//     let node = updated;
//     path.forEach((i, idx) => {
//       if (idx === path.length - 1) {
//         node[i].displayName = value.replace(/\s+/g, " ");  // normalize multiple spaces
//         node[i].name = toCamelCase(node[i].displayName);
//       } else {
//         node = node[i].children;
//       }
//     });
//     setStructure(updated);
//   };


//   const toggleCollapse = (path: number[]) => {
//     const updated = [...structure];
//     let node = updated;
//     path.forEach((i, idx) => {
//       if (idx === path.length - 1) node[i].collapsed = !node[i].collapsed;
//       else node = node[i].children;
//     });
//     setStructure(updated);
//   };

//   const addChildNode = (path: number[]) => {
//     const updated = [...structure];
//     let node = updated;
//     path.forEach((i) => (node = node[i].children));
//     node.push({ name: "", children: [], collapsed: false });
//     setStructure(updated);
//   };

//   const removeNode = (path: number[]) => {
//     const updated = [...structure];
//     if (path.length === 1) updated.splice(path[0], 1);
//     else {
//       let node = updated;
//       path.slice(0, -1).forEach((i) => (node = node[i].children));
//       node.splice(path[path.length - 1], 1);
//     }
//     setStructure(updated);
//   };

//   // Capitalize + replace hyphens with spaces
//   // const capitalize = (str: string) => {
//   //   if (!str) return "";
//   //   return str
//   //     .replace(/-/g, " ")
//   //     .split(" ")
//   //     .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : ""))
//   //     .join(" ");
//   // };
//   // const toCamelCase = (str: string) => {
//   //   if (!str) return "";
//   //   return str
//   //     .replace(/[-_]+/g, " ")
//   //     .toLowerCase()
//   //     .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
//   //       index === 0 ? word.toLowerCase() : word.toUpperCase()
//   //     )
//   //     .replace(/\s+/g, "");
//   // };
//   // const fromCamelCase = (str: string) => {
//   //   if (!str) return "";
//   //   return str
//   //     .replace(/([A-Z])/g, " $1")
//   //     .replace(/^./, (s) => s.toUpperCase())
//   //     .trim();
//   // };



//   // Helper: get the top-level index for any path
//   const getRootIndex = (path: number[]) => path[0];

//   // Recursive render
//   const renderTree = (nodes: PermissionNode[], path: number[] = []) => (
//     <ul className="space-y-2 ml-4">
//       {nodes.map((node, i) => {
//         const currentPath = [...path, i];
//         const rootIndex = getRootIndex(currentPath);
//         const isFocusedBranch =
//           focusedPath && getRootIndex(focusedPath) === rootIndex;
//         const isOtherBranch =
//           focusedPath && getRootIndex(focusedPath) !== rootIndex;

//         return (
//           <li key={i}>
//             <div
//               className={`flex items-center p-2 border rounded-md shadow-sm space-x-2 transition-colors
//               ${isFocusedBranch ? "bg-blue-50 border-blue-400" : ""}
//               ${isOtherBranch ? "opacity-40 bg-gray-100" : "bg-white"}
//             `}
//             >
//               {node.children.length > 0 ? (
//                 <button onClick={() => toggleCollapse(currentPath)}>
//                   {node.collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
//                 </button>
//               ) : (
//                 <div className="w-4" />
//               )}

//               {/* <Input
//                 value={capitalize(node.name)}
//                 onChange={(e) => updateNodeName(currentPath, e.target.value)}
//                 onFocus={() => setFocusedPath(currentPath)}
//                 onBlur={() => setFocusedPath(null)}
//                 placeholder="Click to name this permission"
//                 className="flex-1 max-w-xs"
//               /> */}
//               <div className="flex flex-col space-y-1 flex-1 max-w-xs">
//                 <Input
//                   value={node.displayName || ""}
//                   onChange={(e) => updateNodeName(currentPath, e.target.value)}
//                   onFocus={() => setFocusedPath(currentPath)}
//                   onBlur={() => setFocusedPath(null)}
//                   placeholder="Click to name this permission"
//                 />
//                 {node.displayName && (
//                   <span className="text-xs text-gray-500 italic ml-1">
//                     "{node.name}"
//                   </span>
//                 )}
//               </div>

//               <Button size="sm" variant="outline" onClick={() => addChildNode(currentPath)}>
//                 <Plus size={14} />
//               </Button>
//               <Button size="sm" variant="destructive" onClick={() => removeNode(currentPath)}>
//                 <Trash2 size={14} />
//               </Button>
//             </div>

//             {!node.collapsed && node.children.length > 0 && renderTree(node.children, currentPath)}
//           </li>
//         );
//       })}
//     </ul>
//   );

//   return (
//     <div className="p-6 space-y-4 max-w-3xl mx-auto bg-gray-50 rounded-lg shadow-sm">
//       <h1 className="text-2xl font-semibold">Edit Permission</h1>

//       <div>
//         <label className="block text-gray-700 mb-1 font-medium">Module Name</label>
//         <div className="flex flex-col space-y-1 w-1/2">
//           <Input
//             value={fromCamelCase(moduleName)}       // display human-readable
//             onChange={(e) => setModuleName(e.target.value)}
//             placeholder="Module Name"
//           />
//           {moduleName && (
//             <span className="text-xs text-gray-500 italic ml-1">
//               "{moduleName}"                       
//             </span>
//           )}
//         </div>
//       </div>

//       <div className="mt-4">
//         <div className="flex justify-between items-center mb-2">
//           <h2 className="text-lg font-semibold">Permission Tree</h2>
//           <Button
//             variant="outline"
//             onClick={() =>
//               setStructure([...structure, { name: "", children: [], collapsed: false }])
//             }
//           >
//             <Plus size={14} /> Add Root Node
//           </Button>
//         </div>
//         {renderTree(structure)}
//       </div>

//       <div className="pt-6">
//         <Button
//           onClick={() => onSave(structure, toCamelCase(moduleName), oldModuleName)}
//           className="bg-blue-600 text-white hover:bg-blue-500"
//         >
//           Save Changes
//         </Button>
//       </div>
//     </div>
//   );
// }

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { camelCaseToCapitalized } from "@/lib/utils";

interface PermissionNode {
  name: string;            // stored in camelCase in backend
  children: PermissionNode[];
  collapsed?: boolean;
}

interface Permission {
  _id?: string;
  module_name: string;
  structure: PermissionNode[];
}

export function PermissionTree({
  permission,
  onSave,
}: {
  permission: Permission;
  onSave: (updated: PermissionNode[], moduleName: string, oldModuleName: string) => void;
}) {
  const [moduleName, setModuleName] = useState(permission.module_name);
  const [oldModuleName] = useState(permission.module_name);
  const [structure, setStructure] = useState<PermissionNode[]>(permission.structure || []);
  const [focusedPath, setFocusedPath] = useState<number[] | null>(null);
  const isCamelCase = (str: string) => /^[a-z][A-Za-z0-9]*$/.test(str);


  // Convert any string to camelCase for storing
  const toCamelCase = (str: string) => {
    if (!str) return "";
    if (isCamelCase(str)) return str; // already camelCase, return as-is
    return str
      .replace(/[-_]+/g, " ")
      .trim()
      .toLowerCase()
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
        index === 0 ? word.toLowerCase() : word.toUpperCase()
      )
      .replace(/\s+/g, "");
  };
  const convertTreeToCamelCase = (nodes: PermissionNode[]): PermissionNode[] => {
    return nodes.map(node => ({
      ...node,
      name: isCamelCase(node.name) ? node.name : toCamelCase(node.name),
      children: convertTreeToCamelCase(node.children),
    }));
  };
   



  const initializeCollapsed = (nodes: PermissionNode[]): PermissionNode[] =>
    nodes.map((node) => ({
      ...node,
      collapsed: true,
      children: initializeCollapsed(node.children),
    }));

  useEffect(() => {
    setModuleName(permission.module_name);
    setStructure(initializeCollapsed(permission.structure));
  }, [permission]);

  const updateNodeName = (path: number[], value: string) => {
    const updated = [...structure];
    let node = updated;
    path.forEach((i, idx) => {
      if (idx === path.length - 1) {
        node[i].name = value; // show whatever user typed in input
      } else {
        node = node[i].children;
      }
    });
    setStructure(updated);
  };

  const toggleCollapse = (path: number[]) => {
    const updated = [...structure];
    let node = updated;
    path.forEach((i, idx) => {
      if (idx === path.length - 1) node[i].collapsed = !node[i].collapsed;
      else node = node[i].children;
    });
    setStructure(updated);
  };

  const addChildNode = (path: number[]) => {
    const updated = [...structure];
    let node = updated;
    path.forEach((i) => (node = node[i].children));
    node.push({ name: "", children: [], collapsed: false });
    setStructure(updated);
  };

  const removeNode = (path: number[]) => {
    const updated = [...structure];
    if (path.length === 1) updated.splice(path[0], 1);
    else {
      let node = updated;
      path.slice(0, -1).forEach((i) => (node = node[i].children));
      node.splice(path[path.length - 1], 1);
    }
    setStructure(updated);
  };

  // Helper: get top-level index
  const getRootIndex = (path: number[]) => path[0];

  // Recursive render
  const renderTree = (nodes: PermissionNode[], path: number[] = []) => (
    <ul className="space-y-2 ml-4">
      {nodes.map((node, i) => {
        const currentPath = [...path, i];
        const rootIndex = getRootIndex(currentPath);
        const isFocusedBranch = focusedPath && getRootIndex(focusedPath) === rootIndex;
        const isOtherBranch = focusedPath && getRootIndex(focusedPath) !== rootIndex;

        return (
          <li key={i}>
            <div
              className={`flex items-center p-2 border rounded-md shadow-sm space-x-2 transition-colors
              ${isFocusedBranch ? "bg-blue-50 border-blue-400" : ""}
              ${isOtherBranch ? "opacity-40 bg-gray-100" : "bg-white"}`}
            >
              {node.children.length > 0 ? (
                <button onClick={() => toggleCollapse(currentPath)}>
                  {node.collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                </button>
              ) : (
                <div className="w-4" />
              )}

              <div className="flex flex-col space-y-1 flex-1 max-w-xs">
                <Input
                  value={camelCaseToCapitalized(node.name)}
                  onChange={(e) => updateNodeName(currentPath, e.target.value)}
                  onFocus={() => setFocusedPath(currentPath)}
                  onBlur={() => setFocusedPath(null)}
                  placeholder="Click to name this permission"
                />
                {node.name && (
                  <span className="text-xs text-gray-500 italic ml-1">
                    "{toCamelCase(node.name)}"
                  </span>
                )}
              </div>

              <Button size="sm" variant="outline" onClick={() => addChildNode(currentPath)}>
                <Plus size={14} />
              </Button>
              <Button size="sm" variant="destructive" onClick={() => removeNode(currentPath)}>
                <Trash2 size={14} />
              </Button>
            </div>

            {!node.collapsed && node.children.length > 0 && renderTree(node.children, currentPath)}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto bg-gray-50 rounded-lg shadow-sm">
      <h1 className="text-2xl font-semibold">Edit Permission</h1>

      <div>
        <label className="block text-gray-700 mb-1 font-medium">Module Name</label>
        <div className="flex flex-col space-y-1 w-1/2">
          <Input
            value={camelCaseToCapitalized(moduleName)} // show backend value
            onChange={(e) => setModuleName(e.target.value)} // user can type freely
            placeholder="Module Name"
          />
          {moduleName && (
            <span className="text-xs text-gray-500 italic ml-1">
              "{toCamelCase(moduleName)}" {/* show camelCase equivalent */}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold">Permission Tree</h2>
          <Button
            variant="outline"
            onClick={() => setStructure([...structure, { name: "", children: [], collapsed: false }])}
          >
            <Plus size={14} /> Add Root Node
          </Button>
        </div>
        {renderTree(structure)}
      </div>

      <div className="pt-6">
        <Button
          onClick={() =>
            onSave(convertTreeToCamelCase(structure), toCamelCase(moduleName), oldModuleName)
          }
          className="bg-blue-600 text-white hover:bg-blue-500"
        >
          Save Changes
        </Button>
      </div>
    </div>
  );
}
