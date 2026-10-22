import './assignees.css';
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getUserAvatar, loadAvatar } from '../../services/jiraUsers';
import type { Assignee } from '../../types/workspace';

interface AssigneeChipProps {
    user: Assignee;
    onRemove?: () => void;
    disabled?: boolean;
}

export function AssigneeAvatar({ user }: Pick<AssigneeChipProps, 'user'>) {
    const [source, setSource] = useState(getUserAvatar(user));
    const [failedSource, setFailedSource] = useState<string | null>(null);
    useEffect(() => {
        let cancelled = false;
        setSource(getUserAvatar(user));
        setFailedSource(null);
        loadAvatar(user).then((url) => {
            if (!cancelled) setSource(url);
        });
        return () => {
            cancelled = true;
        };
    }, [user]);
    const initials = user.displayName
        .trim()
        .split(/\s+/)
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
    return (
        <span className="assignee-avatar" aria-hidden="true">
            {source && failedSource !== source ? (
                <img
                    src={source}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={() => setFailedSource(source)}
                />
            ) : (
                initials
            )}
        </span>
    );
}

export default function AssigneeChip({ user, onRemove, disabled }: AssigneeChipProps) {
    return (
        <span className="assignee-chip" title={user.displayName}>
            <AssigneeAvatar user={user} />
            <span className="assignee-name">{user.displayName}</span>
            {onRemove && (
                <button
                    type="button"
                    className="assignee-remove"
                    disabled={disabled}
                    aria-label={`Remove assignee ${user.displayName}`}
                    title={`Remove ${user.displayName}`}
                    onClick={onRemove}
                >
                    <X size={12} />
                </button>
            )}
        </span>
    );
}
