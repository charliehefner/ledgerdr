import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface NameAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
}

export function NameAutocomplete({ value, onChange, suggestions }: NameAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = value.trim()
    ? suggestions.filter(s => s.toLowerCase().includes(value.trim().toLowerCase())).slice(0, 8)
    : [];

  useEffect(() => {
    setHighlightIndex(-1);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const select = (name: string) => {
    onChange(name);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault();
      select(filtered[highlightIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => { if (filtered.length > 0) setOpen(true); }}
        onKeyDown={handleKeyDown}
        placeholder="Proveedor/Beneficiario"
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          {filtered.map((name, i) => (
            <li
              key={name}
              onMouseDown={() => select(name)}
              className={cn(
                'cursor-pointer px-3 py-2 text-sm',
                i === highlightIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
              )}
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
