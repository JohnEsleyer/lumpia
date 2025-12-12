import React, { useRef, useState, useEffect } from 'react';
import { type TimelineItem as TimelineItemType } from '../../types';
import { GripVertical } from 'lucide-react';

interface TimelineItemProps {
    item: TimelineItemType;
    pixelsPerSecond: number;
    height: number;
    onDrag: (id: string, newStart: number) => void;
    onTrim: (id: string, newStartOffset: number, newDuration: number, trimStart: boolean) => void;
    onClick: (id: string) => void;
    selected: boolean;
    name: string; // Asset name for display
}

export const TimelineItem: React.FC<TimelineItemProps> = ({
    item,
    pixelsPerSecond,
    height,
    onDrag,
    onTrim,
    onClick,
    selected,
    name
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [dragStartX, setDragStartX] = useState(0);
    const [originalItemStart, setOriginalItemStart] = useState(0);
    const itemRef = useRef<HTMLDivElement>(null);

    const width = item.duration * pixelsPerSecond;
    const left = item.start * pixelsPerSecond;

    const handleMouseDown = (e: React.MouseEvent) => {
        e.stopPropagation();
        onClick(item.id);
        setIsDragging(true);
        setDragStartX(e.clientX);
        setOriginalItemStart(item.start);
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            const deltaX = e.clientX - dragStartX;
            const deltaSeconds = deltaX / pixelsPerSecond;
            const newStart = Math.max(0, originalItemStart + deltaSeconds);
            onDrag(item.id, newStart);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragStartX, originalItemStart, pixelsPerSecond, onDrag, item.id]);

    return (
        <div
            ref={itemRef}
            className={`absolute rounded-md overflow-hidden border-2 ${selected ? 'border-yellow-500 z-10' : 'border-slate-600 bg-slate-800'}`}
            style={{
                left: `${left}px`,
                width: `${width}px`,
                height: `${height - 4}px`, // Slight padding
                top: '2px',
                cursor: isDragging ? 'grabbing' : 'grab'
            }}
            onMouseDown={handleMouseDown}
        >
            <div className="flex items-center h-full px-2 gap-2 bg-slate-700/50 hover:bg-slate-700/80 transition-colors pointer-events-none select-none">
                <GripVertical size={14} className="text-slate-400" />
                <span className="text-xs text-white truncate">{name}</span>
            </div>

            {/* Simple trim handles - implementation can be expanded later */}
            {/* Trim Handles */}
            <div
                className="absolute left-0 top-0 bottom-0 w-2 hover:bg-yellow-500/50 cursor-ew-resize z-20"
                onMouseDown={(e) => {
                    e.stopPropagation();
                    const startX = e.clientX;
                    const originalDuration = item.duration;
                    const originalOffset = item.startOffset;

                    const handleMouseMove = (moveEvent: MouseEvent) => {
                        const deltaX = moveEvent.clientX - startX;
                        const deltaSeconds = deltaX / pixelsPerSecond;

                        // Limit start trim so we don't exceed duration or go below 0 offset (if applicable)
                        // Allow trimming up to duration
                        const newDuration = Math.max(0.1, originalDuration - deltaSeconds);
                        const newOffset = Math.max(0, originalOffset + deltaSeconds);

                        if (newDuration > 0.1) {
                            onTrim(item.id, newOffset, newDuration, true);
                        }
                    };

                    const handleMouseUp = () => {
                        window.removeEventListener('mousemove', handleMouseMove);
                        window.removeEventListener('mouseup', handleMouseUp);
                    };

                    window.addEventListener('mousemove', handleMouseMove);
                    window.addEventListener('mouseup', handleMouseUp);
                }}
            />
            <div
                className="absolute right-0 top-0 bottom-0 w-2 hover:bg-yellow-500/50 cursor-ew-resize z-20"
                onMouseDown={(e) => {
                    e.stopPropagation();
                    const startX = e.clientX;
                    const originalDuration = item.duration;

                    const handleMouseMove = (moveEvent: MouseEvent) => {
                        const deltaX = moveEvent.clientX - startX;
                        const deltaSeconds = deltaX / pixelsPerSecond;
                        const newDuration = Math.max(0.1, originalDuration + deltaSeconds);

                        onTrim(item.id, item.startOffset, newDuration, false);
                    };

                    const handleMouseUp = () => {
                        window.removeEventListener('mousemove', handleMouseMove);
                        window.removeEventListener('mouseup', handleMouseUp);
                    };

                    window.addEventListener('mousemove', handleMouseMove);
                    window.addEventListener('mouseup', handleMouseUp);
                }}
            />
        </div>
    );
};
