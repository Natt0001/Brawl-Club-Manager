'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

type SelectContextType = {
  value?: string;
  onValueChange?: (value: string) => void;
};

const SelectContext = React.createContext<SelectContextType>({});

export function Select({ value, onValueChange, children }: { value?: string; onValueChange?: (value: string) => void; children: React.ReactNode }) {
  return <SelectContext.Provider value={{ value, onValueChange }}>{children}</SelectContext.Provider>;
}

export function SelectTrigger({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('hidden', className)}>{children}</div>;
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  return <span>{placeholder}</span>;
}

export function SelectContent({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  const ctx = React.useContext(SelectContext);
  const options: Array<{ value: string; label: React.ReactNode }> = [];
  React.Children.forEach(children, (child) => {
    if (React.isValidElement<{ value: string; children: React.ReactNode }>(child)) {
      options.push({ value: child.props.value, label: child.props.children });
    }
  });

  return (
    <select
      value={ctx.value}
      onChange={(e) => ctx.onValueChange?.(e.target.value)}
      className={cn('w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none', className)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} className="bg-zinc-950">
          {typeof option.label === 'string' ? option.label : option.value}
        </option>
      ))}
    </select>
  );
}

export function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
  return <div data-value={value}>{children}</div>;
}
