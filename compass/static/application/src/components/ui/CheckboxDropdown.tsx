import React, { useEffect, useRef } from 'react';
import { ChevronDown, ListFilter } from 'lucide-react';
import './ui.css';

interface CheckboxOption<Value extends string> {
    value: Value;
    label: string;
    color?: string;
}

interface CheckboxDropdownProps<Value extends string> {
    label: string;
    allLabel: string;
    emptyLabel: string;
    options: readonly CheckboxOption<Value>[];
    value: Value[];
    onChange: (value: Value[]) => void;
    disabled?: boolean;
}

export default function CheckboxDropdown<Value extends string>({
    label,
    allLabel,
    emptyLabel,
    options,
    value,
    onChange,
    disabled = false
}: CheckboxDropdownProps<Value>) {
    const details = useRef<HTMLDetailsElement>(null);
    const selectAll = useRef<HTMLInputElement>(null);
    const selected = options.filter((option) => value.includes(option.value));
    const allSelected = selected.length === options.length;
    const summary = allSelected
        ? allLabel
        : selected.length === 0
          ? emptyLabel
          : selected.length === 1
            ? selected[0].label
            : `${selected.length} selected`;

    useEffect(() => {
        if (selectAll.current)
            selectAll.current.indeterminate = selected.length > 0 && !allSelected;
    }, [selected.length, allSelected]);

    useEffect(() => {
        const closeOutside = (event: PointerEvent) => {
            if (
                details.current &&
                event.target instanceof Node &&
                !details.current.contains(event.target)
            )
                details.current.open = false;
        };
        document.addEventListener('pointerdown', closeOutside);
        return () => document.removeEventListener('pointerdown', closeOutside);
    }, []);

    return (
        <details
            ref={details}
            className="checkbox-dropdown"
            onKeyDown={(event) => {
                if (event.key === 'Escape') {
                    if (details.current) details.current.open = false;
                    event.currentTarget.querySelector('summary')?.focus();
                }
            }}
        >
            <summary
                className={`button secondary ${allSelected ? '' : 'filter-active'}`}
                aria-label={label}
                aria-disabled={disabled}
                tabIndex={disabled ? -1 : 0}
            >
                <ListFilter size={16} />
                <span>{summary}</span>
                <ChevronDown size={14} />
            </summary>
            <fieldset className="checkbox-dropdown-panel" aria-label={label}>
                <legend className="visually-hidden">{label}</legend>
                <label className="checkbox-dropdown-option checkbox-dropdown-all">
                    <input
                        ref={selectAll}
                        type="checkbox"
                        value="all"
                        checked={allSelected}
                        disabled={disabled}
                        onChange={(event) =>
                            onChange(
                                event.currentTarget.checked
                                    ? options.map((option) => option.value)
                                    : []
                            )
                        }
                    />
                    <span>{allLabel}</span>
                </label>
                {options.map((option) => (
                    <label key={option.value} className="checkbox-dropdown-option">
                        <input
                            type="checkbox"
                            value={option.value}
                            checked={value.includes(option.value)}
                            disabled={disabled}
                            onChange={(event) =>
                                onChange(
                                    event.currentTarget.checked
                                        ? [...value, option.value]
                                        : value.filter(
                                              (selectedValue) => selectedValue !== option.value
                                          )
                                )
                            }
                        />
                        {option.color && (
                            <span
                                className="checkbox-option-swatch"
                                style={{ '--option-color': option.color } as React.CSSProperties}
                            />
                        )}
                        <span>{option.label}</span>
                    </label>
                ))}
            </fieldset>
        </details>
    );
}
