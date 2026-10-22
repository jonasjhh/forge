import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, UsersRound } from 'lucide-react';
import AssigneePicker from './AssigneePicker';
import type { Assignee } from '../../types/workspace';

interface AssigneeFilterProps {
    users: Assignee[];
    value: Assignee[];
    onChange: (value: Assignee[]) => void;
}

export default function AssigneeFilter({ users, value, onChange }: AssigneeFilterProps) {
    const details = useRef<HTMLDetailsElement>(null);
    const [open, setOpen] = useState(false);
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
            className="assignee-filter"
            onToggle={() => setOpen(Boolean(details.current?.open))}
            onKeyDown={(event) => {
                if (event.key === 'Escape') {
                    if (details.current) details.current.open = false;
                    event.currentTarget.querySelector('summary')?.focus();
                }
            }}
        >
            <summary
                className={`button secondary ${value.length ? 'filter-active' : ''}`}
                aria-label="Filter by assignee"
            >
                <UsersRound size={16} />
                <span>Assignees</span>
                {value.length > 0 && <span className="count">{value.length}</span>}
                <ChevronDown size={14} />
            </summary>
            {open && (
                <div className="assignee-filter-panel" role="group" aria-label="Assignee filter">
                    <AssigneePicker
                        id="filter-assignees"
                        label="Filter by assignee"
                        placeholder="Search assignees"
                        options={users}
                        value={value}
                        onChange={onChange}
                        maxSelections={Infinity}
                    />
                    <button
                        type="button"
                        className="button secondary clear-assignee-filter"
                        disabled={!value.length}
                        onClick={() => onChange([])}
                    >
                        Clear all
                    </button>
                </div>
            )}
        </details>
    );
}
