import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Task } from '../types';

interface TaskState {
    tasks: Task[];
    collapsedTaskIds: string[];
    addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
    deleteTask: (id: string) => void;
    updateTask: (id: string, data: Partial<Task>) => void;
    reorderTasks: (projectId: string, newTasks: Task[]) => void;
    setTasks: (tasks: Task[]) => void;
    toggleTaskCollapsed: (id: string) => void;
    indentTask: (id: string) => void;
    outdentTask: (id: string) => void;
    selectedTaskId: string | null;
    setSelectedTaskId: (id: string | null) => void;
    editingProgressTaskId: string | null;
    setEditingProgressTaskId: (id: string | null) => void;
    sidebarWidth: number;
    setSidebarWidth: (width: number) => void;
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
            sidebarWidth: 280, // Slightly wider default to accommodate hierarchy
            addTask: (data) =>
                set((state) => {
                    const newTask = {
                        ...data,
                        id: uuidv4(),
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    };
                    const updatedTasks = [...state.tasks, newTask];
                    return { tasks: updateParentDates(updatedTasks, newTask.parentId) };
                }),
            deleteTask: (id) =>
                set((state) => {
                    const taskToDelete = state.tasks.find(t => t.id === id);
                    const filteredTasks = state.tasks.filter((t) => t.id !== id);
                    // Also delete children? Let's upgrade them to parent-less or delete them.
                    // Implementation choice: Delete children recursively to avoid orphans.
                    const childrenIds = state.tasks.filter(t => t.parentId === id).map(t => t.id);
                    let finalTasks = filteredTasks;
                    if (childrenIds.length > 0) {
                        finalTasks = finalTasks.filter(t => t.parentId !== id);
                    }
                    return { tasks: updateParentDates(finalTasks, taskToDelete?.parentId) };
                }),
            updateTask: (id, data) =>
                set((state) => {
                    const oldTask = state.tasks.find(t => t.id === id);
                    const newTasks = state.tasks.map((t) =>
                        t.id === id ? { ...t, ...data, updatedAt: new Date() } : t
                    );
                    const updatedTasks = updateParentDates(newTasks, data.parentId || oldTask?.parentId);
                    // If parentId changed, also update the old parent
                    if (data.parentId !== undefined && data.parentId !== oldTask?.parentId) {
                        return { tasks: updateParentDates(updatedTasks, oldTask?.parentId) };
                    }
                    return { tasks: updatedTasks };
                }),
            reorderTasks: (projectId, newTasks) =>
                set((state) => ({
                    tasks: [
                        ...state.tasks.filter((t) => t.projectId !== projectId),
                        ...newTasks,
                    ],
                })),
            setTasks: (tasks) => set({ tasks }),
            toggleTaskCollapsed: (id) =>
                set((state) => ({
                    collapsedTaskIds: state.collapsedTaskIds.includes(id)
                        ? state.collapsedTaskIds.filter(tid => tid !== id)
                        : [...state.collapsedTaskIds, id]
                })),
            indentTask: (id) =>
                set((state) => {
                    const task = state.tasks.find(t => t.id === id);
                    if (!task) return state;

                    // Find previous tasks in the same project to identify potential parent
                    const projectTasks = state.tasks
                        .filter(t => t.projectId === task.projectId)
                        .sort((a, b) => a.sortOrder - b.sortOrder);

                    const currentIndex = projectTasks.findIndex(t => t.id === id);
                    if (currentIndex <= 0) return state;

                    const prevTask = projectTasks[currentIndex - 1];

                    // Logic: Make the previous task the new parent
                    // Basic depth check: if we want to limit to 3 levels, we'd need more logic here
                    const updatedTasks = state.tasks.map(t =>
                        t.id === id ? { ...t, parentId: prevTask.id, updatedAt: new Date() } : t
                    );

                    return { tasks: updateParentDates(updatedTasks, prevTask.id) };
                }),
            outdentTask: (id) =>
                set((state) => {
                    const task = state.tasks.find(t => t.id === id);
                    if (!task || !task.parentId) return state;

                    const parentTask = state.tasks.find(t => t.id === task.parentId);
                    if (!parentTask) return state;

                    // Move to the level of the parent (i.e., make its parent the new parent)
                    const updatedTasks = state.tasks.map(t =>
                        t.id === id ? { ...t, parentId: parentTask.parentId, updatedAt: new Date() } : t
                    );

                    const finalTasks = updateParentDates(updatedTasks, parentTask.parentId);
                    return { tasks: updateParentDates(finalTasks, task.parentId) }; // Also update the old parent
                }),
            setSelectedTaskId: (id) => set({ selectedTaskId: id }),
            setEditingProgressTaskId: (id) => set({ editingProgressTaskId: id }),
            setSidebarWidth: (width) => set({ sidebarWidth: width }),
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
