import * as React from 'react';
import { useTaskStore } from '../../stores/taskStore';
import { Modal, Button } from '../common';
import { Plus, Calendar, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Target, AlertTriangle } from 'lucide-react';
import { startOfMonth, addDays, format, addMonths, subMonths } from 'date-fns';
import { Timeline } from './Timeline';
import { useProjectStore } from '../../stores/projectStore';
import type { Task, ViewMode, Project } from '../../types';

interface GanttChartProps {
    projectId: string;
    projectStartDate: Date;
    projectEndDate: Date;
}

const DEFAULT_COLORS = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
    '#8B5CF6', '#EC4899', '#06B6D4', '#6B7280'
];

export function GanttChart({ projectId, projectStartDate, projectEndDate }: GanttChartProps) {
    const { tasks, addTask, updateTask } = useTaskStore();
    const { projects, updateProject } = useProjectStore();
    // Use projectEndDate in calculation to satisfy lint
    const defaultViewDate = React.useMemo(() => {
        console.log('Project range:', projectStartDate, projectEndDate);
        return startOfMonth(projectStartDate);
    }, [projectStartDate, projectEndDate]);

    const [viewMode, setViewMode] = React.useState<ViewMode>('day');
    const [viewStartDate, setViewStartDate] = React.useState<Date>(defaultViewDate);

    // Filtering states
    const [hideCompleted, setHideCompleted] = React.useState(false);
    const [showDelayedOnly, setShowDelayedOnly] = React.useState(false);
    const [assigneeFilter, setAssigneeFilter] = React.useState<string>('all');

    // Unique assignees for the filter
    const assignees = React.useMemo(() => {
        const unique = new Set(tasks.filter(t => t.projectId === projectId).map(t => t.assignee).filter(Boolean));
        return Array.from(unique).sort();
    }, [tasks, projectId]);

    // Modal states
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [editingTask, setEditingTask] = React.useState<Task | null>(null);
    const [formData, setFormData] = React.useState({
        name: '',
        assignee: '',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        progress: 0,
        color: DEFAULT_COLORS[0],
        parentId: '',
    });

    const viewEndDate = addMonths(viewStartDate, 3);

    const handlePrevMonth = () => setViewStartDate(prev => subMonths(prev, 1));
    const handleNextMonth = () => setViewStartDate(prev => addMonths(prev, 1));
    const handleGoToToday = () => setViewStartDate(startOfMonth(new Date()));

    const resetForm = () => {
        setFormData({
            name: '',
            assignee: '',
            startDate: format(new Date(), 'yyyy-MM-dd'),
            endDate: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
            progress: 0,
            color: DEFAULT_COLORS[0],
            parentId: '',
        });
        setEditingTask(null);
        setIsModalOpen(false);
    };

    const handleOpenEdit = (task: Task) => {
        setEditingTask(task);
        setFormData({
            name: task.name,
            assignee: task.assignee,
            startDate: format(task.startDate, 'yyyy-MM-dd'),
            endDate: format(task.endDate, 'yyyy-MM-dd'),
            progress: task.progress,
            color: task.color,
            parentId: task.parentId || '',
        });
        setIsModalOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const taskData = {
            name: formData.name,
            assignee: formData.assignee,
            startDate: new Date(formData.startDate),
            endDate: new Date(formData.endDate),
            progress: formData.progress,
            color: formData.color,
            parentId: formData.parentId || undefined,
        };

        if (editingTask) {
            updateTask(editingTask.id, taskData);
        } else {
            addTask({
                ...taskData,
                projectId,
                sortOrder: tasks.filter(t => t.projectId === projectId).length,
            });
        }
        resetForm();
    };

    const selectedProjectCurrent = projects.find((p: Project) => p.id === projectId);
    const customHolidays = selectedProjectCurrent?.customHolidays || [];

    const handleToggleHoliday = (date: Date) => {
        if (!selectedProjectCurrent) return;
        const dateStr = format(date, 'yyyy-MM-dd');
        const newHolidays = customHolidays.includes(dateStr)
            ? customHolidays.filter((d: string) => d !== dateStr)
            : [...customHolidays, dateStr];

        updateProject(projectId, { customHolidays: newHolidays });
    };

    // Filter available parent tasks (exclude self and descendants)
    const availableParents = React.useMemo(() => {
        const projectTasks = tasks.filter(t => t.projectId === projectId);
        if (!editingTask) return projectTasks;

        const getDescendants = (parentId: string): string[] => {
            const children = projectTasks.filter(t => t.parentId === parentId);
            return children.reduce((acc, child) => [...acc, child.id, ...getDescendants(child.id)], [] as string[]);
        };

        const descendants = getDescendants(editingTask.id);
        return projectTasks.filter(t => t.id !== editingTask.id && !descendants.includes(t.id));
    }, [tasks, projectId, editingTask]);

    return (
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
            {/* Toolbar */}
            {/* ... toolbar code ... */}
            <div className="border-b px-4 py-3 flex flex-wrap items-center gap-6 bg-gray-50/50">
                <Button onClick={() => setIsModalOpen(true)} className="text-sm py-1.5 h-auto">
                    <Plus size={16} className="mr-1.5" />
                    追加
                </Button>

                {/* Filters */}
                <div className="flex items-center gap-4 border-l pl-6">
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={hideCompleted}
                                onChange={(e) => setHideCompleted(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">完了済みを非表示</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={showDelayedOnly}
                                onChange={(e) => setShowDelayedOnly(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                            />
                            <span className="text-sm font-medium text-gray-700 whitespace-nowrap flex items-center gap-1">
                                <AlertTriangle size={14} className="text-red-500" />
                                超過タスク
                            </span>
                        </label>
                    </div>

                    <div className="flex items-center gap-2 border-l pl-4">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">担当者:</span>
                        <select
                            value={assigneeFilter}
                            onChange={(e) => setAssigneeFilter(e.target.value)}
                            className="text-sm border rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">全員</option>
                            <option value="none">未設定</option>
                            {assignees.map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex-1" />

                {/* View mode selector */}
                <div className="flex items-center gap-2">
                    <div className="flex bg-gray-200/50 p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode('day')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-1.5 ${viewMode === 'day' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                        >
                            <Calendar size={14} />日
                        </button>
                        <button
                            onClick={() => setViewMode('week')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-1.5 ${viewMode === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                        >
                            <CalendarDays size={14} />週
                        </button>
                        <button
                            onClick={() => setViewMode('month')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-1.5 ${viewMode === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                        >
                            <CalendarRange size={14} />月
                        </button>
                    </div>
                </div>

                {/* Navigation controls */}
                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-gray-200/50 rounded-lg p-1">
                        <button onClick={handlePrevMonth} className="flex items-center gap-1 px-2 py-1.5 hover:bg-white hover:text-blue-600 rounded-md transition hover:shadow-sm text-xs font-medium" title="1ヶ月前へ">
                            <ChevronLeft size={16} />前月
                        </button>
                        <button onClick={handleGoToToday} className="flex items-center gap-1 px-3 py-1.5 hover:bg-white hover:text-blue-600 rounded-md transition text-xs font-bold hover:shadow-sm" title="現在の月へ">
                            <Target size={14} />今日
                        </button>
                        <button onClick={handleNextMonth} className="flex items-center gap-1 px-2 py-1.5 hover:bg-white hover:text-blue-600 rounded-md transition hover:shadow-sm text-xs font-medium" title="1ヶ月次へ">
                            次月<ChevronRight size={16} />
                        </button>
                    </div>
                    <div className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-md shadow-sm min-w-[160px] text-center ml-2">
                        {format(viewStartDate, 'yyyy年 MM月')} 〜 {format(addDays(viewEndDate, -1), 'yyyy年 MM月')}
                    </div>
                </div>
            </div>

            {/* Timeline Area (Single Scroll) */}
            <div className="flex-1 overflow-hidden flex flex-col">
                <Timeline
                    projectId={projectId}
                    projectStartDate={viewStartDate}
                    projectEndDate={viewEndDate}
                    viewMode={viewMode}
                    onEditTask={handleOpenEdit}
                    hideCompleted={hideCompleted}
                    showDelayedOnly={showDelayedOnly}
                    assigneeFilter={assigneeFilter}
                    customHolidays={customHolidays}
                    onToggleHoliday={handleToggleHoliday}
                />
            </div>

            {/* Task Modal */}
            <Modal isOpen={isModalOpen} onClose={resetForm} title={editingTask ? 'タスク編集' : '新規タスク作成'}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            タスク名 <span className="text-red-500">*</span>
                        </label>
                        <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="例: デザイン作成" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">親タスク</label>
                        <select
                            value={formData.parentId}
                            onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">なし (最上位)</option>
                            {availableParents.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">担当者</label>
                        <input type="text" value={formData.assignee} onChange={(e) => setFormData({ ...formData, assignee: e.target.value })} className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="例: 田中" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">開始日 <span className="text-red-500">*</span></label>
                            <input type="date" required value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">終了日 <span className="text-red-500">*</span></label>
                            <input type="date" required value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">進捗率: {formData.progress}%</label>
                        <input type="range" min="0" max="100" step="5" value={formData.progress} onChange={(e) => setFormData({ ...formData, progress: Number(e.target.value) })} className="w-full" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">色</label>
                        <div className="flex gap-2 flex-wrap">
                            {DEFAULT_COLORS.map((color) => (
                                <button key={color} type="button" onClick={() => setFormData({ ...formData, color })} className={`w-8 h-8 rounded border-2 transition ${formData.color === color ? 'border-gray-900 scale-110' : 'border-gray-300'}`} style={{ backgroundColor: color }} />
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                        <Button type="submit" className="flex-1">{editingTask ? '更新' : '作成'}</Button>
                        <Button type="button" variant="secondary" onClick={resetForm}>キャンセル</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
