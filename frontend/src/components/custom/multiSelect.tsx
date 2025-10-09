import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function MultiSelect({ options, selected, onChange }: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(s => s !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const toggleAll = () => {
    if (selected.length === options.length) {
      onChange([]);
    } else {
      onChange(options);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-between"
        >
          {selected.length === 0
            ? "Select sites"
            : `${selected.length} selected`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2 max-h-64 overflow-y-auto">
        <div className="flex items-center gap-2 mb-2">
          <Checkbox
            checked={selected.length === options.length}
            onCheckedChange={toggleAll}
          />
          <span
            onClick={toggleAll}
            className="cursor-pointer select-none text-sm"
          >
            Select All
          </span>
        </div>
        {options.map(option => (
          <div key={option} className="flex items-center gap-2 py-1">
            <Checkbox
              checked={selected.includes(option)}
              onCheckedChange={() => toggleOption(option)}
            />
            <span
              onClick={() => toggleOption(option)}
              className="cursor-pointer select-none text-sm"
            >
              {option}
            </span>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
