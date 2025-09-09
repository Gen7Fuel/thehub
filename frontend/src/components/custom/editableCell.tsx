import { useEffect, useRef } from "react";

interface EditableCellProps {
  id: string | number;
  initialValue?: number | string;
  className?: string;
  onChange?: (value: number | string) => void; // Updated to match the parent component's expectations
}

export default function EditableCell({ initialValue = '0', className = '', onChange }: EditableCellProps) {
  const ref = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.innerText = String(initialValue);
    }
  }, [initialValue]);

  const handleFocus = () => {
    if (ref.current) {
      if (ref.current.innerText.trim() === '0') {
        ref.current.innerText = ''; // Show blank if the value is zero
      }

      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(ref.current); // Select the entire content of the cell
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range); // Highlight the content
      }
    }
  };

  const handleBlur = () => {
    const value = ref.current?.innerText.trim() || '';
    const num = Number(value);

    if (value === '' || isNaN(num) || num < 0) {
      if (ref.current) {
        ref.current.innerText = '0';
      }
      onChange?.(0); // Call onChange with 0 if invalid
    } else {
      if (ref.current) {
        ref.current.innerText = String(num);
      }
      onChange?.(num); // Call onChange with the valid number
    }
  };

  const handleInput = () => {
    const cleaned = ref.current?.innerText.replace(/[^\d.]/g, '') || '';
    if (ref.current && ref.current.innerText !== cleaned) {
      ref.current.innerText = cleaned;
      placeCaretAtEnd(ref.current);
    }
  };

  const placeCaretAtEnd = (el: Node) => {
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(el);
    range.collapse(false);
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  };

  return (
    <td
      ref={ref}
      className={`${className} bg-sky-50`}
      contentEditable
      onFocus={handleFocus}
      onBlur={handleBlur}
      onInput={handleInput}
    />
  );
}
