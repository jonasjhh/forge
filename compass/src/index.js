import Resolver from '@forge/resolver';
import { kvs } from '@forge/kvs';
import { validateGraph } from './items';
import { workspaceKey } from './workspace';

const resolver = new Resolver();

resolver.define('getGraph', async ({ context }) => {
    const stored = await kvs.get(workspaceKey(context));
    return stored ? { ...stored, ...validateGraph(stored) } : { items: [], updatedAt: null };
});

resolver.define('saveGraph', async ({ payload, context }) => {
    const graph = validateGraph(payload);
    const stored = { ...graph, updatedAt: new Date().toISOString(), updatedBy: context.accountId };
    await kvs.set(workspaceKey(context), stored);
    return stored;
});

export const handler = resolver.getDefinitions();
