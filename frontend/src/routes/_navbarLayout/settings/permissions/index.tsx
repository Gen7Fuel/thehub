// import { createFileRoute, Outlet } from "@tanstack/react-router";
// import axios from "axios";
// import { useState } from "react";
// import { Pencil } from "lucide-react";
// import { useAuth } from "@/context/AuthContext";
// import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogTrigger,} from "@/components/ui/dialog";
// import { Button } from "@/components/ui/button";


// export const Route = createFileRoute("/_navbarLayout/settings/permissions/")({
//   component: RouteComponent,
//   loader: async () => {
//     try {
//       const response = await axios.get("/api/permissions", {
//         headers: {
//           Authorization: `Bearer ${localStorage.getItem("token")}`,
//         },
//       });
//       // console.log("Permissions response:", response.data); 
//       return { permissions: response.data };
//     } catch (error) {
//       console.error("Error fetching permissions:", error);
//       return { permissions: [] };
//     }
//   },
// });

// interface Permission {
//   _id: string;
//   name: string;
//   sites?: string[];
// }

// export const hasAccess = (access: any, key: string): boolean => {
//   if (!access || typeof access !== "object") return false;
//   return Boolean(access[key]);
// };


// function RouteComponent() {
//   const { permissions } = Route.useLoaderData() as {
//     permissions: Permission[];
//   };
  
//   const { user } = useAuth();
//   if (user) {
//     console.log("email:", user.access);
//   } else {
//     console.log("No user logged in");
//   }

//   const [newPermission, setNewPermission] = useState("");
//   const [status, setStatus] = useState<string | null>(null);

//   const handleAdd = async (e: React.FormEvent) => {
//     e.preventDefault();
//     try {
//       const response = await axios.post(
//         "/api/permissions",
//         { name: newPermission },
//         {
//           headers: {
//             Authorization: `Bearer ${localStorage.getItem("token")}`,
//           },
//         }
//       );
//       alert(response.data.message); // Add and Sync confirmation
//       setStatus("Permission added!");
//       setNewPermission("");
//       window.location.reload();
//     } catch (err) {
//       console.error(err);
//       setStatus("Failed to add permission");
//     }
//   };

//   const handleDelete = async (id: string) => {
//     if (!window.confirm("Are you sure you want to delete this permission?")) {
//       return; // user canceled
//     }

//     try {
//       await axios.delete(`/api/permissions/${id}`, {
//         headers: {
//           Authorization: `Bearer ${localStorage.getItem("token")}`,
//         },
//       });
//       setStatus("Permission deleted!");
//       window.location.reload();
//     } catch (err) {
//       console.error(err);
//       setStatus("Failed to delete permission");
//     }
//   };

//   const handleSync = async () => {
//     try {
//       const res = await axios.post(
//         "/api/permissions/sync",
//         {},
//         { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
//       );
//       alert(res.data.message);
//       setStatus(res.data.message);
//       window.location.reload();
//     } catch (err) {
//       console.error(err);
//       setStatus("Failed to sync permissions");
//     }
//   };

// const handleEdit = async (id: string, currentName: string) => {
//   const newName = prompt(`Rename permission '${currentName}' to:`, currentName);
//   if (!newName) return; // canceled
//   if (newName.trim() === currentName.trim()) return;

//   try {
//     const response = await axios.put(
//       `/api/permissions/${id}`,
//       { newName: newName.trim() },
//       { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
//     );

//     // show success details: use alert to be visible
//     const msg = response.data?.message || "Permission renamed successfully";
//     alert(msg + (response.data?.usersModified !== undefined ? `\nUsers modified: ${response.data.usersModified}` : ""));
//     setStatus((response.data?.message || "Renamed"));
//     window.location.reload();
//   } catch (err: any) {
//     console.error("Rename error:", err);
//     // Show backend-provided message if present
//     const serverMsg = err.response?.data?.error || err.response?.data?.details || err.message;
//     alert("Failed to rename permission: " + serverMsg);
//     setStatus("Failed to rename permission: " + (serverMsg || ""));
//   }
// };

// const [showSitesDialog, setShowSitesDialog] = useState(false);
// const [availableSites, setAvailableSites] = useState<string[]>([]);

// // const handleOpenSitesDialog = async () => {
// //   try {
// //     const response = await axios.get("/api/locations", {
// //       headers: {
// //         Authorization: `Bearer ${localStorage.getItem("token")}`,
// //       },
// //     });
// //     setAvailableSites(response.data.map((site: any) => site.stationName));
// //     setShowSitesDialog(true);
// //   } catch (err) {
// //     console.error("Failed to fetch locations:", err);
// //     alert("Failed to load sites");
// //   }
// const handleOpenSitesDialog = () => {
//   // Find the site_access permission in the loaded permissions
//   const siteAccessPerm = permissions.find((p) => p.name === "site_access");
//   if (!siteAccessPerm) {
//     alert("Site access permission not found.");
//     return;
//   }

//   // Set the sites array to display in dialog
//   setAvailableSites(siteAccessPerm.sites || []);
//   setShowSitesDialog(true);
// };


