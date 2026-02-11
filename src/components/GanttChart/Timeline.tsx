import * as React from 'react';
import { useTaskStore } from '../../stores/taskStore';
import type { ViewMode, Task } from '../../types';
import { TodayMarker } from './TodayMarker';
import { GanttBar } from './GanttBar';
import { generateTimelineColumns, TIMELINE_CONFIGS, getTaskStatus, isHoliday } from '../../utils/ganttUtils';
import { format } from 'date-fns';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, AlertCircle, CheckCircle2, Rocket, TrendingUp, Trash2, ChevronDown, ChevronRight, IndentIncrease, IndentDecrease } from 'lucide-react';

interface TimelineProps {
    projectId: string;
    projectStartDate: Date;
    projectEndDate: Date;
    viewMode: ViewMode;
    onEditTask: (task: Task) => void;
    hideCompleted?: boolean;
    showDelayedOnly?: boolean;
    assigneeFilter?: string;
    customHolidays: string[];
    onToggleHoliday: (date: Date) => void;
}

interface TaskWithLevel extends Task {
    level: number;
    hasChildren: boolean;
    isLastChild: boolean;
    activeLevels: boolean[];
}

interface TimelineHeaderProps {
    startDate: Date;
    endDate: Date;
    viewMode: ViewMode;
    sidebarWidth: number;
    customHolidays: string[];
    onToggleHoliday: (date: Date) => void;
}

