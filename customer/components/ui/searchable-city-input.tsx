'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { CustomerCityLookupOption } from '@/lib/customer-city-lookup';
import { fetchCitiesByQuery } from '@/lib/api/lookup';

export type CityInputChange = {
  label: string;
  cityId: number | null;
};

type SearchableCityInputProps = {
  id: string;
  name: string;
  value: string;
  onChange: (next: CityInputChange) => void;
  className: string;
  placeholder?: string;
  disabled?: boolean;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
};

export function SearchableCityInput({
  id,
  name,
  value,
  onChange,
  className,
  placeholder = 'Start typing your city',
  disabled = false,
  ariaInvalid,
  ariaDescribedBy,
}: SearchableCityInputProps) {
  const normalizedValue = value ?? '';
  const [searchTerm, setSearchTerm] = useState(normalizedValue);
  const [options, setOptions] = useState<CustomerCityLookupOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSearchTerm(value ?? '');
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchCities = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setOptions([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await fetchCitiesByQuery(query.trim());
        const options = results.map((city) => ({ id: city.id, label: city.name }));
        setOptions(options);
        setIsOpen(options.length > 0);
      } catch {
        setOptions([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    onChange({ label: val, cityId: null });
    searchCities(val);
  };

  const handleSelect = (city: CustomerCityLookupOption) => {
    const label = city.label ?? '';
    setSearchTerm(label);
    onChange({ label, cityId: city.id });
    setIsOpen(false);
    setOptions([]);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <input
          id={id}
          name={name}
          type="text"
          autoComplete="off"
          placeholder={placeholder}
          value={searchTerm ?? ''}
          onChange={handleInputChange}
          disabled={disabled}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          className={`${className} pr-10`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {isSearching ? (
            <svg className="w-4 h-4 text-slate-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </div>

      {isOpen && options.length > 0 && (
        <div className="absolute z-[100] mt-1 w-full max-h-[240px] overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-[0_12px_30px_rgba(0,0,0,0.1)] py-1 custom-scrollbar">
          {options.map((option) => (
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
