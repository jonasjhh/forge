import React, { useEffect, useState } from 'react';
import { LoaderCircle, Plus } from 'lucide-react';
import AssigneeChip, { AssigneeAvatar } from './AssigneeChip';
import { searchUsers } from '../../services/jiraUsers';
import type { Assignee } from '../../types/workspace';

interface AssigneePickerProps {
    value: Assignee[];
    onChange: (value: Assignee[]) => void;
    disabled?: boolean;
    id: string;
    options?: Assignee[];
    label?: string;
    placeholder?: string;
    maxSelections?: number;
}
export default function AssigneePicker({
    value,
    onChange,
    disabled,
    id,
    options,
    label = 'Assignees',
    placeholder = 'Search Jira users',
    maxSelections = 20
}: AssigneePickerProps) {
    const [query, setQuery] = useState('');
    const [users, setUsers] = useState<Assignee[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searched, setSearched] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setUsers([]);
        setError('');
        setSearched(false);
        setLoading(false);
        if (options !== undefined) {
            setUsers(
                options.filter((user) =>
                    user.displayName.toLowerCase().includes(query.trim().toLowerCase())
                )
            );
            setSearched(true);
            return;
        }
        if (query.trim().length < 2) return;
        setLoading(true);
        const timer = setTimeout(() => {
            searchUsers(query.trim())
                .then((results) => {
                    if (!cancelled) {
                        setUsers(results);
                        setSearched(true);
                    }
                })
                .catch(() => {
                    if (!cancelled)
                        setError(
                            'Could not search Jira users. Check the app permissions and your Browse users and groups permission.'
                        );
                })
                .finally(() => {
                    if (!cancelled) setLoading(false);
                });
        }, 250);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [query, options]);

    const available = users.filter(
        (user) => !value.some((assignee) => assignee.accountId === user.accountId)
    );
    return (
        <div className="assignee-picker">
            <label htmlFor={id}>
                {label} <span className="count">{value.length}</span>
            </label>
            <div className="assignee-control">
                <ul className="assignee-list">
                    {value.map((user) => (
                        <li key={user.accountId}>
                            <AssigneeChip
                                user={user}
                                disabled={disabled}
                                onRemove={() =>
                                    onChange(
                                        value.filter(
                                            (assignee) => assignee.accountId !== user.accountId
                                        )
                                    )
                                }
                            />
                        </li>
                    ))}
                </ul>
                <input
                    id={id}
                    type="search"
                    placeholder={placeholder}
                    autoComplete="off"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    disabled={disabled || value.length >= maxSelections}
                />
            </div>
            {loading && (
                <p className="picker-status" role="status">
                    <LoaderCircle size={14} className="spin" />
                    Searching users
                </p>
            )}
            {error && (
                <p className="dialog-error" role="alert">
                    {error}
                </p>
            )}
            {!loading && searched && !available.length && (
                <p className="picker-status" role="status">
                    No matching users.
                </p>
            )}
            <ul className="user-results">
                {available.slice(0, options === undefined ? 20 : 30).map((user) => (
                    <li key={user.accountId}>
                        <button
                            type="button"
                            disabled={disabled || value.length >= maxSelections}
                            onClick={() => {
                                onChange([...value, user]);
                                setQuery('');
                            }}
                        >
                            <AssigneeAvatar user={user} />
                            <span>{user.displayName}</span>
                            <Plus size={15} />
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
