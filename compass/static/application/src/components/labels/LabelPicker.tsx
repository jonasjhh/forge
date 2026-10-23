import React from 'react';
import CheckboxDropdown from '../ui/CheckboxDropdown';
import type { WorkspaceLabel } from '../../types/workspace';
import './labels.css';

interface LabelPickerProps {
    labels: WorkspaceLabel[];
    value: string[];
    onChange: (labelIds: string[]) => void;
    disabled?: boolean;
    label?: string;
}

export default function LabelPicker({
    labels,
    value,
    onChange,
    disabled,
    label = 'Labels'
}: LabelPickerProps) {
    if (!labels.length) return null;
    return (
        <div className="workspace-label-picker">
            <CheckboxDropdown
                label={label}
                allLabel="All labels"
                emptyLabel="No labels"
                options={labels.map((item) => ({
                    value: item.id,
                    label: item.name,
                    color: item.color
                }))}
                value={value}
                onChange={onChange}
                disabled={disabled}
            />
        </div>
    );
}
