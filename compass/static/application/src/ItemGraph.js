import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Network } from 'vis-network/standalone';
import { entryTypes } from './entries';

const ItemGraph = forwardRef(function ItemGraph({ items, selectedId, mode, onSelect }, ref) {
    const container = useRef(null);
    const network = useRef(null);

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
        const visibleIds = new Set(relationshipItems.map((item) => item.id));
        const instance = new Network(
            container.current,
            {
                nodes: relationshipItems.map((item) => {
                    const info = entryTypes[item.type || 'folder'];
                    const label =
                        item.type === 'goal' &&
                        items.some(
                            (parent) => parent.type === 'goal' && parent.childIds.includes(item.id)
                        )
                            ? 'Sub-goal'
                            : info.label;
                    const metric =
                        item.type === 'metric'
                            ? `\n${item.currentValue ?? 'Not set'} / ${item.targetValue ?? 'Not set'} ${item.unit || ''}`
                            : '';
                    return {
                        id: item.id,
                        label: `${label}\n${item.name}${metric}`,
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
                                  levelSeparation: 130,
                                  nodeSpacing: 210
                              }
                            : false
                },
                physics:
                    mode === 'tree'
                        ? false
                        : {
                              stabilization: { iterations: 150 },
                              barnesHut: { gravitationalConstant: -4500, springLength: 170 }
                          },
                nodes: {
                    shape: 'box',
                    margin: 16,
                    widthConstraint: { maximum: 180 },
                    shapeProperties: { borderRadius: 4 },
                    borderWidth: 1.5,
                    font: { face: 'sans-serif', size: 15, color: '#172b4d' },
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
        instance.on('selectNode', ({ nodes }) => onSelect(nodes[0]));
        instance.once('stabilizationIterationsDone', () => instance.fit());
        return () => {
            network.current = null;
            instance.destroy();
        };
    }, [items, mode, onSelect]);

    useEffect(() => {
        const selectionExists = items.some(
            (item) => item.id === selectedId && item.type !== 'folder'
        );
        if (network.current)
            network.current.selectNodes(selectionExists ? [selectedId] : [], false);
    }, [selectedId, items, mode]);

    return (
        <div
            ref={container}
            className="network-canvas"
            role="img"
            aria-label={`${mode === 'tree' ? 'Tree' : 'Graph'} of goals and metrics. Folders are hidden; shared goals keep all parent relationships.`}
        />
    );
});

export default ItemGraph;
