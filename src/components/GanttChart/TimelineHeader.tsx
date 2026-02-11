import type { ViewMode } from '../../types';
import { generateTimelineColumns, TIMELINE_CONFIGS, isHoliday } from '../../utils/ganttUtils';

interface TimelineHeaderProps {
    startDate: Date;
    endDate: Date;
    viewMode: ViewMode;
    sidebarWidth: number;
}

export function TimelineHeader({ startDate, endDate, viewMode, sidebarWidth }: TimelineHeaderProps) {
    const columns = generateTimelineColumns(startDate, endDate, viewMode);
    const config = TIMELINE_CONFIGS[viewMode];

    return (
        <div className="flex border-b bg-gray-100 sticky top-0 z-20">
            {/* Row header space (Sticky corner) */}
            <div
                className="flex-shrink-0 border-r bg-gray-100 sticky left-0 z-30 flex items-center px-4 text-xs font-bold text-gray-500 uppercase tracking-wider overflow-hidden"
                style={{ width: `${sidebarWidth}px` }}
            >
                タスク名 / 担当
            </div>
            {columns.map((date, index) => {
                const isSat = viewMode === 'day' && date.getDay() === 6;
                const isSun = viewMode === 'day' && date.getDay() === 0;
                const isHol = viewMode === 'day' && isHoliday(date);
                return (
                    <div
                        key={index}
                        className={`flex-shrink-0 border-r px-2 py-3 text-center text-sm font-bold transition-colors ${isSat ? 'bg-gray-300/60 text-blue-600' :
                                (isSun || isHol) ? 'bg-gray-300/60 text-red-600' :
                                    'text-gray-700'
                            }`}
                        style={{ width: `${config.cellWidth}px` }}
                    >
                        {config.label(date)}
                    </div>
                );
            })}
        </div>
    );
}
