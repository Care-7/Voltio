import React, { useEffect, useState } from 'react';
import { parseLocaleDecimal } from '../utils/calculations';

interface DecimalInputProps {
  id: string;
  label: string;
  sublabel?: string;
  value: number;
  onChange: (value: number) => void;
  unit: string;
  placeholder?: string;
  decimals?: number;
  step?: number;
  ariaLabel?: string;
}

function formatForInput(val: number, maxDecimals: number): string {
  if (val === 0) return '0';
  const rounded = Number(val.toFixed(maxDecimals));
  return String(rounded).replace('.', ',');
}

export const DecimalInput: React.FC<DecimalInputProps> = ({
  id,
  label,
  sublabel,
  value,
  onChange,
  unit,
  placeholder = '0,000',
  decimals = 4,
  ariaLabel,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [text, setText] = useState<string>(() => formatForInput(value, decimals));

  useEffect(() => {
    if (!isFocused) {
      setText(formatForInput(value, decimals));
    }
  }, [value, isFocused, decimals]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow digits, single comma or dot
    if (!/^[0-9]*[.,]?[0-9]*$/.test(raw)) {
      return;
    }
    setText(raw);
    if (raw === '') {
      onChange(0);
      return;
    }
    const parsed = parseLocaleDecimal(raw);
    if (parsed !== null) {
      onChange(parsed);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    if (value === 0) {
      setText('');
    } else {
      e.target.select();
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = parseLocaleDecimal(text);
    const finalVal = parsed === null ? 0 : parsed;
    onChange(finalVal);
    setText(formatForInput(finalVal, decimals));
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-[#18181B]">
          {label}
        </label>
        {sublabel && (
          <span className="text-xs text-[#71717A] truncate">{sublabel}</span>
        )}
      </div>
      <div
        className={`flex items-center justify-between min-h-[46px] px-3.5 rounded-xl transition-colors duration-150 ${
          isFocused
            ? 'bg-white ring-2 ring-[#18181B]'
            : 'bg-[#F7F8F7] hover:bg-[#F1F3F1]'
        }`}
      >
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-label={ariaLabel || label}
          value={text}
          placeholder={placeholder}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className="w-full bg-transparent text-[16px] font-mono font-medium tabular-nums text-[#18181B] placeholder:text-[#A1A1AA] focus:outline-none py-2.5"
        />
        <span className="text-xs font-medium text-[#71717A] whitespace-nowrap shrink-0 pl-2 select-none">
          {unit}
        </span>
      </div>
    </div>
  );
};
