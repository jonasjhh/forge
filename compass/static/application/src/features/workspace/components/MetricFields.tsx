import React from 'react';
export interface MetricValues {
    currentValue: number | null;
    targetValue: number | null;
    unit: string;
}

interface MetricFieldsProps {
    value: MetricValues;
    onChange: (value: MetricValues) => void;
    disabled?: boolean;
    prefix: string;
}

export default function MetricFields({ value, onChange, disabled, prefix }: MetricFieldsProps) {
    return (
        <div className="metric-fields">
            <div className="metric-value-row">
                {(
                    [
                        ['currentValue', 'Current value'],
                        ['targetValue', 'Target value']
                    ] as const
                ).map(([field, label]) => (
                    <div key={field}>
                        <label htmlFor={`${prefix}-${field}`}>{label}</label>
                        <input
                            id={`${prefix}-${field}`}
                            type="number"
                            step="any"
                            value={value[field] ?? ''}
                            disabled={disabled}
                            onChange={(event) =>
                                onChange({
                                    ...value,
                                    [field]:
                                        event.target.value === ''
                                            ? null
                                            : Number(event.target.value)
                                })
                            }
                        />
                    </div>
                ))}
            </div>
            <label htmlFor={`${prefix}-unit`}>Unit</label>
            <input
                id={`${prefix}-unit`}
                placeholder="%, hours, requests"
                maxLength={40}
                value={value.unit || ''}
                disabled={disabled}
                onChange={(event) => onChange({ ...value, unit: event.target.value })}
            />
        </div>
    );
}