//   // return (
//   //   <div className="flex">
//   //     {/* Main content */}
//   //     <main className="w-3/4 p-4">
//   //       <h2 className="text-lg font-bold mb-2">Permissions</h2>

//   //       {/* Add new permission */}
//   //       <form onSubmit={handleAdd} className="flex gap-2 mb-4">
//   //         <input
//   //           type="text"
//   //           className="border rounded px-3 py-2 flex-1"
//   //           placeholder="New permission"
//   //           value={newPermission}
//   //           onChange={(e) => setNewPermission(e.target.value)}
//   //           required
//   //         />
//   //         <button
//   //           type="submit"
//   //           className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
//   //         >
//   //           Add
//   //         </button>
//   //         <button
//   //           type="button"
//   //           onClick={handleSync}
//   //           className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
//   //         >
//   //           Sync
//   //         </button>
//   //       </form>

//   //       {/* List all permissions */}
//   //       <ul className="space-y-2">
//   //         {permissions.map((perm) => (
//   //           <li
//   //             key={perm._id}
//   //             className="flex justify-between items-center border px-3 py-2 rounded"
//   //           >
//   //             <span>{perm.name}</span>
//   //             <div className="flex gap-2">
//   //               <button
//   //                 onClick={() => handleEdit(perm._id, perm.name)}
//   //                 className="text-blue-500 hover:text-blue-700"
//   //               >
//   //                 <Pencil className="h-4 w-4" />
//   //               </button>
//   //               <button
//   //                 onClick={() => handleDelete(perm._id)}
//   //                 className="px-4 py-2 bg-red-400 text-white rounded hover:bg-red-600"
//   //               >
//   //                 Delete
//   //               </button>
//   //             </div>
//   //           </li>
//   //         ))}
//   //       </ul>
//   //       {status && <div className="mt-2 text-sm">{status}</div>}
//   //       <Outlet />
//   //     </main>
//   //   </div>
//   // );
//     return (
//       <div className="flex">
//         {/* Main content */}
//         <main className="w-3/4 p-4">
//           <h2 className="text-lg font-bold mb-2">Permissions</h2>

//           {/* Add new permission */}
//           <form onSubmit={handleAdd} className="flex gap-2 mb-4">
//             <input
//               type="text"
//               className="border rounded px-3 py-2 flex-1"
//               placeholder="New permission"
//               value={newPermission}
//               onChange={(e) => setNewPermission(e.target.value)}
//               required
//             />
//             <button
//               type="submit"
//               className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
//             >
//               Add
//             </button>
//             <button
//               type="button"
//               onClick={handleSync}
//               className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
//             >
//               Sync
//             </button>
//           </form>

//           {/* List all permissions */}
//           <ul className="space-y-2">
//             {permissions.map((perm) => (
//               <li
//                 key={perm._id}
//                 className="flex justify-between items-center border px-3 py-2 rounded"
//               >
//                 <span>{perm.name}</span>

//                 <div className="flex gap-2">
//                   {perm.name === "site_access" ? (
//                     <Dialog open={showSitesDialog} onOpenChange={setShowSitesDialog}>
//                       <DialogTrigger asChild>
//                         <Button
//                           onClick={handleOpenSitesDialog}
//                           className="bg-purple-500 hover:bg-purple-600 text-white"
//                         >
//                           Available Sites
//                         </Button>
//                       </DialogTrigger>

//                       <DialogContent className="max-w-md">
//                         <DialogHeader>
//                           <DialogTitle>Available Sites</DialogTitle>
//                         </DialogHeader>
//                         {/* <ul className="mt-2 space-y-1 max-h-64 overflow-y-auto"> */}
//                         <ul className="list-disc list-inside mt-2 space-y-1">
//                           {availableSites.length > 0 ? (
//                             availableSites.map((site, idx) => (
//                               <li
//                                 key={idx}
//                                 className="px-2 py-1 text-sm"
//                               >
//                                 {site}
//                               </li>
//                             ))
//                           ) : (
//                             <p className="text-sm text-gray-500">
//                               No sites available.
//                             </p>
//                           )}
//                         </ul>
//                       </DialogContent>
//                     </Dialog>
//                   ) : (
//                     <>
//                       <button
//                         onClick={() => handleEdit(perm._id, perm.name)}
//                         className="text-blue-500 hover:text-blue-700"
//                       >
//                         <Pencil className="h-4 w-4" />
//                       </button>
//                       <button
//                         onClick={() => handleDelete(perm._id)}
//                         className="px-4 py-2 bg-red-400 text-white rounded hover:bg-red-600"
//                       >
//                         Delete
//                       </button>
//                     </>
//                   )}
//                 </div>
//               </li>
//             ))}
//           </ul>

//           {status && <div className="mt-2 text-sm">{status}</div>}
//           <Outlet />
//         </main>
//       </div>
//     );
// }
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute("/_navbarLayout/settings/permissions/")({  
  component: RouteComponent,
})

function RouteComponent() {
  return <div className='pl-4'>Select a permission from the left</div>
}