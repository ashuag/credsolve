'use client';

type SearchableCityInputProps = {
  id: string;
  name: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
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
  autoComplete = 'address-level2',
  ariaInvalid,
  ariaDescribedBy
}: SearchableCityInputProps) {
  const listId = `${id}-options`;
  const shouldDisable = disabled || (isLoading && options.length === 0);

  return (
    <>
      <input
        id={id}
        name={name}
        type="text"
        list={options.length > 0 ? listId : undefined}
        autoComplete={autoComplete}
        placeholder={isLoading && options.length === 0 ? 'Loading cities...' : placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={shouldDisable}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        className={className}
      />
      {options.length > 0 ? (
        <datalist id={listId}>
          {options.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      ) : null}
    </>
  );
}
