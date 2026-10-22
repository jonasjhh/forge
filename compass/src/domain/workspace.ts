import type { SavedGraph, WorkspaceContext } from '../../shared/workspace';
import { validateGraph } from './items';

interface WorkspaceStorage {
    get: (key: string) => Promise<unknown>;
}

export function workspaceKey(context: WorkspaceContext | undefined): string {
    if (!context?.accountId) throw new Error('Sign in to Jira to open the shared workspace.');
    return 'compass:workspace:shared';
}

export async function loadWorkspace(storage: WorkspaceStorage, key: string): Promise<SavedGraph> {
    const stored = await storage.get(key);
    if (stored === undefined || stored === null) return { items: [], updatedAt: null };
    const validated = validateGraph(stored);
    const metadata = stored as SavedGraph;
    const graph: SavedGraph = { ...metadata, ...validated, updatedAt: metadata.updatedAt ?? null };
    return graph;
}
