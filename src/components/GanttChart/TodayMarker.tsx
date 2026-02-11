import type { ViewMode } from '../../types';
import { getDatePosition } from '../../utils/ganttUtils';

interface TodayMarkerProps {
    startDate: Date;
    viewMode: ViewMode;
}

export function TodayMarker({ startDate, viewMode }: TodayMarkerProps) {
    const today = new Date();
    const position = getDatePosition(today, startDate, viewMode);

    return (
        <div
            className="absolute top-0 bottom-0 w-px bg-red-400 z-30 pointer-events-none"
            style={{ left: `${position}px` }}
        >
            <div className="absolute top-0 -left-1.5 w-3 h-3 bg-red-400 rounded-full shadow-sm" />
        </div>
    );
}
