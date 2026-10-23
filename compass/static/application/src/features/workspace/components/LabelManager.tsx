import React, { useEffect, useState } from 'react';
import { Plus, Save, Tag, Trash2 } from 'lucide-react';
import LabelColorPicker from '../../../components/labels/LabelColorPicker';
import IconButton from '../../../components/ui/IconButton';
import type { WorkspaceLabel } from '../../../types/workspace';

interface LabelManagerProps {
    labels: WorkspaceLabel[];
    busy: boolean;
    onSave: (labels: WorkspaceLabel[]) => Promise<boolean>;
}

export default function LabelManager({ labels, busy, onSave }: LabelManagerProps) {
    const [draft, setDraft] = useState(labels);
    const [name, setName] = useState('');
    const [color, setColor] = useState('#0c66e4');
    const [error, setError] = useState('');
    useEffect(() => setDraft(labels), [labels]);

    const duplicateName = (candidate: string, ignoreId?: string) =>
        draft.some(
            (label) =>
                label.id !== ignoreId &&
                label.name.trim().toLowerCase() === candidate.trim().toLowerCase()
        );

    function addLabel(event: React.FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        if (!name.trim() || draft.length >= 100 || duplicateName(name)) return;
        setDraft((current) => [
            ...current,
            { id: window.crypto.randomUUID(), name: name.trim(), color }
        ]);
        setName('');
        setError('');
    }

    async function saveLabels(): Promise<void> {
        if (
            draft.some((label) => !label.name.trim()) ||
            new Set(draft.map((label) => label.name.trim().toLowerCase())).size !== draft.length
        ) {
            setError('Label names must be unique and cannot be empty.');
            return;
        }
        setError('');
        await onSave(
            draft.map((label) => ({
                ...label,
                name: label.name.trim(),
                color: label.color.toLowerCase()
            }))
        );
    }

    return (
        <section className="label-manager" aria-labelledby="labels-heading">
            <header className="label-manager-heading">
                <div>
                    <span className="eyebrow">WORKSPACE SETTINGS</span>
                    <h2 id="labels-heading">Labels</h2>
                    <p className="muted">
                        Create color-coded labels for teams, domains, or any other grouping.
                    </p>
                </div>
                <button
                    className="button primary"
                    type="button"
                    disabled={busy || JSON.stringify(draft) === JSON.stringify(labels)}
                    onClick={saveLabels}
                >
                    <Save size={16} />
                    Save labels
                </button>
            </header>
            <form className="label-create-form" onSubmit={addLabel}>
                <div>
                    <label htmlFor="new-label-name">Name</label>
                    <input
                        id="new-label-name"
                        value={name}
                        maxLength={50}
                        placeholder="e.g. Platform team"
                        onChange={(event) => setName(event.target.value)}
                    />
                </div>
                <div>
                    <label>Color</label>
                    <LabelColorPicker
                        ariaLabel="New label color"
                        value={color}
                        onChange={setColor}
                    />
                </div>
                <button
                    className="button secondary"
                    type="submit"
                    disabled={busy || !name.trim() || draft.length >= 100 || duplicateName(name)}
                >
                    <Plus size={16} />
                    Add label
                </button>
            </form>
            {error && (
                <p role="alert" className="dialog-error">
                    {error}
                </p>
            )}
            <div className="label-manager-table">
                <div className="label-manager-column-head">
                    <span>LABEL</span>
                    <span>PREVIEW</span>
                    <span />
                </div>
                {!draft.length ? (
                    <p className="label-manager-empty">
                        <Tag size={18} />
                        No labels yet.
                    </p>
                ) : (
                    draft.map((label) => (
                        <div className="label-manager-row" key={label.id}>
                            <input
                                aria-label={`Name for ${label.name}`}
                                value={label.name}
                                maxLength={50}
                                disabled={busy}
                                onChange={(event) =>
                                    setDraft((current) =>
                                        current.map((candidate) =>
                                            candidate.id === label.id
                                                ? { ...candidate, name: event.target.value }
                                                : candidate
                                        )
                                    )
                                }
                            />
                            <div className="label-preview-control">
                                <LabelColorPicker
                                    ariaLabel={`Color for ${label.name}`}
                                    value={label.color}
                                    disabled={busy}
                                    onChange={(color) =>
                                        setDraft((current) =>
                                            current.map((candidate) =>
                                                candidate.id === label.id
                                                    ? { ...candidate, color }
                                                    : candidate
                                            )
                                        )
                                    }
                                />
                                <span
                                    className="workspace-label-chip"
                                    style={{ '--label-color': label.color } as React.CSSProperties}
                                >
                                    {label.name || 'Label'}
                                </span>
                            </div>
                            <IconButton
                                label={`Remove label ${label.name}`}
                                disabled={busy}
                                onClick={() =>
                                    setDraft((current) =>
                                        current.filter((candidate) => candidate.id !== label.id)
                                    )
                                }
                            >
                                <Trash2 size={16} />
                            </IconButton>
                        </div>
                    ))
                )}
            </div>
        </section>
    );
}
