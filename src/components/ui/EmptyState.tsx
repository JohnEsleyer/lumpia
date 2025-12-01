import React from 'react';

interface EmptyStateProps {
    icon: string;
    title: string;
    description: string;
    action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon,
    title,
    description,
    action
}) => {
    return (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/20">
            <div className="text-6xl mb-6 opacity-80 filter drop-shadow-lg">{icon}</div>
            <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
            <p className="text-slate-400 max-w-md mb-8 leading-relaxed">{description}</p>
            {action && <div>{action}</div>}
        </div>
    );
};