import React from 'react';
import { CircleDashed } from 'lucide-react';
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

export function GoalStatusBadge({
    status,
    compact = false,
    id
}: {
    status?: GoalStatus;
    compact?: boolean;
    id?: string;
}) {
    const value = status ?? '';
    const label = goalStatusOptions.find((option) => option.value === value)!.label;
    return (
        <span
            id={id}
            className={`goal-status-badge ${value ? `goal-status-${value}` : 'goal-status-undefined'}${compact && !value ? ' goal-status-compact' : ''}`}
            aria-label={`Status: ${label}`}
            title={value ? `Status: ${label}` : 'Status: Undefined. A status needs to be set.'}
            role="img"
            data-status={value || 'undefined'}
        >
            {compact && !value ? <CircleDashed size={16} aria-hidden="true" /> : label}
        </span>
    );
}
