import { useEffect, useState } from "react";
import axios from "axios";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PermissionUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  roleName: string | null;
  value: boolean;
}

export function PermissionUsersDialog({
  permId,
  permissionName,
  open,
  onOpenChange,
}: {
  permId: number | null;
  permissionName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<PermissionUser[]>([]);
  // current checked state, keyed by user _id
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open || permId == null) return;

    let cancelled = false;
    setLoading(true);

    axios
      .get(`/api/users/by-permission/${permId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "X-Required-Permission": "settings",
        },
      })
      .then((response) => {
        if (cancelled) return;
        const fetched: PermissionUser[] = response.data || [];
        setUsers(fetched);
        setChecked(
          Object.fromEntries(fetched.map((u) => [u._id, u.value]))
        );
      })
      .catch((error) => {
        console.error("Error fetching users for permission:", error);
        if (!cancelled) alert("Failed to load users for this permission.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, permId]);

  const handleDeselectAll = () => {
    setChecked((prev) =>
      Object.fromEntries(Object.keys(prev).map((id) => [id, false]))
    );
  };

  const handleSave = async () => {
    if (permId == null) return;

    const changes = users
      .filter((u) => checked[u._id] !== u.value)
      .map((u) => ({ userId: u._id, value: checked[u._id] }));

    if (changes.length === 0) {
      onOpenChange(false);
      return;
    }

    setSaving(true);
    try {
      await axios.put(
        `/api/users/by-permission/${permId}`,
        { changes },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "X-Required-Permission": "settings",
          },
        }
      );
      alert("Users updated successfully!");
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving users for permission:", error);
      alert("Failed to update users for this permission.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Users with "{permissionName}"</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            {loading ? "Loading users..." : `${users.length} user(s)`}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDeselectAll}
            disabled={loading || users.length === 0}
          >
            Deselect All
          </Button>
        </div>

        <ScrollArea className="h-72 rounded-md border p-2">
          {!loading && users.length === 0 && (
            <p className="text-sm text-gray-500 p-2">No users found.</p>
          )}
          <ul className="space-y-1">
            {users.map((user) => (
              <li
                key={user._id}
                className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50"
              >
                <Checkbox
                  checked={!!checked[user._id]}
                  onCheckedChange={(value) =>
                    setChecked((prev) => ({ ...prev, [user._id]: !!value }))
                  }
                />
                <div className="flex flex-col">
                  <span className="text-sm">
                    {user.firstName} {user.lastName}
                  </span>
                  <span className="text-xs text-gray-500">
                    {user.email}
                    {user.roleName ? ` • ${user.roleName}` : ""}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
