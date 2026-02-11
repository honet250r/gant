import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Task } from '../types';
import { supabase } from '../lib/supabase';

interface TaskState {
    tasks: Task[];
    collapsedTaskIds: string[];
    addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    deleteTask: (id: string) => Promise<void>;
    updateTask: (id: string, data: Partial<Task>) => Promise<void>;
    reorderTasks: (projectId: string, newTasks: Task[]) => Promise<void>;
    setTasks: (tasks: Task[]) => void;
    toggleTaskCollapsed: (id: string) => void;
    indentTask: (id: string) => Promise<void>;
    outdentTask: (id: string) => Promise<void>;
    selectedTaskId: string | null;
    setSelectedTaskId: (id: string | null) => void;
    editingProgressTaskId: string | null;
    setEditingProgressTaskId: (id: string | null) => void;
    sidebarWidth: number;
    setSidebarWidth: (width: number) => void;
    syncWithSupabase: (projectId: string) => Promise<void>;
}

// Helper to update parent dates based on children
function updateParentDates(tasks: Task[], parentId?: string): Task[] {
    if (!parentId) return tasks;

    const parent = tasks.find(t => t.id === parentId);
    if (!parent) return tasks;

    const children = tasks.filter(t => t.parentId === parentId);
    if (children.length === 0) return tasks;

    const minStart = new Date(Math.min(...children.map(t => t.startDate.getTime())));
    const maxEnd = new Date(Math.max(...children.map(t => t.endDate.getTime())));

    // Average progress
    const avgProgress = Math.round(children.reduce((acc, curr) => acc + curr.progress, 0) / children.length);

    const updatedTasks = tasks.map(t =>
        t.id === parentId
            ? { ...t, startDate: minStart, endDate: maxEnd, progress: avgProgress, updatedAt: new Date() }
            : t
    );

    // Recursively update upwards
    return updateParentDates(updatedTasks, parent.parentId);
}

