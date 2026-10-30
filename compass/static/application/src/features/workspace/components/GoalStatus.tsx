import React from 'react';
import type { GoalStatus } from '../../../types/workspace';

const goalStatusOptions: { value: GoalStatus | ''; label: string }[] = [
    { value: '', label: 'Undefined' },
    { value: 'green', label: 'Green' },
    { value: 'yellow', label: 'Yellow' },
    { value: 'red', label: 'Red' }
];

export function GoalStatusField({
    id,
    value,
    disabled,
    onChange
}: {
    id: string;
    value: GoalStatus | '';
    disabled: boolean;
    onChange: (value: GoalStatus | '') => void;
}) {
    return (
        <React.Fragment>
            <label htmlFor={id}>Status</label>
            <select
                id={id}
                value={value}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value as GoalStatus | '')}
            >
                {goalStatusOptions.map((option) => (
                    <option key={option.label} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </React.Fragment>
    );
}

export function GoalStatusBadge({ status }: { status?: GoalStatus }) {
    const value = status ?? '';
    const label = goalStatusOptions.find((option) => option.value === value)!.label;
    return (
        <span
            className={`goal-status-badge ${value ? `goal-status-${value}` : 'goal-status-undefined'}`}
            aria-label={`Status: ${label}`}
            data-status={value || 'undefined'}
        >
            {label}
        </span>
    );
}
