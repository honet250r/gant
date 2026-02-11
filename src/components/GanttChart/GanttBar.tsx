import * as React from 'react';
import type { Task, ViewMode } from '../../types';
import { getDatePosition, getBarWidth, TIMELINE_CONFIGS, getTaskStatus } from '../../utils/ganttUtils';
import { addDays } from 'date-fns';

import { useTaskStore } from '../../stores/taskStore';

interface GanttBarProps {
    task: Task;
    projectStartDate: Date;
    viewMode: ViewMode;
    onTaskUpdate: (id: string, updates: Partial<Task>) => void;
    isParent?: boolean;
}

export function GanttBar({
    task,
    projectStartDate,
    viewMode,
    onTaskUpdate,
    isParent = false
}: GanttBarProps) {
    const { editingProgressTaskId, setEditingProgressTaskId } = useTaskStore();
    const isEditingProgress = editingProgressTaskId === task.id;

    const barRef = React.useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = React.useState(false);
    const [isResizing, setIsResizing] = React.useState<'left' | 'right' | null>(null);
    const [dragStart, setDragStart] = React.useState({
        x: 0,
        initialStartDate: new Date(),
        initialEndDate: new Date()
    });
    const [mouseDownTime, setMouseDownTime] = React.useState(0);
    const [floatingPosition, setFloatingPosition] = React.useState<'top' | 'bottom'>('top');

    const updateFloatingPosition = () => {
        if (barRef.current) {
            const rect = barRef.current.getBoundingClientRect();
            // The sticky header and page toolbar occupy significant space (roughly 150-200px).
            // Threshold 300px ensures that even items in the first few rows flip to 'bottom'
            // to avoid being clipped by the persistent UI elements.
            if (rect.top < 300) {
                setFloatingPosition('bottom');
            } else {
                setFloatingPosition('top');
            }
        }
    };

    // Summary tasks should not be interactive (they are auto-calculated)
    const canInteract = !isParent;

    const left = getDatePosition(task.startDate, projectStartDate, viewMode);
    const width = getBarWidth(task.startDate, task.endDate, viewMode);

    const config = TIMELINE_CONFIGS[viewMode];
    const status = getTaskStatus(task);
    const statusColor = status === 'delayed' ? '#ef4444' : task.color;

    const handleMouseDown = (e: React.MouseEvent, type: 'drag' | 'resize-left' | 'resize-right') => {
        if (!canInteract) return;

        e.stopPropagation();
        setMouseDownTime(Date.now());

        const startState = {
            x: e.clientX,
            initialStartDate: new Date(task.startDate),
            initialEndDate: new Date(task.endDate)
        };

        if (type === 'drag') {
            setIsDragging(true);
            setDragStart(startState);
        } else if (type === 'resize-left') {
            setIsResizing('left');
            setDragStart(startState);
        } else if (type === 'resize-right') {
            setIsResizing('right');
            setDragStart(startState);
        }
    };

    React.useEffect(() => {
        if (!isDragging && !isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - dragStart.x;
            const daysDiff = Math.round(deltaX / config.cellWidth);

            if (daysDiff === 0) return;

            if (isDragging) {
                if (onTaskUpdate) {
                    onTaskUpdate(task.id, {
                        startDate: addDays(dragStart.initialStartDate, daysDiff),
                        endDate: addDays(dragStart.initialEndDate, daysDiff),
                    });
                }
            } else if (isResizing === 'left') {
                if (onTaskUpdate) {
                    const newStartDate = addDays(dragStart.initialStartDate, daysDiff);
                    if (newStartDate <= task.endDate) {
                        onTaskUpdate(task.id, { startDate: newStartDate });
                    }
                }
            } else if (isResizing === 'right') {
                if (onTaskUpdate) {
                    const newEndDate = addDays(dragStart.initialEndDate, daysDiff);
                    if (newEndDate >= task.startDate) {
                        onTaskUpdate(task.id, { endDate: newEndDate });
                    }
                }
            }
        };

        const handleMouseUp = (e: MouseEvent) => {
            const duration = Date.now() - mouseDownTime;
            const deltaX = Math.abs(e.clientX - dragStart.x);

            // If it was a short click without much movement, open progress editor
            if (!isResizing && deltaX < 5 && duration < 250) {
                updateFloatingPosition();
                setEditingProgressTaskId(isEditingProgress ? null : task.id);
            }

            setIsDragging(false);
            setIsResizing(null);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isResizing, dragStart, task, config.cellWidth, onTaskUpdate, setEditingProgressTaskId]);

    // Close progress editor on outside click
    React.useEffect(() => {
        if (!isEditingProgress) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (barRef.current && !barRef.current.contains(e.target as Node)) {
                setEditingProgressTaskId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isEditingProgress, setEditingProgressTaskId]);

    const cursorClass = isDragging ? 'cursor-grabbing' : isResizing ? 'cursor-ew-resize' : canInteract ? 'cursor-pointer' : 'cursor-default';

    return (
        <div
            ref={barRef}
            className={`absolute h-7 transition-all duration-300 ${cursorClass} group`}
            style={{
                left: `${left}px`,
                width: `${width}px`,
                top: '50%',
                transform: 'translateY(-50%)',
                opacity: isDragging || isResizing ? 0.7 : 1,
                zIndex: isDragging || isResizing || isEditingProgress ? 100 : 1,
            }}
        >
            {isParent ? (
                /* Summary task (Parent) styling: A bracket-like shape */
                <div className="relative h-full w-full">
                    {/* Main bar */}
                    <div
                        className="absolute top-1/2 -translate-y-1/2 h-2 w-full rounded-sm"
                        style={{ backgroundColor: '#475569' }} // Slate 600
                    />
                    {/* Left point/bracket */}
                    <div
                        className="absolute left-0 top-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-t-[8px] border-t-slate-600"
                        style={{ borderTopColor: '#475569' }}
                    />
                    {/* Right point/bracket */}
                    <div
                        className="absolute right-0 top-1/2 w-0 h-0 border-r-[6px] border-r-transparent border-t-[8px] border-t-slate-600"
                        style={{ borderTopColor: '#475569' }}
                    />
                </div>
            ) : (
                /* Standard task bar with progress */
                <div
                    className="relative h-full w-full rounded-md shadow-sm overflow-hidden flex items-center bg-white/20"
                    style={{ backgroundColor: `${statusColor}22`, border: `1px solid ${status === 'delayed' ? '#ef4444' : `${statusColor}66`}` }}
                    onMouseDown={(e) => handleMouseDown(e, 'drag')}
                >
                    {/* Progress bar */}
                    <div
                        className="absolute left-0 top-0 h-full transition-all duration-300 ease-out"
                        style={{
                            width: `${task.progress}%`,
                            backgroundColor: task.color,
                        }}
                    />

                    {/* Resize handles */}
                    {canInteract && (
                        <>
                            <div
                                className="absolute left-0 top-0 w-2 h-full cursor-ew-resize hover:bg-black/10 z-30 flex items-center justify-center group/handle"
                                onMouseDown={(e) => handleMouseDown(e, 'resize-left')}
                            >
                                <div className="w-0.5 h-3 bg-white/50 rounded-full opacity-0 group-hover/handle:opacity-100" />
                            </div>
                            <div
                                className="absolute right-0 top-0 w-2 h-full cursor-ew-resize hover:bg-black/10 z-30 flex items-center justify-center group/handle"
                                onMouseDown={(e) => handleMouseDown(e, 'resize-right')}
                            >
                                <div className="w-0.5 h-3 bg-white/50 rounded-full opacity-0 group-hover/handle:opacity-100" />
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Task Details Label (Right of the bar) */}
            <div className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] font-medium text-gray-500 pointer-events-none">
                {task.name} ({task.assignee || '未設定'}：{task.progress}%)
            </div>

            {/* Progress Quick Edit Popover */}
            {isEditingProgress && (
                <div
                    className={`absolute z-[110] left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-2xl border border-gray-200 p-3 min-w-[200px] animate-in fade-in zoom-in ${floatingPosition === 'top'
                        ? 'bottom-[calc(100%+8px)] slide-in-from-bottom-2'
                        : 'top-[calc(100%+8px)] slide-in-from-top-2'
                        }`}
                    onMouseDown={(e) => e.stopPropagation()} // Prevent drag start when clicking popover
                >
                    <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider flex justify-between items-center px-1">
                        <span>進捗率を更新</span>
                        <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{task.progress}%</span>
                    </div>

                    {/* Quick Buttons */}
                    <div className="flex gap-2 mb-3">
                        {[0, 50, 100].map((val) => (
                            <button
                                key={val}
                                onClick={() => {
                                    onTaskUpdate(task.id, { progress: val });
                                    setEditingProgressTaskId(null);
                                }}
                                className={`flex-1 py-1.5 rounded-md text-xs font-semibold border transition-all ${task.progress === val
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                    : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                                    }`}
                            >
                                {val}%
                            </button>
                        ))}
                    </div>

                    {/* Slider */}
                    <div className="px-1">
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={task.progress}
                            onChange={(e) => onTaskUpdate(task.id, { progress: Number(e.target.value) })}
                            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-medium">
                            <span>0%</span>
                            <span>50%</span>
                            <span>100%</span>
                        </div>
                    </div>

                    {/* Popover Arrow */}
                    <div className={`absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-white border transform rotate-45 ${floatingPosition === 'top'
                        ? '-bottom-1.5 border-r border-b border-gray-200'
                        : '-top-1.5 border-l border-t border-gray-200'
                        }`} />
                </div>
            )}
        </div>
    );
}
