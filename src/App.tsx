import * as React from 'react';
import { ProjectList } from './components/ProjectList/ProjectList';
import { GanttChart } from './components/GanttChart/GanttChart';
import { useProjectStore } from './stores/projectStore';
import { useTaskStore } from './stores/taskStore';
import { ArrowLeft, Database, Download, Upload, AlertTriangle, Edit2 } from 'lucide-react';
import { Modal, Button } from './components/common';

function App() {
    const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(null);
    const { projects, setProjects, updateProject } = useProjectStore();
    const { tasks, setTasks } = useTaskStore();
    const [isDataModalOpen, setIsDataModalOpen] = React.useState(false);
    const [importError, setImportError] = React.useState<string | null>(null);

    const [isEditingName, setIsEditingName] = React.useState(false);
    const [tempName, setTempName] = React.useState('');

    const selectedProject = projects.find((p) => p.id === selectedProjectId);

    const handleSaveName = () => {
        if (selectedProjectId && tempName.trim()) {
            updateProject(selectedProjectId, { name: tempName.trim() });
        }
        setIsEditingName(false);
    };

    const handleStartEditing = () => {
        if (selectedProject) {
            setTempName(selectedProject.name);
            setIsEditingName(true);
        }
    };

    const handleExport = () => {
        const data = {
            projects,
            tasks,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gantt-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                if (!json.projects || !json.tasks) {
                    throw new Error('無効なバックアップファイルです。');
                }

                // Confirm overwrite
                if (window.confirm('現在のデータはすべて上書きされます。よろしいですか？')) {
                    // Convert date strings back to Date objects
                    const revivedProjects = json.projects.map((p: any) => ({
                        ...p,
                        startDate: new Date(p.startDate),
                        endDate: new Date(p.endDate),
                        createdAt: new Date(p.createdAt),
                        updatedAt: new Date(p.updatedAt)
                    }));
                    const revivedTasks = json.tasks.map((t: any) => ({
                        ...t,
                        startDate: new Date(t.startDate),
                        endDate: new Date(t.endDate),
                        createdAt: new Date(t.createdAt),
                        updatedAt: new Date(t.updatedAt)
                    }));

                    setProjects(revivedProjects);
                    setTasks(revivedTasks);
                    setIsDataModalOpen(false);
                    alert('データの復元が完了しました。');
                }
            } catch (err) {
                setImportError('インポートに失敗しました：' + (err instanceof Error ? err.message : '不明なエラー'));
            }
        };
        reader.readAsText(file);
    };

    const headerContent = (
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
                {selectedProjectId && (
                    <button
                        onClick={() => setSelectedProjectId(null)}
                        className="p-1.5 rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all duration-200 active:scale-95"
                        title="プロジェクト一覧へ戻る"
                    >
                        <ArrowLeft size={20} />
                    </button>
                )}
                <div>
                    <div className="flex items-center gap-2 group">
                        {isEditingName ? (
                            <input
                                autoFocus
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                                onBlur={handleSaveName}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                                className="text-xl font-bold text-gray-900 border-b-2 border-blue-500 focus:outline-none bg-transparent px-1 py-0.5"
                            />
                        ) : (
                            <>
                                <h1 className="text-xl font-bold text-gray-900">
                                    {selectedProject ? selectedProject.name : 'SimpleGantt'}
                                </h1>
                                {selectedProject && (
                                    <button
                                        onClick={handleStartEditing}
                                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors sm:opacity-0 group-hover:opacity-100 focus:opacity-100"
                                        title="プロジェクト名を編集"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                    {selectedProject && (
                        <p className="text-sm text-gray-600">
                            {selectedProject.startDate.toLocaleDateString()} - {selectedProject.endDate.toLocaleDateString()}
                        </p>
                    )}
                </div>
            </div>

            <button
                onClick={() => setIsDataModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                title="データ管理（バックアップ・復元）"
            >
                <Database size={18} />
                <span className="hidden sm:inline">データ管理</span>
            </button>
        </div>
    );

    if (!selectedProjectId || !selectedProject) {
        return (
            <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
                {headerContent}
                <div className="flex-1 overflow-auto animate-in fade-in">
                    <ProjectList onSelectProject={setSelectedProjectId} />
                </div>
                {renderDataModal()}
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-gray-50 animate-in fade-in">
            {headerContent}

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                <GanttChart
                    projectId={selectedProjectId}
                    projectStartDate={selectedProject.startDate}
                    projectEndDate={selectedProject.endDate}
                />
            </div>
            {renderDataModal()}
        </div>
    );

    function renderDataModal() {
        return (
            <Modal
                isOpen={isDataModalOpen}
                onClose={() => {
                    setIsDataModalOpen(false);
                    setImportError(null);
                }}
                title="データ管理"
            >
                <div className="space-y-6">
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
                        <h3 className="text-sm font-bold text-blue-800 flex items-center gap-2 mb-2">
                            <Download size={16} /> バックアップ（エクスポート）
                        </h3>
                        <p className="text-xs text-blue-700 mb-3">
                            現在のすべてのデータをJSONファイルとしてダウンロードします。ブラウザのキャッシュをクリアする前に保存してください。
                        </p>
                        <Button onClick={handleExport} className="w-full text-xs py-2">
                            バックアップファイルをダウンロード
                        </Button>
                    </div>

                    <div className="bg-amber-50 border border-amber-100 p-4 rounded-lg">
                        <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2 mb-2">
                            <Upload size={16} /> 復元（インポート）
                        </h3>
                        <p className="text-xs text-amber-700 mb-3">
                            保存したバックアップファイルを読み込みます。
                        </p>

                        <div className="relative">
                            <input
                                type="file"
                                accept=".json"
                                onChange={handleImport}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <Button variant="secondary" className="w-full text-xs py-2 pointer-events-none">
                                ファイルを選択して復元
                            </Button>
                        </div>

                        {importError && (
                            <div className="mt-3 text-red-600 text-[10px] flex items-start gap-1">
                                <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                                {importError}
                            </div>
                        )}
                    </div>

                    <div className="text-[10px] text-gray-400 text-center">
                        ※ インポートを行うと現在のデータはすべて消去されます。
                    </div>
                </div>
            </Modal>
        );
    }
}

export default App;
