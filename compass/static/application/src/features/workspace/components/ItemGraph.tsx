import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Network } from 'vis-network/standalone';
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
}

const ItemGraph = forwardRef<GraphHandle, ItemGraphProps>(function ItemGraph(
    { items, labels, selectedId, mode, onSelect },
    ref
) {
    const container = useRef<HTMLDivElement>(null);
    const network = useRef<Network | null>(null);

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
        if (!container.current) return;
        const relationshipItems = items.filter(
            (item) => item.type === 'goal' || item.type === 'metric'
        );
        const visibleIds = new Set(relationshipItems.map((item) => item.id));
        const labelsById = new Map(labels.map((label) => [label.id, label]));
        const instance = new Network(
            container.current,
            {
                nodes: relationshipItems.map((item) => {
                    const goalCategory = item.goalCategory ?? 'Delivery';
                    const info =
                        item.type === 'goal'
                            ? goalCategoryStyles[goalCategory]
                            : entryTypes[item.type];
                    const isSubgoal =
                        item.type === 'goal' &&
                        items.some(
                            (parent) => parent.type === 'goal' && parent.childIds.includes(item.id)
                        );
                    const label =
                        item.type === 'goal'
                            ? `${goalCategory}${isSubgoal ? ' · Sub-goal' : ''}`
                            : entryTypes[item.type].label;
                    const metric =
                        item.type === 'metric'
                            ? `\n${item.currentValue ?? 'Not set'} / ${item.targetValue ?? 'Not set'} ${item.unit || ''}`
                            : '';
                    const assignedLabels = (item.labelIds ?? [])
                        .map((id) => labelsById.get(id)?.name)
                        .filter((name): name is string => Boolean(name));
                    const labelLine = assignedLabels.length
                        ? `\n${assignedLabels
                              .slice(0, 2)
                              .map((name) => `# ${name}`)
                              .join(
                                  ' · '
                              )}${assignedLabels.length > 2 ? ` +${assignedLabels.length - 2}` : ''}`
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
                        label: `${label}\n${item.name}${metric}${labelLine}`,
                        title,
                        color: { background: info.color, border: info.border }
                    };
                }),
                edges: relationshipItems.flatMap((item) =>
                    item.childIds
                        .filter((childId) => visibleIds.has(childId))
                        .map((childId) => ({ from: item.id, to: childId }))
                )
            },
            {
                autoResize: true,
                layout: {
                    randomSeed: 12,
                    hierarchical:
                        mode === 'tree'
                            ? {
                                  enabled: true,
                                  direction: 'UD',
                                  sortMethod: 'directed',
                                  levelSeparation: 155,
                                  nodeSpacing: 250
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
                    margin: { top: 14, right: 18, bottom: 14, left: 18 },
                    widthConstraint: { minimum: 190, maximum: 230 },
                    shapeProperties: { borderRadius: 4 },
                    borderWidth: 1.5,
                    font: { face: 'Atlassian Sans, sans-serif', size: 13, color: '#172b4d' },
                    color: {
                        highlight: { background: '#e9f2ff', border: '#0c66e4' },
                        hover: { background: '#f1f2f4', border: '#0c66e4' }
                    }
                },
                edges: {
                    arrows: { to: { enabled: true, scaleFactor: 0.65 } },
                    color: { color: '#8590a2', highlight: '#0c66e4' },
                    smooth: mode !== 'tree',
                    width: 1.5
                },
                interaction: { hover: true, hideEdgesOnDrag: false, keyboard: false },
                height: '100%',
                width: '100%'
            }
        );
        network.current = instance;
        instance.on('selectNode', ({ nodes }: { nodes: Array<string | number> }) => {
            if (nodes.length) onSelect(String(nodes[0]));
        });
        instance.once('stabilizationIterationsDone', () => instance.fit());
        return () => {
            network.current = null;
            instance.destroy();
        };
    }, [items, labels, mode, onSelect]);

    useEffect(() => {
        const selectionExists = items.some(
            (item) => item.id === selectedId && item.type !== 'group'
        );
        if (network.current)
            network.current.selectNodes(selectionExists && selectedId ? [selectedId] : [], false);
    }, [selectedId, items, mode]);

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
