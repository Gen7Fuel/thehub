import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Define EDI vendor rules:
// - `excludedSites: []` means EDI is enabled for ALL stores.
// - `excludedSites: ["Site A", "Site B"]` means EDI is enabled for all stores EXCEPT those listed.
export const EDI_VENDORS_CONFIG: Record<
  string,
  { name: string; excludedSites: string[] }
> = {
  // EDI enabled for ALL stores (no exclusions)
  "96239": { name: "Quota Core-Mark", excludedSites: [] },
  "721": { name: "Core-Mark", excludedSites: [] },

  // EDI enabled for ALL stores EXCEPT these 4 (they can manually upload)
  "64990": {
    name: "COCA-COLA BOTTLING LTD",
    excludedSites: ["Oliver", "Osoyoos", "Wavers West", "Wavers East"],
  },
  "97290": {
    name: "Coke Canada Bottling",
    excludedSites: ["Oliver", "Osoyoos", "Wavers West", "Wavers East"],
  },
};

export interface VendorData {
  code: string;
  name: string;
}

interface InvoiceVendorSelectProps {
  vendors: VendorData[];
  value: string;
  onValueChange: (code: string) => void;
  disabled?: boolean;
}

// Searchable vendor Select for the Upload Invoice module. Shared by
// upload-invoice/index.tsx (create) and upload-invoice/$id.tsx (edit) so the
// fix below only has to live in one place.
export function InvoiceVendorSelect({
  vendors,
  value,
  onValueChange,
  disabled,
}: InvoiceVendorSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  const filteredVendors = vendors.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.code.toLowerCase().includes(search.toLowerCase()),
  );

  const handleOpenChange = (nextOpen: boolean) => {
    // Radix's SelectContent attaches an unconditional window "resize"/"blur"
    // listener for as long as the popup is open and force-closes on either
    // (see radix-ui/primitives#2634, open/unresolved upstream — no prop to
    // opt out). Focusing this search input to type opens the Android virtual
    // keyboard, which resizes the visual viewport and fires exactly that
    // "resize" event, slamming the dropdown shut mid-search. So: if Radix is
    // asking to close while focus is still inside the search box, the user
    // is mid-search, not dismissing anything — ignore the request. Focus
    // moves onto the tapped SelectItem itself when the user actually picks a
    // vendor (Radix gives items tabIndex={-1}, which real taps/clicks do
    // focus), so a genuine selection still closes normally.
    if (
      !nextOpen &&
      searchWrapperRef.current?.contains(document.activeElement)
    ) {
      return;
    }
    setOpen(nextOpen);
    if (!nextOpen) setSearch("");
  };

  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      open={open}
      onOpenChange={handleOpenChange}
    >
      <SelectTrigger className="w-full bg-white">
        <SelectValue placeholder={disabled ? "Loading..." : "Select Vendor"} />
      </SelectTrigger>
      <SelectContent>
        <div
          ref={searchWrapperRef}
          className="p-2 border-b border-slate-100 sticky top-0 bg-white z-10"
          /* Prevent tablet touch events from triggering dropdown close */
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <Input
            type="text"
            placeholder="Search name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs"
            onKeyDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onFocus={(e) => e.stopPropagation()}
          />
        </div>
        <SelectGroup className="max-h-[250px] overflow-y-auto">
          <SelectLabel>Available Vendors</SelectLabel>
          {filteredVendors.length === 0 ? (
            <div className="text-xs text-slate-400 text-center py-4">
              No vendors found
            </div>
          ) : (
            filteredVendors.map((v) => (
              <SelectItem key={v.code} value={v.code}>
                {v.name} ({v.code})
              </SelectItem>
            ))
          )}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
