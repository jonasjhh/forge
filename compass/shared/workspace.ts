export type EntryType = 'group' | 'goal' | 'metric';
export type GoalCategory = 'Decision' | 'Capability' | 'Delivery';

export interface Assignee {
    accountId: string;
    displayName: string;
    avatarUrl?: string;
}

export interface WorkspaceLabel {
    id: string;
    name: string;
    color: string;
}

export interface WorkspaceEntry {
    id: string;
    type: EntryType;
    name: string;
    description: string;
    childIds: string[];
    assignees: Assignee[];
    labelIds: string[];
    goalCategory?: GoalCategory;
    currentValue?: number | null;
    targetValue?: number | null;
    unit?: string;
}

export interface Graph {
    items: WorkspaceEntry[];
    labels: WorkspaceLabel[];
}

export interface SavedGraph extends Graph {
    updatedAt: string | null;
    updatedBy?: string;
}

export interface WorkspaceContext {
    accountId?: string;
}

export type EntryDraft = Omit<WorkspaceEntry, 'id' | 'childIds'>;
export type DropPlacement = 'before' | 'inside' | 'after';
export type ViewMode = 'list' | 'graph' | 'tree' | 'labels';

export interface ListRow {
    entry: WorkspaceEntry;
    depth: number;
    path: string;
    hasChildren: boolean;
}

export interface WorkspaceApi {
    getGraph: { payload: undefined; result: SavedGraph };
    saveGraph: { payload: Graph; result: SavedGraph };
}
