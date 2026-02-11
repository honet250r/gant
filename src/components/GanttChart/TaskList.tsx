import * as React from 'react';
import { useTaskStore } from '../../stores/taskStore';
import { Modal, Button } from '../common';
import { Plus, Trash2, Edit2, GripVertical, AlertCircle, CheckCircle2, Rocket, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { getTaskStatus } from '../../utils/ganttUtils';
import type { Task } from '../../types';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const DEFAULT_COLORS = [
    '#3B82F6', // 青
    '#10B981', // 緑
    '#F59E0B', // 橙
    '#EF4444', // 赤
    '#8B5CF6', // 紫
    '#EC4899', // ピンク
    '#06B6D4', // シアン
    '#6B7280', // グレー
];

interface TaskListProps {
    projectId: string;
}

function SortableTaskItem({ task, onEdit, onDelete }: { task: Task; onEdit: (task: Task) => void; onDelete: (id: string) => void }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: task.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`p-3 border rounded transition-all duration-200 ${isDragging ? 'shadow-lg ring-2 ring-blue-400 z-50 bg-blue-50' : 'hover:bg-gray-50 border-gray-200'
                }`}
        >
            <div className="flex items-start justify-between mb-2">
                <div className="flex items-start gap-2 flex-1">
                    <button
                        {...attributes}
                        {...listeners}
                        className="text-gray-300 hover:text-blue-500 cursor-grab active:cursor-grabbing mt-0.5 transition-colors"
                        title="ドラッグして並び替え"
                    >
                        <GripVertical size={16} />
                    </button>
                    <div className="flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-medium text-sm truncate">{task.name}</span>
                            {(() => {
                                const status = getTaskStatus(task);
                                if (status === 'delayed') return <span title="遅延"><AlertCircle size={14} className="text-red-500 shrink-0" /></span>;
                                if (status === 'on-track') return <span title="順調"><TrendingUp size={14} className="text-blue-400 shrink-0" /></span>;
                                if (status === 'ahead') return <span title="先行"><Rocket size={14} className="text-green-500 shrink-0" /></span>;
                                if (status === 'completed') return <span title="完了"><CheckCircle2 size={14} className="text-gray-400 shrink-0" /></span>;
                                return null;
                            })()}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                            担当: {task.assignee || '未設定'}
                        </div>
                    </div>
                </div>
                <div className="flex gap-1 ml-2">
                    <button
                        onClick={() => onEdit(task)}
                        className="text-gray-400 hover:text-blue-500 transition"
                    >
                        <Edit2 size={14} />
                    </button>
                    <button
                        onClick={() => {
                            if (confirm(`「${task.name}」を削除しますか?`)) {
                                onDelete(task.id);
                            }
                        }}
                        className="text-gray-400 hover:text-red-500 transition"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
                <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: task.color }}
                />
                <span>{format(task.startDate, 'MM/dd')} - {format(task.endDate, 'MM/dd')}</span>
                <span className="ml-auto">{task.progress}%</span>
            </div>
        </div>
    );
}

export function TaskList({ projectId }: TaskListProps) {
    const { tasks, addTask, deleteTask, updateTask, reorderTasks } = useTaskStore();
    const projectTasks = tasks.filter((t) => t.projectId === projectId).sort((a, b) => a.sortOrder - b.sortOrder);

    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [editingTask, setEditingTask] = React.useState<Task | null>(null);
    const [formData, setFormData] = React.useState({
        name: '',
        assignee: '',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        progress: 0,
        color: DEFAULT_COLORS[0],
    });

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = projectTasks.findIndex((t) => t.id === active.id);
            const newIndex = projectTasks.findIndex((t) => t.id === over.id);

            const reorderedTasks = arrayMove(projectTasks, oldIndex, newIndex);
            const updatedTasks = reorderedTasks.map((t, index) => ({ ...t, sortOrder: index }));
            reorderTasks(projectId, updatedTasks);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingTask) {
            updateTask(editingTask.id, {
                name: formData.name,
                assignee: formData.assignee,
                startDate: new Date(formData.startDate),
                endDate: new Date(formData.endDate),
                progress: formData.progress,
                color: formData.color,
            });
        } else {
            addTask({
                projectId,
                name: formData.name,
                assignee: formData.assignee,
                startDate: new Date(formData.startDate),
                endDate: new Date(formData.endDate),
                progress: formData.progress,
                color: formData.color,
                sortOrder: projectTasks.length,
            });
        }
        resetForm();
    };

    const resetForm = () => {
        setFormData({
            name: '',
            assignee: '',
            startDate: format(new Date(), 'yyyy-MM-dd'),
            endDate: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
            progress: 0,
            color: DEFAULT_COLORS[0],
        });
        setEditingTask(null);
        setIsModalOpen(false);
    };

    const handleEdit = (task: Task) => {
        setEditingTask(task);
        setFormData({
            name: task.name,
            assignee: task.assignee,
            startDate: format(task.startDate, 'yyyy-MM-dd'),
            endDate: format(task.endDate, 'yyyy-MM-dd'),
            progress: task.progress,
            color: task.color,
        });
        setIsModalOpen(true);
    };

    return (
        <div className="bg-white border-r h-full flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
                <h2 className="font-semibold text-lg">タスク一覧</h2>
                <Button onClick={() => setIsModalOpen(true)} className="text-sm py-1 px-3">
                    <Plus size={16} className="mr-1 inline" />
                    追加
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
                {projectTasks.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">
                        タスクがありません
                    </div>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={projectTasks.map((t) => t.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="space-y-2">
                                {projectTasks.map((task) => (
                                    <SortableTaskItem
                                        key={task.id}
                                        task={task}
                                        onEdit={handleEdit}
                                        onDelete={deleteTask}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={resetForm}
                title={editingTask ? 'タスク編集' : '新規タスク作成'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            タスク名 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="例: デザイン作成"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">担当者</label>
                        <input
                            type="text"
                            value={formData.assignee}
                            onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="例: 田中"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                開始日 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                required
                                value={formData.startDate}
                                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                終了日 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                required
                                value={formData.endDate}
                                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            進捗率: {formData.progress}%
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={formData.progress}
                            onChange={(e) => setFormData({ ...formData, progress: Number(e.target.value) })}
                            className="w-full"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">色</label>
                        <div className="flex gap-2 flex-wrap">
                            {DEFAULT_COLORS.map((color) => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, color })}
                                    className={`w-8 h-8 rounded border-2 transition ${formData.color === color ? 'border-gray-900 scale-110' : 'border-gray-300'
                                        }`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                        <Button type="submit" className="flex-1">
                            {editingTask ? '更新' : '作成'}
                        </Button>
                        <Button type="button" variant="secondary" onClick={resetForm}>
                            キャンセル
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
