import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const avatarHosts = [
    'avatar-management--avatars.us-west-2.prod.public.atl-paas.net',
    'avatar-management--avatars.us-east-1.prod.public.atl-paas.net',
    'avatar-management--avatars.eu-central-1.prod.public.atl-paas.net',
    'avatar-cdn.atlassian.com'
];
const avatarRequests = new Map();

export function getUserAvatar(user) {
    const value = user.avatarUrl || user.avatarUrls?.['48x48'] || user.avatarUrls?.['24x24'];
    if (!value) return null;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' &&
            !url.username &&
            !url.password &&
            (avatarHosts.includes(url.hostname) || url.hostname.endsWith('.atlassian.net'))
            ? url.href
            : null;
    } catch {
        return null;
    }
}

async function loadAvatar(user) {
    const provided = getUserAvatar(user);
    if (provided) return provided;
    if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
        if (!user.accountId.startsWith('preview-')) return null;
        const initials = user.displayName
            .split(/\s+/)
            .map((part) => part[0])
            .slice(0, 2)
            .join('');
        return `https://${avatarHosts[0]}/initials/${encodeURIComponent(initials)}-5.png`;
    }
    if (!avatarRequests.has(user.accountId)) {
        avatarRequests.set(
            user.accountId,
            (async () => {
                const { requestJira } = await import('@forge/bridge');
                const response = await requestJira(
                    `/rest/api/3/user?accountId=${encodeURIComponent(user.accountId)}`
                );
                return response.ok ? getUserAvatar(await response.json()) : null;
            })().catch(() => null)
        );
    }
    return avatarRequests.get(user.accountId);
}

export function AssigneeAvatar({ user }) {
    const [source, setSource] = useState(getUserAvatar(user));
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        let cancelled = false;
        setSource(getUserAvatar(user));
        setFailed(false);
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
            {source && !failed ? (
                <img
                    src={source}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={() => setFailed(true)}
                />
            ) : (
                initials
            )}
        </span>
    );
}

export default function AssigneeChip({ user, onRemove, disabled }) {
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
