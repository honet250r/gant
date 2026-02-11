import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Project } from '../types';

interface ProjectState {
    projects: Project[];
    addProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void;
    deleteProject: (id: string) => void;
    updateProject: (id: string, data: Partial<Project>) => void;
    setProjects: (projects: Project[]) => void;
}


export const useProjectStore = create<ProjectState>()(
    persist(
        (set) => ({
            projects: [],
            addProject: (data) =>
                set((state) => ({
                    projects: [
                        ...state.projects,
                        {
                            ...data,
                            id: uuidv4(),
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        },
                    ],
                })),
            deleteProject: (id) =>
                set((state) => ({
                    projects: state.projects.filter((p) => p.id !== id),
                })),
            updateProject: (id, data) =>
                set((state) => ({
                    projects: state.projects.map((p) =>
                        p.id === id ? { ...p, ...data, updatedAt: new Date() } : p
                    ),
                })),
            setProjects: (projects) => set({ projects }),
        }),
        {
            name: 'simple-gantt-projects',
            storage: createJSONStorage(() => localStorage, {
                reviver: (_key, value) => {
                    // Basic ISO date regex
                    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
                        return new Date(value);
                    }
                    return value;
                }
            }),
        }
    )
);
