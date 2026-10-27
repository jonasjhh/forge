import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { DataSet, Network } from 'vis-network/standalone';
import type { Edge, Node } from 'vis-network/standalone';
import { entryTypes, goalCategoryStyles } from '../model/entries';
import type { ViewMode, WorkspaceEntry, WorkspaceLabel } from '../../../types/workspace';

export interface GraphHandle {
    fit: () => void;
    zoom: (factor: number) => void;
}

interface ItemGraphProps {
    items: WorkspaceEntry[];
    labels: WorkspaceLabel[];
    selectedId: string | null;
    mode: ViewMode;
    onSelect: (id: string) => void;
    onClearSelection?: () => void;
    visibleIds?: string[];
}

function labelText(text: string): string {
    return text.replace(/<(\/?(?:b|i|code))>/g, '<\u200b$1>');
}

const ItemGraph = forwardRef<GraphHandle, ItemGraphProps>(function ItemGraph(
    { items, labels, selectedId, mode, onSelect, onClearSelection, visibleIds },
    ref
) {
    const container = useRef<HTMLDivElement>(null);
    const network = useRef<Network | null>(null);
    const [data] = useState(() => ({ nodes: new DataSet<Node>(), edges: new DataSet<Edge>() }));
    const callbacks = useRef({ onSelect, onClearSelection });
    useEffect(() => {
        callbacks.current = { onSelect, onClearSelection };
    }, [onSelect, onClearSelection]);

    useImperativeHandle(
        ref,
        () => ({
            fit: () => network.current && network.current.fit({ animation: true }),
            zoom: (factor) => {
                if (network.current) {
                    network.current.moveTo({
                        scale: Math.max(0.15, Math.min(3, network.current.getScale() * factor)),
                        animation: true
                    });
                }
            }
        }),
        []
    );

    useEffect(() => {
        const relationshipItems = items.filter(
            (item) => item.type === 'goal' || item.type === 'metric'
        );
        const entryIds = new Set(relationshipItems.map((item) => item.id));
        const labelsById = new Map(labels.map((label) => [label.id, label]));
        const nextNodes: Node[] = relationshipItems.map((item) => {
            const goalCategory = item.goalCategory ?? 'Delivery';
            const info =
                item.type === 'goal' ? goalCategoryStyles[goalCategory] : entryTypes[item.type];
            const isSubgoal =
                item.type === 'goal' &&
                items.some((parent) => parent.type === 'goal' && parent.childIds.includes(item.id));
            const label =
                item.type === 'goal'
                    ? `${goalCategory}${isSubgoal ? ' · Sub-goal' : ''}`
                    : entryTypes[item.type].label;
            const metric =
                item.type === 'metric'
                    ? `\n<code>${item.currentValue ?? 'Not set'} / ${item.targetValue ?? 'Not set'} ${labelText(item.unit || '')}</code>`
                    : '';
            const assignedLabels = (item.labelIds ?? [])
                .map((id) => labelsById.get(id)?.name)
                .filter((name): name is string => Boolean(name));
            const labelLine = assignedLabels.length
                ? `\n<code>${assignedLabels
                      .slice(0, 2)
                      .map((name) => `# ${labelText(name)}`)
                      .join(
                          ' · '
                      )}${assignedLabels.length > 2 ? ` +${assignedLabels.length - 2}` : ''}</code>`
                : '';
            const title = [
                `${label}: ${item.name}`,
                item.type === 'metric'
                    ? `Progress: ${item.currentValue ?? 'Not set'} / ${item.targetValue ?? 'Not set'} ${item.unit || ''}`
                    : '',
                item.assignees.length
                    ? `Assignees: ${item.assignees.map((assignee) => assignee.displayName).join(', ')}`
                    : '',
                assignedLabels.length ? `Labels: ${assignedLabels.join(', ')}` : '',
                item.description
            ]
                .filter(Boolean)
                .join('\n');
            return {
                id: item.id,
                label: `<b>${label}</b>\n${labelText(item.name)}${metric}${labelLine}`,
                title,
                hidden: data.nodes.get(item.id)?.hidden ?? false,
                color: { background: info.color, border: info.border }
            };
        });
        const nextEdges: Edge[] = relationshipItems.flatMap((item) =>
            item.childIds
                .filter((childId) => entryIds.has(childId))
                .map((childId) => ({
                    id: `${item.id}:${childId}`,
                    from: item.id,
                    to: childId,
                    hidden: data.edges.get(`${item.id}:${childId}`)?.hidden ?? false
                }))
        );
        const edgeIds = new Set(nextEdges.map((edge) => edge.id));
        data.edges.remove(data.edges.getIds().filter((id) => !edgeIds.has(id)));
        data.nodes.remove(data.nodes.getIds().filter((id) => !entryIds.has(String(id))));
        const changedNodes = nextNodes.filter(
            (node) => JSON.stringify(data.nodes.get(node.id!)) !== JSON.stringify(node)
        );
        const changedEdges = nextEdges.filter(
            (edge) => JSON.stringify(data.edges.get(edge.id!)) !== JSON.stringify(edge)
        );
        if (changedNodes.length) data.nodes.update(changedNodes);
        if (changedEdges.length) data.edges.update(changedEdges);
    }, [items, labels, data]);

    useEffect(() => {
        if (!container.current) return;
        const instance = new Network(container.current, data, {
            autoResize: true,
            layout: {
                randomSeed: 12,
                hierarchical:
                    mode === 'tree'
                        ? {
                              enabled: true,
                              direction: 'UD',
                              sortMethod: 'directed',
                              levelSeparation: 180,
                              nodeSpacing: 290
                          }
                        : false
            },
            physics:
                mode === 'tree'
                    ? false
                    : {
                          stabilization: { iterations: 150 },
                          barnesHut: { gravitationalConstant: -6500, springLength: 220 }
                      },
            nodes: {
                shape: 'box',
                margin: { top: 14, right: 18, bottom: 16, left: 18 },
                widthConstraint: { minimum: 220, maximum: 260 },
                shapeProperties: { borderRadius: 4 },
                borderWidth: 1.5,
                chosen: { node: true, label: false },
                font: {
                    face: 'Helvetica Neue, Segoe UI, sans-serif',
                    size: 15,
                    color: '#172b4d',
                    align: 'left',
                    multi: 'html',
                    bold: {
                        size: 10,
                        face: 'Atlassian Sans, sans-serif',
                        mod: '',
                        color: '#626f86'
                    },
                    mono: {
                        size: 11,
                        face: 'Atlassian Sans, sans-serif',
                        mod: '',
                        color: '#626f86'
                    }
                },
                color: {
                    highlight: { background: '#e9f2ff', border: '#0c66e4' },
                    hover: { background: '#f1f2f4', border: '#0c66e4' }
                }
            },
            edges: {
                arrows: {
                    from: { enabled: true, scaleFactor: 0.65 },
                    to: { enabled: false, scaleFactor: 0.65 }
                },
                color: { color: '#8590a2', highlight: '#0c66e4' },
                smooth: mode !== 'tree',
                width: 1.5
            },
            interaction: { hover: true, hideEdgesOnDrag: false, keyboard: false },
            height: '100%',
            width: '100%'
        });
        network.current = instance;
        instance.on('selectNode', ({ nodes }: { nodes: Array<string | number> }) => {
            if (nodes.length) {
                instance.stopSimulation();
                instance.setOptions({ physics: { enabled: false } });
                callbacks.current.onSelect(String(nodes[0]));
            }
        });
        instance.on('click', ({ nodes }: { nodes: Array<string | number> }) => {
            if (!nodes.length) callbacks.current.onClearSelection?.();
        });
        instance.once('stabilizationIterationsDone', () => {
            instance.fit();
            instance.setOptions({ physics: { enabled: false } });
        });
        return () => {
            network.current = null;
            instance.destroy();
        };
    }, [data, mode]);

    useEffect(() => {
        const shownIds = new Set(
            visibleIds ?? items.filter((item) => item.type !== 'group').map((item) => item.id)
        );
        const changedNodes = data.nodes
            .get()
            .filter((node) => Boolean(node.hidden) !== !shownIds.has(String(node.id)))
            .map((node) => ({ id: node.id!, hidden: !shownIds.has(String(node.id)) }));
        const changedEdges = data.edges
            .get()
            .filter(
                (edge) =>
                    Boolean(edge.hidden) !==
                    !(shownIds.has(String(edge.from)) && shownIds.has(String(edge.to)))
            )
            .map((edge) => ({
                id: edge.id!,
                hidden: !(shownIds.has(String(edge.from)) && shownIds.has(String(edge.to)))
            }));
        if (changedNodes.length) data.nodes.update(changedNodes);
        if (changedEdges.length) data.edges.update(changedEdges);
    }, [visibleIds, items, selectedId, data, mode]);

    useEffect(() => {
        const selectionExists = items.some(
            (item) =>
                item.id === selectedId && item.type !== 'group' && !data.nodes.get(item.id)?.hidden
        );
        if (network.current)
            network.current.selectNodes(selectionExists && selectedId ? [selectedId] : [], false);
    }, [selectedId, items, mode, data, visibleIds]);

    return (
        <div
            ref={container}
            className="network-canvas"
            role="img"
            aria-label={`${mode === 'tree' ? 'Tree' : 'Graph'} of goals and metrics. Groups are hidden; shared goals keep all parent relationships.`}
        />
    );
});

export default ItemGraph;
