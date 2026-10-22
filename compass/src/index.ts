import Resolver from '@forge/resolver';
import { kvs } from '@forge/kvs';
import { validateGraph } from './domain/items';
import { loadWorkspace, workspaceKey } from './domain/workspace';
import type { SavedGraph } from '../shared/workspace';

const resolver = new Resolver();

resolver.define('getGraph', async ({ context }): Promise<SavedGraph> => {
    return loadWorkspace(kvs, workspaceKey(context));
});

resolver.define('saveGraph', async ({ payload, context }): Promise<SavedGraph> => {
    const graph = validateGraph(payload);
    const stored = { ...graph, updatedAt: new Date().toISOString(), updatedBy: context.accountId };
    await kvs.set(workspaceKey(context), stored);
    return stored;
});

export const handler = resolver.getDefinitions();
