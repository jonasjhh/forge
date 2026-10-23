import React, { useRef } from 'react';
import { Check, Palette } from 'lucide-react';

export const labelColors = [
    '#0052cc',
    '#0c66e4',
    '#6e5dc6',
    '#964ac0',
    '#ae2a19',
    '#c9372c',
    '#e774bb',
    '#f15b50',
    '#e2b203',
    '#ff8b00',
    '#216e4e',
    '#1f845a',
    '#22a06b',
    '#00875a',
    '#758195',
    '#44546f'
] as const;

interface LabelColorPickerProps {
    value: string;
    onChange: (color: string) => void;
    ariaLabel: string;
    disabled?: boolean;
}

export default function LabelColorPicker({
    value,
    onChange,
    ariaLabel,
    disabled = false
}: LabelColorPickerProps) {
    const normalizedValue = value.toLowerCase();
    const picker = useRef<HTMLDetailsElement>(null);

    function chooseColor(color: string): void {
        onChange(color);
        if (picker.current) picker.current.open = false;
    }

    return (
        <details ref={picker} className="label-color-picker">
            <summary
                className="label-color-trigger"
                aria-label={ariaLabel}
                aria-disabled={disabled}
                tabIndex={disabled ? -1 : 0}
                onClick={(event) => {
                    if (disabled) event.preventDefault();
                }}
            >
                <span
                    className="label-color-current-swatch"
                    style={{ '--swatch-color': value } as React.CSSProperties}
                    aria-hidden="true"
                />
                <span>
                    {labelColors.includes(normalizedValue as (typeof labelColors)[number])
                        ? 'Color'
                        : 'Custom'}
                </span>
            </summary>
            <div className="label-color-options" role="group" aria-label={ariaLabel}>
                {labelColors.map((color) => (
                    <button
                        key={color}
                        type="button"
                        className="label-color-swatch"
                        style={{ '--swatch-color': color } as React.CSSProperties}
                        aria-label={`Use ${color}`}
                        aria-pressed={normalizedValue === color}
                        disabled={disabled}
                        onClick={() => chooseColor(color)}
                    >
                        {normalizedValue === color && <Check size={13} aria-hidden="true" />}
                    </button>
                ))}
                <label className="label-color-custom">
                    <Palette size={14} aria-hidden="true" />
                    <span>Custom</span>
                    <input
                        type="color"
                        aria-label={ariaLabel}
                        value={value}
                        disabled={disabled}
                        onChange={(event) => chooseColor(event.target.value)}
                    />
                </label>
            </div>
        </details>
    );
}