export const useTaskStore = create<TaskState>()(
    persist(
        (set) => ({
            tasks: [],
            collapsedTaskIds: [],
            selectedTaskId: null,
            editingProgressTaskId: null,
            sidebarWidth: 280,
            addTask: async (data) => {
                const newTask: Task = {
                    ...data,
                    id: uuidv4(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };

                // Supabase to keep in sync
                const { error } = await supabase.from('tasks').upsert({
                    id: newTask.id,
                    project_id: newTask.projectId,
                    name: newTask.name,
                    assignee: newTask.assignee,
                    start_date: newTask.startDate.toISOString(),
                    end_date: newTask.endDate.toISOString(),
                    progress: newTask.progress,
                    color: newTask.color,
                    sort_order: newTask.sortOrder,
                    parent_id: newTask.parentId,
                    updated_at: newTask.updatedAt.toISOString(),
                });

                if (error) console.error('Supabase addTask Error:', error);

                set((state) => {
                    const updatedTasks = [...state.tasks, newTask];
                    return { tasks: updateParentDates(updatedTasks, newTask.parentId) };
                });
            },
            deleteTask: async (id) => {
                const { error } = await supabase.from('tasks').delete().eq('id', id);
                if (error) console.error('Supabase deleteTask Error:', error);

                set((state) => {
                    const taskToDelete = state.tasks.find(t => t.id === id);
                    const filteredTasks = state.tasks.filter((t) => t.id !== id);
                    const childrenIds = state.tasks.filter(t => t.parentId === id).map(t => t.id);
                    let finalTasks = filteredTasks;
                    if (childrenIds.length > 0) {
                        finalTasks = finalTasks.filter(t => t.parentId !== id);
                    }
                    return { tasks: updateParentDates(finalTasks, taskToDelete?.parentId) };
                });
            },
            updateTask: async (id, data) => {
                const updateData: any = { ...data, updated_at: new Date().toISOString() };
                if (data.startDate) updateData.start_date = data.startDate.toISOString();
                if (data.endDate) updateData.end_date = data.endDate.toISOString();

                const { error } = await supabase.from('tasks').update(updateData).eq('id', id);
                if (error) console.error('Supabase updateTask Error:', error);

                set((state) => {
                    const oldTask = state.tasks.find(t => t.id === id);
                    const newTasks = state.tasks.map((t) =>
                        t.id === id ? { ...t, ...data, updatedAt: new Date() } : t
                    );
                    const updatedTasks = updateParentDates(newTasks, data.parentId || oldTask?.parentId);
                    if (data.parentId !== undefined && data.parentId !== oldTask?.parentId) {
                        return { tasks: updateParentDates(updatedTasks, oldTask?.parentId) };
                    }
                    return { tasks: updatedTasks };
                });
            },
            reorderTasks: async (projectId, newTasks) => {
                // Batch update sort orders
                const updates = newTasks.map(t => ({
                    id: t.id,
                    project_id: projectId,
                    sort_order: t.sortOrder,
                    updated_at: new Date().toISOString()
                }));
                await supabase.from('tasks').upsert(updates);

                set((state) => ({
                    tasks: [
                        ...state.tasks.filter((t) => t.projectId !== projectId),
                        ...newTasks,
                    ],
                }));
            },
            setTasks: (tasks) => set({ tasks }),
            toggleTaskCollapsed: (id) =>
                set((state) => ({
                    collapsedTaskIds: state.collapsedTaskIds.includes(id)
                        ? state.collapsedTaskIds.filter(tid => tid !== id)
                        : [...state.collapsedTaskIds, id]
                })),
            indentTask: async (id) => {
                let updatedTaskId: string | null = null;
                let newParentId: string | null = null;

                set((state) => {
                    const task = state.tasks.find(t => t.id === id);
                    if (!task) return state;

                    const projectTasks = state.tasks
                        .filter(t => t.projectId === task.projectId)
                        .sort((a, b) => a.sortOrder - b.sortOrder);

                    const currentIndex = projectTasks.findIndex(t => t.id === id);
                    if (currentIndex <= 0) return state;

                    const prevTask = projectTasks[currentIndex - 1];
                    updatedTaskId = id;
                    newParentId = prevTask.id;

                    const updatedTasks = state.tasks.map(t =>
                        t.id === id ? { ...t, parentId: prevTask.id, updatedAt: new Date() } : t
                    );

                    return { tasks: updateParentDates(updatedTasks, prevTask.id) };
                });

                if (updatedTaskId && newParentId) {
                    await supabase.from('tasks').update({ parent_id: newParentId, updated_at: new Date().toISOString() }).eq('id', updatedTaskId);
                }
            },
            outdentTask: async (id) => {
                let updatedTaskId: string | null = null;
                let newParentId: string | undefined = undefined;

                set((state) => {
                    const task = state.tasks.find(t => t.id === id);
                    if (!task || !task.parentId) return state;

                    const parentTask = state.tasks.find(t => t.id === task.parentId);
                    if (!parentTask) return state;

                    updatedTaskId = id;
                    newParentId = parentTask.parentId;

                    const updatedTasks = state.tasks.map(t =>
                        t.id === id ? { ...t, parentId: parentTask.parentId, updatedAt: new Date() } : t
                    );

                    const finalTasks = updateParentDates(updatedTasks, parentTask.parentId);
                    return { tasks: updateParentDates(finalTasks, task.parentId) };
                });

                if (updatedTaskId) {
                    await supabase.from('tasks').update({ parent_id: newParentId, updated_at: new Date().toISOString() }).eq('id', updatedTaskId);
                }
            },
            setSelectedTaskId: (id) => set({ selectedTaskId: id }),
            setEditingProgressTaskId: (id) => set({ editingProgressTaskId: id }),
            setSidebarWidth: (width) => set({ sidebarWidth: width }),
            syncWithSupabase: async (projectId) => {
                const { data, error } = await supabase
                    .from('tasks')
                    .select('*')
                    .eq('project_id', projectId);

                if (error) {
                    console.error('Error fetching tasks:', error);
                    return;
                }

                if (data) {
                    const mappedTasks: Task[] = data.map(t => ({
                        id: t.id,
                        projectId: t.project_id,
                        parentId: t.parent_id,
                        name: t.name,
                        assignee: t.assignee || '',
                        startDate: new Date(t.start_date),
                        endDate: new Date(t.end_date),
                        progress: t.progress,
                        color: t.color || '#3b82f6',
                        sortOrder: t.sort_order,
                        createdAt: new Date(t.created_at),
                        updatedAt: new Date(t.updated_at),
                    }));
                    set({ tasks: mappedTasks });
                }
            }
        }),
        {
            name: 'simple-gantt-tasks',
            storage: createJSONStorage(() => localStorage, {
                reviver: (_key, value) => {
                    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
                        return new Date(value);
                    }
                    return value;
                }
            }),
        }
    )
);
