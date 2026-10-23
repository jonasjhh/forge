import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import CheckboxDropdown from '../ui/CheckboxDropdown';
import type { WorkspaceLabel } from '../../types/workspace';
import LabelColorPicker from './LabelColorPicker';
import './labels.css';

interface LabelPickerProps {
    labels: WorkspaceLabel[];
    value: string[];
    onChange: (labelIds: string[]) => void;
    disabled?: boolean;
    label?: string;
    onCreateLabel?: (name: string, color: string) => void;
}

export default function LabelPicker({
    labels,
    value,
    onChange,
    disabled,
    label = 'Labels',
    onCreateLabel
}: LabelPickerProps) {
    const [creating, setCreating] = useState(false);
    const [name, setName] = useState('');
    const [color, setColor] = useState('#0c66e4');
    const duplicate = labels.some((item) => item.name.toLowerCase() === name.trim().toLowerCase());
    if (!labels.length && !onCreateLabel) return null;

    function createLabel(): void {
        const normalizedName = name.trim();
        if (!normalizedName || duplicate || !onCreateLabel) return;
        onCreateLabel(normalizedName, color);
        setName('');
        setColor('#0c66e4');
        setCreating(false);
    }

    return (
        <div className="workspace-label-picker">
            <div className="workspace-label-picker-controls">
                {labels.length > 0 && (
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
                )}
                {onCreateLabel && (
                    <button
                        className="button secondary"
                        type="button"
                        disabled={disabled}
                        onClick={() => setCreating((current) => !current)}
                    >
                        {creating ? <X size={14} /> : <Plus size={14} />}
                        {creating ? 'Cancel' : 'Add label'}
                    </button>
                )}
            </div>
            {creating && onCreateLabel && (
                <div className="inline-label-create" role="group" aria-label="Create a label">
                    <label htmlFor="inline-label-name">New label</label>
                    <input
                        id="inline-label-name"
                        type="text"
                        value={name}
                        maxLength={50}
                        autoFocus
                        disabled={disabled}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                createLabel();
                            }
                        }}
                        onChange={(event) => setName(event.target.value)}
                    />
                    <LabelColorPicker
                        ariaLabel="New label color"
                        value={color}
                        disabled={disabled}
                        onChange={setColor}
                    />
                    {duplicate && <p className="inline-label-error">That label already exists.</p>}
                    <div className="inline-label-create-actions">
                        <button
                            className="button primary"
                            type="button"
                            disabled={disabled || !name.trim() || duplicate}
                            onClick={createLabel}
                        >
                            Create and assign
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
