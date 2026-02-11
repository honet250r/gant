import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useTaskStore } from '../stores/taskStore';

interface SupabaseSyncProps {
    projectId: string;
}

export const SupabaseSync = ({ projectId }: SupabaseSyncProps) => {
    const { syncWithSupabase } = useTaskStore();

    useEffect(() => {
        if (!projectId) return;

        // Initial fetch
        syncWithSupabase(projectId);

        // Subscribe to realtime changes
        const channel = supabase
            .channel(`project-${projectId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'tasks',
                    filter: `project_id=eq.${projectId}`
                },
                (payload) => {
                    console.log('Realtime update received:', payload);
                    // Simple approach: Refetch all tasks for this project on any change
                    // Alternatively, we could update the store based on payload.new/old
                    syncWithSupabase(projectId);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [projectId, syncWithSupabase]);

    return null;
};
