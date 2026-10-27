import React, { useEffect, useRef, useState } from 'react';
import { Download, LoaderCircle, Upload, X } from 'lucide-react';
import IconButton from '../../../components/ui/IconButton';
import { parseWorkspaceFile, serializeWorkspace } from '../model/workspaceTransfer';
import type { Graph } from '../../../types/workspace';

interface WorkspaceTransferProps {
    graph: Graph;
    disabled: boolean;
    onImport: (graph: Graph) => Promise<boolean>;
}

function ImportConfirmation({
    graph,
    fileName,
    busy,
    error,
    onClose,
    onConfirm
}: {
    graph: Graph;
    fileName: string;
    busy: boolean;
    error: string;
    onClose: () => void;
    onConfirm: () => Promise<void>;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const element = dialog.current;
        element?.showModal();
        return () => {
            if (element?.open) element.close();
        };
    }, []);
    return (
        <dialog
            ref={dialog}
            className="item-dialog"
            aria-labelledby="import-title"
            onCancel={(event) => {
                if (busy) event.preventDefault();
                else onClose();
            }}
        >
            <form
                onSubmit={async (event) => {
                    event.preventDefault();
                    await onConfirm();
                }}
            >
                <div className="dialog-heading">
                    <h2 id="import-title">Replace workspace?</h2>
                    <IconButton label="Close import dialog" disabled={busy} onClick={onClose}>
                        <X size={18} />
                    </IconButton>
                </div>
                <p className="delete-message">
                    Import <strong>{fileName}</strong> with {graph.items.length} entries,{' '}
                    {graph.items.reduce((total, entry) => total + entry.childIds.length, 0)}{' '}
                    connections, and {graph.labels.length} labels?
                </p>
                <p className="delete-message">
                    This replaces all entries, connections, and labels in the shared workspace. This
                    cannot be undone. Export a backup first to keep the current data.
                </p>
                {error && (
                    <p className="dialog-error" role="alert">
                        {error}
                    </p>
                )}
                <div className="dialog-actions">
                    <button
                        className="button secondary"
                        type="button"
                        disabled={busy}
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button className="button danger" type="submit" disabled={busy}>
                        {busy ? <LoaderCircle size={16} className="spin" /> : <Upload size={16} />}
                        Replace workspace
                    </button>
                </div>
            </form>
        </dialog>
    );
}

export default function WorkspaceTransfer({ graph, disabled, onImport }: WorkspaceTransferProps) {
    const input = useRef<HTMLInputElement>(null);
    const [reading, setReading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState('');
    const [pending, setPending] = useState<{ graph: Graph; fileName: string } | null>(null);

    async function readImport(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (!file) return;
        setError('');
        setReading(true);
        try {
            if (file.size > 1024 * 1024) throw new Error('Choose a JSON file smaller than 1 MB.');
            const imported = parseWorkspaceFile(await file.text());
            setPending({ graph: imported, fileName: file.name });
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : 'Could not read the file.');
        } finally {
            setReading(false);
        }
    }

    function exportWorkspace(): void {
        setError('');
        try {
            const blob = new Blob([serializeWorkspace(graph)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `compass-workspace-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(link);
            try {
                link.click();
            } finally {
                link.remove();
                setTimeout(() => URL.revokeObjectURL(url), 0);
            }
        } catch {
            setError('Could not export the workspace. Try again.');
        }
    }

    async function confirmImport(): Promise<void> {
        if (!pending || importing || disabled) return;
        setImporting(true);
        setError('');
        try {
            if (await onImport(pending.graph)) setPending(null);
            else setError('Import could not be confirmed. Try again or refresh the workspace.');
        } catch {
            setError('Import failed. Try again or refresh the workspace.');
        } finally {
            setImporting(false);
        }
    }

    return (
        <React.Fragment>
            <button
                type="button"
                className="button secondary"
                disabled={disabled || reading || importing}
                onClick={exportWorkspace}
            >
                <Download size={17} />
                Export
            </button>
            <button
                type="button"
                className="button secondary"
                disabled={disabled || reading || importing}
                onClick={() => input.current?.click()}
            >
                {reading ? <LoaderCircle size={17} className="spin" /> : <Upload size={17} />}Import
            </button>
            <input
                ref={input}
                hidden
                type="file"
                accept=".json,application/json"
                aria-label="Import workspace JSON file"
                onChange={readImport}
                disabled={disabled || reading || importing}
            />
            {error && !pending && (
                <p className="transfer-error" role="alert">
                    {error}
                </p>
            )}
            {pending && (
                <ImportConfirmation
                    graph={pending.graph}
                    fileName={pending.fileName}
                    busy={disabled || importing}
                    error={error}
                    onClose={() => {
                        setPending(null);
                        setError('');
                    }}
                    onConfirm={confirmImport}
                />
            )}
        </React.Fragment>
    );
}
