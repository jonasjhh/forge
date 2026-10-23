import type { Graph, SavedGraph, WorkspaceApi } from '../types/workspace';
export const isPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname);

const previewKey = 'compass-preview-v1';

export function callWorkspace(operation: 'getGraph'): Promise<SavedGraph>;
export function callWorkspace(operation: 'saveGraph', payload: Graph): Promise<SavedGraph>;
export async function callWorkspace(
    operation: keyof WorkspaceApi,
    payload?: Graph
): Promise<SavedGraph> {
    if (!isPreview) {
        const { invoke } = await import('@forge/bridge');
        const response = await invoke<SavedGraph>(operation, payload);
        return 'body' in response ? response.body : response;
    }
    if (operation === 'getGraph') {
        const stored: SavedGraph = JSON.parse(
            localStorage.getItem(previewKey) || '{"items":[],"updatedAt":null}'
        );
        return {
            ...stored,
            labels: stored.labels ?? [],
            items: stored.items.map((entry) => ({
                ...entry,
                labelIds: entry.labelIds ?? [],
                ...(entry.type === 'goal' ? { goalCategory: entry.goalCategory ?? 'Delivery' } : {})
            }))
        };
    }
    if (!payload) throw new Error('Workspace data is required.');
    const graph: SavedGraph = {
        items: payload.items,
        labels: payload.labels,
        updatedAt: new Date().toISOString()
    };
    localStorage.setItem(previewKey, JSON.stringify(graph));
    return graph;
}
