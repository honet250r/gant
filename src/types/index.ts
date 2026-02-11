export interface Project {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    createdAt: Date;
    updatedAt: Date;
    customHolidays?: string[]; // Array of ISO date strings (YYYY-MM-DD)
}

export interface Task {
    id: string;
    projectId: string;
    parentId?: string;
    name: string;
    assignee: string;
    startDate: Date;
    endDate: Date;
    progress: number;
    color: string;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
}

export type ViewMode = 'day' | 'week' | 'month';
