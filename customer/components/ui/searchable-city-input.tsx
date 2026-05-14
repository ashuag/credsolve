'use client';

import type { CustomerCityLookupOption } from '@/lib/customer-city-lookup';
import { useState, useRef, useEffect } from 'react';

export type CityInputChange = {
  label: string;
  /** Set when the user picks a row from the lookup list; cleared when they type freely. */
  cityId: number | null;
};

type SearchableCityInputProps = {
  id: string;
  name: string;
  value: string;
  options: CustomerCityLookupOption[];
  onChange: (next: CityInputChange) => void;
  className: string;
  placeholder: string;
  isLoading?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
};

export function SearchableCityInput({
  id,
  name,
  value,
  options,
  onChange,
  className,
  placeholder,
  isLoading = false,
  disabled = false,
  autoComplete = 'off',
  ariaInvalid,
  ariaDescribedBy
}: SearchableCityInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value || '');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchTerm(value || '');
  }, [value]);

  const filteredOptions = (options || [])
    .filter((opt) => opt.label.toLowerCase().includes(searchTerm.toLowerCase()))
    .slice(0, 100);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (city: CustomerCityLookupOption) => {
    setSearchTerm(city.label);
    onChange({ label: city.label, cityId: city.id });
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    onChange({ label: val, cityId: null });
    if (!isOpen) setIsOpen(true);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <input
          id={id}
          name={name}
          type="text"
          autoComplete={autoComplete}
          placeholder={isLoading && options.length === 0 ? 'Loading cities...' : placeholder}
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          disabled={disabled || (isLoading && options.length === 0)}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          className={`${className} pr-10`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-[100] mt-1 w-full max-h-[240px] overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-[0_12px_30px_rgba(0,0,0,0.1)] py-1 custom-scrollbar">
          {filteredOptions.map((option) => (
            <button
              key={`${option.id}-${option.label}`}
              type="button"
              onClick={() => handleSelect(option)}
              className="w-full text-left px-4 py-2.5 text-[0.9rem] text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
