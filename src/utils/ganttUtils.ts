import { startOfDay, differenceInDays, addDays, startOfWeek, startOfMonth, addWeeks, addMonths, format } from 'date-fns';
import type { ViewMode, Task } from '../types';

export interface TimelineConfig {
    cellWidth: number;
    label: (date: Date) => string;
    increment: (date: Date) => Date;
}

export const TIMELINE_CONFIGS: Record<ViewMode, TimelineConfig> = {
    day: {
        cellWidth: 40,
        label: (date) => format(date, 'M/d'),
        increment: (date) => addDays(date, 1),
    },
    week: {
        cellWidth: 60,
        label: (date) => `W${format(date, 'w')}`,
        increment: (date) => addWeeks(date, 1),
    },
    month: {
        cellWidth: 80,
        label: (date) => format(date, 'M月'),
        increment: (date) => addMonths(date, 1),
    },
};

export function getDatePosition(
    date: Date,
    startDate: Date,
    viewMode: ViewMode
): number {
    const config = TIMELINE_CONFIGS[viewMode];
    const normalizedDate = startOfDay(date);
    const normalizedStart = startOfDay(startDate);

    if (viewMode === 'day') {
        const days = differenceInDays(normalizedDate, normalizedStart);
        return days * config.cellWidth;
    } else if (viewMode === 'week') {
        const weekStart = startOfWeek(normalizedDate, { weekStartsOn: 1 });
        const startWeek = startOfWeek(normalizedStart, { weekStartsOn: 1 });
        const weeks = Math.floor(differenceInDays(weekStart, startWeek) / 7);
        return weeks * config.cellWidth;
    } else {
        const monthStart = startOfMonth(normalizedDate);
        const startMonth = startOfMonth(normalizedStart);
        const months = (monthStart.getFullYear() - startMonth.getFullYear()) * 12 +
            (monthStart.getMonth() - startMonth.getMonth());
        return months * config.cellWidth;
    }
}

export function getBarWidth(
    startDate: Date,
    endDate: Date,
    viewMode: ViewMode
): number {
    const config = TIMELINE_CONFIGS[viewMode];
    const days = differenceInDays(endDate, startDate) + 1;

    if (viewMode === 'day') {
        return days * config.cellWidth;
    } else if (viewMode === 'week') {
        const weeks = Math.ceil(days / 7);
        return weeks * config.cellWidth;
    } else {
        const months = Math.ceil(days / 30);
        return months * config.cellWidth;
    }
}

export function generateTimelineColumns(
    startDate: Date,
    endDate: Date,
    viewMode: ViewMode
): Date[] {
    const config = TIMELINE_CONFIGS[viewMode];
    const columns: Date[] = [];
    let current = startOfDay(startDate);
    const end = startOfDay(endDate);

    while (current <= end) {
        columns.push(current);
        current = config.increment(current);
    }

    return columns;
}

export const isWeekend = (date: Date): boolean => {
    const day = date.getDay();
    return day === 0 || day === 6;
};

// Japanese Holidays (2025-2026)
const JAPANESE_HOLIDAYS = new Set([
    // 2025
    '2025-01-01', '2025-01-13', '2025-02-11', '2025-02-23', '2025-02-24',
    '2025-03-20', '2025-04-29', '2025-05-03', '2025-05-04', '2025-05-05',
    '2025-05-06', '2025-07-21', '2025-08-11', '2025-09-15', '2025-09-23',
    '2025-10-13', '2025-11-03', '2025-11-23', '2025-11-24',
    // 2026 (Approximate/Standard)
    '2026-01-01', '2026-01-12', '2026-02-11', '2026-02-23', '2026-03-21',
    '2026-04-29', '2026-05-03', '2026-05-04', '2026-05-05', '2026-05-06',
    '2026-07-20', '2026-08-11', '2026-09-21', '2026-09-22', '2026-09-23',
    '2026-10-12', '2026-11-03', '2026-11-23', '2026-11-24'
]);

export const isHoliday = (date: Date): boolean => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return JAPANESE_HOLIDAYS.has(dateStr);
};

export type TaskStatus = 'delayed' | 'on-track' | 'ahead' | 'completed';

export function getTaskStatus(task: Task): TaskStatus {
    if (task.progress === 100) return 'completed';

    const now = new Date();
    const start = startOfDay(task.startDate);
    const end = startOfDay(task.endDate);

    // If not started yet, it's on track unless it's past starting date
    if (now < start) return 'on-track';

    // Total duration in days
    const totalDays = differenceInDays(end, start) + 1;
    // Elapsed days from start
    const elapsedDays = differenceInDays(now, start);

    // Expected progress percentage
    const expectedProgress = Math.min(100, (elapsedDays / totalDays) * 100);

    if (task.progress < expectedProgress - 15) return 'delayed';
    if (task.progress > expectedProgress + 15) return 'ahead';
    return 'on-track';
}
