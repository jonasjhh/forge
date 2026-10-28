import React from 'react';
import type { WorkspaceLabel } from '../../types/workspace';
import './labels.css';

export default function LabelChip({ label }: { label: WorkspaceLabel }) {
    return (
        <span
            className="workspace-label-chip"
            title={label.name}
            style={{ '--label-color': label.color } as React.CSSProperties}
        >
            {label.name}
        </span>
    );
}
