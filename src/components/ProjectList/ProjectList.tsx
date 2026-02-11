import * as React from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { Modal, Button } from '../common';
import { Plus, Trash2, Calendar, Edit2 } from 'lucide-react';
import { format } from 'date-fns';

export function ProjectList({ onSelectProject }: { onSelectProject: (id: string) => void }) {
    const { projects, addProject, deleteProject, updateProject } = useProjectStore();
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [editingProject, setEditingProject] = React.useState<string | null>(null);
    const [formData, setFormData] = React.useState({
        name: '',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingProject) {
            updateProject(editingProject, {
                name: formData.name,
                startDate: new Date(formData.startDate),
                endDate: new Date(formData.endDate),
            });
        } else {
            addProject({
                name: formData.name,
                startDate: new Date(formData.startDate),
                endDate: new Date(formData.endDate),
            });
        }
        handleCloseModal();
    };

    const handleOpenEdit = (e: React.MouseEvent, project: any) => {
        e.stopPropagation();
        setEditingProject(project.id);
        setFormData({
            name: project.name,
            startDate: format(project.startDate, 'yyyy-MM-dd'),
            endDate: format(project.endDate, 'yyyy-MM-dd'),
        });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingProject(null);
        setFormData({
            name: '',
            startDate: format(new Date(), 'yyyy-MM-dd'),
            endDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        });
    };

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900">プロジェクト一覧</h1>
                <Button onClick={() => setIsModalOpen(true)}>
                    <Plus size={18} className="mr-2 inline" />
                    新規プロジェクト
                </Button>
            </div>

            {projects.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">プロジェクトがありません</p>
                    <p className="text-sm text-gray-500 mt-2">「新規プロジェクト」ボタンから作成してください</p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {projects.map((project) => (
                        <div
                            key={project.id}
                            className="bg-white border rounded-lg p-4 hover:shadow-md transition cursor-pointer"
                            onClick={() => onSelectProject(project.id)}
                        >
                            <div className="flex items-start justify-between mb-2">
                                <h3 className="font-semibold text-lg text-gray-900 flex-1 mr-2">{project.name}</h3>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => handleOpenEdit(e, project)}
                                        className="text-gray-400 hover:text-blue-500 transition p-1"
                                        title="プロジェクトを編集"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm(`「${project.name}」を削除しますか?`)) {
                                                deleteProject(project.id);
                                            }
                                        }}
                                        className="text-gray-400 hover:text-red-500 transition p-1"
                                        title="プロジェクトを削除"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                            <div className="text-sm text-gray-600 space-y-1">
                                <div>開始: {format(project.startDate, 'yyyy/MM/dd')}</div>
                                <div>終了: {format(project.endDate, 'yyyy/MM/dd')}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingProject ? "プロジェクトの編集" : "新規プロジェクト作成"}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* ... (fields remain the same) ... */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            プロジェクト名 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="例: Webサイトリニューアル"
                        />
                    </div>
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
                    <div className="flex gap-2 pt-2">
                        <Button type="submit" className="flex-1">
                            {editingProject ? '更新' : '作成'}
                        </Button>
                        <Button type="button" variant="secondary" onClick={handleCloseModal}>
                            キャンセル
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