export function TimelineHeader({
    startDate,
    endDate,
    viewMode,
    sidebarWidth,
    customHolidays,
    onToggleHoliday
}: TimelineHeaderProps) {
    const columns = generateTimelineColumns(startDate, endDate, viewMode);
    const config = TIMELINE_CONFIGS[viewMode];

    return (
        <div className="flex-shrink-0 border-b border-gray-200 bg-white sticky top-0 z-30">
            <div className="flex">
                {/* Empty corner for sidebar */}
                <div
                    className="flex-shrink-0 border-r border-gray-200 bg-gray-50"
                    style={{ width: `${sidebarWidth}px` }}
                >
                    <div className="h-10 flex items-center px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">タスク名 / 担当</div>
                    <div className="h-10 flex items-center px-4 text-xs font-medium text-gray-400 border-t border-gray-100 italic">Timeline Header</div>
                </div>

                {/* Timeline Header */}
                <div className="flex-1 overflow-hidden">
                    {/* Top row: Months/Years */}
                    <div className="h-10 flex border-b border-gray-200 bg-gray-50/50">
                        {columns.map((date, index) => {
                            const label = viewMode === 'day' ? format(date, 'yyyy年 M月') :
                                viewMode === 'week' ? format(date, 'yyyy年 M月') :
                                    format(date, 'yyyy年');

                            const isNewPeriod = index === 0 ||
                                (viewMode === 'day' && date.getDate() === 1) ||
                                (viewMode === 'week' && date.getDay() === 0) ||
                                (viewMode === 'month' && date.getDate() === 1);

                            const periodWidth = columns.filter((d) => {
                                if (viewMode === 'day' || viewMode === 'week') return d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
                                return d.getFullYear() === date.getFullYear();
                            }).length * config.cellWidth;

                            if (!isNewPeriod) return null;

                            return (
                                <div
                                    key={index}
                                    className="flex-shrink-0 text-center text-xs font-bold text-gray-600 flex items-center justify-center border-r border-gray-200"
                                    style={{ width: `${periodWidth}px` }}
                                >
                                    {label}
                                </div>
                            );
                        })}
                    </div>

                    {/* Bottom row: Days/Weeks/Months */}
                    <div className="h-10 flex">
                        {columns.map((date, index) => {
                            const dateStr = format(date, 'yyyy-MM-dd');
                            const isSat = viewMode === 'day' && date.getDay() === 6;
                            const isSun = viewMode === 'day' && date.getDay() === 0;
                            const isHol = viewMode === 'day' && (isHoliday(date) || customHolidays.includes(dateStr));
                            const isCustomHol = viewMode === 'day' && customHolidays.includes(dateStr);

                            return (
                                <div
                                    key={index}
                                    onClick={() => viewMode === 'day' && onToggleHoliday(date)}
                                    className={`flex-shrink-0 border-r px-2 py-3 text-center text-sm font-bold transition-colors cursor-pointer select-none group/header-cell relative ${isSat ? 'bg-gray-300/60 text-blue-600' :
                                        (isSun || isHol) ? 'bg-gray-300/60 text-red-600' :
                                            'text-gray-700 hover:bg-gray-100'
                                        } ${isCustomHol ? 'ring-2 ring-inset ring-red-400/30' : ''}`}
                                    style={{ width: `${config.cellWidth}px` }}
                                    title={viewMode === 'day' ? (isCustomHol ? '独自休日を解除' : '独自休日として設定') : undefined}
                                >
                                    {config.label(date)}
                                    {viewMode === 'day' && (
                                        <div className="absolute top-1 right-1 opacity-0 group-hover/header-cell:opacity-100 transition-opacity">
                                            <div className={`w-1.5 h-1.5 rounded-full ${isCustomHol ? 'bg-red-500' : 'bg-gray-400'}`} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

function SortableTimelineRow({
    task,
    startDate,
    viewMode,
    onTaskUpdate,
    onEdit,
    onDelete,
    level = 0,
    isParent = false,
    isCollapsed = false,
    onToggleCollapse,
    isSelected = false,
    onSelect,
    onIndent,
    onOutdent,
    sidebarWidth,
    isLastChild = false,
    activeLevels = [],
}: {
    task: Task;
    startDate: Date;
    viewMode: ViewMode;
    onTaskUpdate: (id: string, updates: Partial<Task>) => void;
    onEdit: (task: Task) => void;
    onDelete: (id: string) => void;
    level?: number;
    isParent?: boolean;
    isCollapsed?: boolean;
    onToggleCollapse?: (id: string) => void;
    isSelected?: boolean;
    onSelect?: (id: string) => void;
    onIndent?: (id: string) => void;
    onOutdent?: (id: string) => void;
    sidebarWidth: number;
    isLastChild?: boolean;
    activeLevels?: boolean[];
}) {
    const { editingProgressTaskId } = useTaskStore();
    const isEditingProgress = editingProgressTaskId === task.id;

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
    const status = getTaskStatus(task);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={() => onSelect?.(task.id)}
            className={`flex group border-b border-gray-200 transition-colors h-10 relative ${isDragging || isEditingProgress ? 'z-[100] bg-blue-50/50 ring-1 ring-blue-200 shadow-sm' : isSelected ? 'z-[90] bg-blue-50/30' : isParent ? 'z-10 bg-gray-50/10' : 'z-10 bg-transparent'
                } hover:bg-gray-100/30 hover:z-[80] cursor-pointer`}
        >
            {/* Task Info Column (Sticky) */}
            <div
                className="flex-shrink-0 border-r bg-white sticky left-0 z-40 flex items-center px-2 py-1 gap-1.5 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] overflow-hidden"
                style={{ width: `${sidebarWidth}px` }}
            >
                <button
                    {...attributes}
                    {...listeners}
                    className="text-gray-300 hover:text-blue-500 cursor-grab active:cursor-grabbing transition-colors p-1"
                >
                    <GripVertical size={14} />
                </button>
                <div className="flex-1 min-w-0 pr-1 flex items-center relative" style={{ paddingLeft: `${level * 20}px` }}>
                    {/* Refined Tree Lines */}
                    {level > 0 && (
                        <div className="absolute left-0 top-0 bottom-0 pointer-events-none" style={{ width: `${level * 20}px` }}>
                            {activeLevels.map((isActive, i) => (
                                isActive && i < level - 1 && (
                                    <div
                                        key={i}
                                        className="absolute border-l-2 border-gray-300"
                                        style={{
                                            left: `${i * 20 + 9}px`,
                                            top: '0',
                                            bottom: '0'
                                        }}
                                    />
                                )
                            ))}

                            <div
                                className="absolute border-l-2 border-gray-300"
                                style={{
                                    left: `${(level - 1) * 20 + 9}px`,
                                    top: '0',
                                    height: '50%'
                                }}
                            />
                            <div
                                className={`absolute border-b-2 border-gray-300 ${isLastChild ? 'rounded-bl-[4px]' : ''}`}
                                style={{
                                    left: `${(level - 1) * 20 + 9}px`,
                                    top: '50%',
                                    width: '14px'
                                }}
                            />

                            {!isLastChild && (
                                <div
                                    className="absolute border-l-2 border-gray-300"
                                    style={{
                                        left: `${(level - 1) * 20 + 9}px`,
                                        top: '50%',
                                        bottom: '0'
                                    }}
                                />
                            )}
                        </div>
                    )}

                    <div className="flex items-center gap-1.5 flex-1 min-w-0 relative z-10">
                        {isParent && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onToggleCollapse?.(task.id); }}
                                className="p-0.5 hover:bg-gray-200 rounded transition-colors text-gray-500 z-20"
                            >
                                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            </button>
                        )}
                        {!isParent && <div className="w-[18px]" />}

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 overflow-hidden">
                                <span
                                    className={`text-sm truncate cursor-pointer hover:underline decoration-blue-500 underline-offset-2 font-bold text-blue-900 hover:text-blue-950`}
                                    title={`${task.name} (クリックして編集)`}
                                    onClick={(e) => { e.stopPropagation(); onEdit(task); }}
                                >
                                    {task.name}
                                </span>
                                {(() => {
                                    if (status === 'delayed') return <span title="遅延"><AlertCircle size={12} className="text-red-500 shrink-0" /></span>;
                                    if (status === 'on-track') return <span title="順調"><TrendingUp size={12} className="text-blue-400 shrink-0" /></span>;
                                    if (status === 'ahead') return <span title="先行"><Rocket size={12} className="text-green-500 shrink-0" /></span>;
                                    if (status === 'completed') return <span title="完了"><CheckCircle2 size={12} className="text-gray-400 shrink-0" /></span>;
                                    return null;
                                })()}
                            </div>
                            <div className="text-xs text-gray-600 truncate -mt-0.5" title={task.assignee || (isParent ? '子タスク合計' : '未設定')}>
                                {task.assignee || (isParent ? '子タスク合計' : '未設定')}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    <button
                        onClick={(e) => { e.stopPropagation(); onOutdent?.(task.id); }}
                        className="p-1 text-gray-400 hover:text-blue-500 rounded hover:bg-white transition-colors"
                        title="レベルを上げる (Shift+Tab)"
                    >
                        <IndentDecrease size={12} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onIndent?.(task.id); }}
                        className="p-1 text-gray-400 hover:text-blue-500 rounded hover:bg-white transition-colors"
                        title="レベルを下げる (Tab)"
                    >
                        <IndentIncrease size={12} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-white transition-colors" title="削除">
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>

            {/* Gantt Bar Area */}
            <div className="flex-1 relative min-h-full">
                <GanttBar
                    task={task}
                    projectStartDate={startDate}
                    viewMode={viewMode}
                    onTaskUpdate={onTaskUpdate}
                    isParent={isParent}
                />
            </div>
        </div>
    );
}

export function Timeline({
    projectId,
    projectStartDate,
    projectEndDate,
    viewMode,
    onEditTask,
    hideCompleted = false,
    showDelayedOnly = false,
    assigneeFilter = 'all',
    customHolidays,
    onToggleHoliday
}: TimelineProps) {
    const { tasks, updateTask, deleteTask, reorderTasks, collapsedTaskIds, toggleTaskCollapsed, indentTask, outdentTask, selectedTaskId, setSelectedTaskId, sidebarWidth, setSidebarWidth, editingProgressTaskId } = useTaskStore();

    // Apply filters and build tree
    const projectTasks = React.useMemo(() => {
        const filtered = tasks.filter((t) => t.projectId === projectId);

        const buildFlattenedTree = (parentId: string | undefined = undefined, level: number = 0, parentActiveLevels: boolean[] = []): TaskWithLevel[] => {
            const potentialSiblings = filtered
                .filter(t => t.parentId === parentId)
                .sort((a, b) => a.sortOrder - b.sortOrder);

            const visibleSiblings = potentialSiblings.filter(task => {
                const subTree = buildFlattenedTree(task.id, level + 1, []);
                let matchesFilter = true;
                const hasChildren = subTree.length > 0;
                const isDelayed = getTaskStatus(task) === 'delayed';

                if (hideCompleted && task.progress === 100 && !hasChildren) matchesFilter = false;
                if (showDelayedOnly) {
                    const hasDelayedDescendant = subTree.some(c => getTaskStatus(c) === 'delayed');
                    if (!isDelayed && !hasDelayedDescendant) matchesFilter = false;
                }
                if (assigneeFilter !== 'all') {
                    if (assigneeFilter === 'none' && task.assignee) matchesFilter = false;
                    if (assigneeFilter !== 'none' && task.assignee !== assigneeFilter) {
                        const anyDescendantMatches = subTree.some(c => c.assignee === assigneeFilter);
                        if (!anyDescendantMatches) matchesFilter = false;
                    }
                }
                return matchesFilter || hasChildren;
            });

            return visibleSiblings.reduce((acc, task, index) => {
                const isLast = index === visibleSiblings.length - 1;
                const nextActiveLevels = level === 0 ? parentActiveLevels : [...parentActiveLevels, !isLast];
                const children = buildFlattenedTree(task.id, level + 1, nextActiveLevels);
                const isCollapsed = collapsedTaskIds.includes(task.id);
                const visibleChildren = isCollapsed ? [] : children;

                return [...acc, {
                    ...task,
                    level,
                    hasChildren: children.length > 0,
                    isLastChild: isLast,
                    activeLevels: parentActiveLevels
                }, ...visibleChildren];
            }, [] as TaskWithLevel[]);
        };

        return buildFlattenedTree();
    }, [tasks, projectId, hideCompleted, showDelayedOnly, assigneeFilter, collapsedTaskIds]);

    const columns = generateTimelineColumns(projectStartDate, projectEndDate, viewMode);
    const config = TIMELINE_CONFIGS[viewMode];
    const totalWidth = columns.length * config.cellWidth;

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const overTask = tasks.find(t => t.id === over.id);
            if (!overTask) return;

            const updatedActiveTask = {
                ...tasks.find(t => t.id === active.id)!,
                parentId: overTask.parentId,
                updatedAt: new Date()
            };

            const oldIndex = projectTasks.findIndex((t) => t.id === active.id);
            const newIndex = projectTasks.findIndex((t) => t.id === over.id);

            const reordered = arrayMove(projectTasks, oldIndex, newIndex);

            const updatedTasks = reordered.map((t, i) => {
                const originalTask = tasks.find(ot => ot.id === t.id)!;
                if (t.id === active.id) return { ...updatedActiveTask, sortOrder: i };
                return { ...originalTask, sortOrder: i };
            });

            reorderTasks(projectId, updatedTasks);
        }
    };

    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!selectedTaskId) return;
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.key === 'Tab') {
                e.preventDefault();
                if (e.shiftKey) outdentTask(selectedTaskId);
                else indentTask(selectedTaskId);
            }
            if (e.key === 'Escape') setSelectedTaskId(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedTaskId, indentTask, outdentTask, setSelectedTaskId]);

    const isResizing = React.useRef(false);
    const handleResizeMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        isResizing.current = true;
        document.addEventListener('mousemove', handleResizeMouseMove);
        document.addEventListener('mouseup', handleResizeMouseUp);
        document.body.style.cursor = 'col-resize';
    };

    const handleResizeMouseMove = (e: MouseEvent) => {
        if (!isResizing.current) return;
        const newWidth = Math.max(150, Math.min(600, e.clientX));
        setSidebarWidth(newWidth);
    };

    const handleResizeMouseUp = () => {
        isResizing.current = false;
        document.removeEventListener('mousemove', handleResizeMouseMove);
        document.removeEventListener('mouseup', handleResizeMouseUp);
        document.body.style.cursor = 'default';
    };

    return (
        <div className="h-full flex flex-col bg-white overflow-hidden relative">
            <div className="flex-1 overflow-auto bg-white relative">
                <div style={{ width: `${sidebarWidth + totalWidth}px`, minHeight: '100%', position: 'relative' }}>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <TimelineHeader
                            startDate={projectStartDate}
                            endDate={projectEndDate}
                            viewMode={viewMode}
                            sidebarWidth={sidebarWidth}
                            customHolidays={customHolidays}
                            onToggleHoliday={onToggleHoliday}
                        />

                        <div
                            className="absolute top-0 bottom-0 z-50 w-2 -ml-1 cursor-col-resize hover:bg-blue-400/30 transition-colors"
                            style={{ left: `${sidebarWidth}px` }}
                            onMouseDown={handleResizeMouseDown}
                        />

                        <div className="absolute inset-y-0 pointer-events-none z-0" style={{ left: `${sidebarWidth}px` }}>
                            <TodayMarker startDate={projectStartDate} viewMode={viewMode} />
                        </div>

                        <div className="relative">
                            <div className="relative">
                                <SortableContext items={projectTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                                    {projectTasks.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-64 text-gray-400 bg-gray-50/20 relative z-20">
                                            <p className="text-sm font-medium">タスクを追加してガントチャートを表示</p>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <div className="absolute inset-y-0 pointer-events-none overflow-hidden z-0" style={{ left: `${sidebarWidth}px` }}>
                                                <div className="flex h-full">
                                                    {columns.map((date, index) => {
                                                        const dateStr = format(date, 'yyyy-MM-dd');
                                                        const isSat = viewMode === 'day' && date.getDay() === 6;
                                                        const isSun = viewMode === 'day' && date.getDay() === 0;
                                                        const isHol = viewMode === 'day' && (isHoliday(date) || customHolidays.includes(dateStr));
                                                        return (
                                                            <div
                                                                key={index}
                                                                className={`flex-shrink-0 border-r border-gray-200/10 h-full ${isSat || isSun || isHol ? 'bg-gray-200/50' : ''
                                                                    }`}
                                                                style={{ width: `${config.cellWidth}px` }}
                                                            />
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div className={`relative ${editingProgressTaskId ? 'z-50' : 'z-10'}`}>
                                                {projectTasks.map((task) => (
                                                    <SortableTimelineRow
                                                        key={task.id}
                                                        task={task}
                                                        startDate={projectStartDate}
                                                        viewMode={viewMode}
                                                        onTaskUpdate={updateTask}
                                                        onEdit={onEditTask}
                                                        onDelete={deleteTask}
                                                        level={task.level}
                                                        isParent={task.hasChildren}
                                                        isCollapsed={collapsedTaskIds.includes(task.id)}
                                                        onToggleCollapse={toggleTaskCollapsed}
                                                        isSelected={selectedTaskId === task.id}
                                                        onSelect={setSelectedTaskId}
                                                        onIndent={indentTask}
                                                        onOutdent={outdentTask}
                                                        sidebarWidth={sidebarWidth}
                                                        isLastChild={task.isLastChild}
                                                        activeLevels={task.activeLevels}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </SortableContext>
                                <div className="h-64 bg-white border-t border-transparent" />
                            </div>
                        </div>
                    </DndContext>
                </div>
            </div>
        </div>
    );
}
