import React, { useState, useRef } from 'react';
import { Plus } from 'lucide-react';
import { addAsset } from '../../api';

interface AddAssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    onAssetAdded: (assets: any[]) => void;
}

export const AddAssetModal: React.FC<AddAssetModalProps> = ({ isOpen, onClose, projectId, onAssetAdded }) => {
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        uploadFile(file);
    };

    const uploadFile = async (file: File) => {
        setIsUploading(true);
        try {
            const assets = await addAsset(projectId, file);
            onAssetAdded(assets);
            onClose();
        } catch (err) {
            console.error(err);
            alert("Failed to upload");
        } finally {
            setIsUploading(false);
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files?.[0]) uploadFile(e.dataTransfer.files[0]);
    }

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 p-1 rounded-2xl w-[400px] shadow-2xl ring-1 ring-white/10">
                <div className="p-5 border-b border-slate-800 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-white">Upload Asset</h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">✕</button>
                </div>

                <div className="p-6">
                    <div
                        onClick={() => !isUploading && fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        className={`
                    border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200
                    ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 bg-slate-950 hover:border-slate-600 hover:bg-slate-900'}
                    ${isUploading ? 'opacity-50 pointer-events-none' : ''}
                `}
                    >
                        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept="video/*,audio/*,image/*" />
                        <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mb-3 text-slate-400">
                            <Plus size={24} />
                        </div>
                        <p className="font-bold text-slate-300 text-sm">Click to Upload</p>
                        <p className="text-slate-500 text-xs mt-1">or drag and drop video/audio/image files</p>
                    </div>

                    {isUploading && (
                        <div className="mt-4 text-center text-xs text-blue-400 animate-pulse font-medium">
                            Uploading & Processing...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
