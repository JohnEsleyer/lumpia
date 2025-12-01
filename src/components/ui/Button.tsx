import React from 'react';

// We use a loose type for 'as' to allow 'span' or other elements without complex generic overhead for this simple project.
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger';
    isLoading?: boolean;
    as?: React.ElementType;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    isLoading,
    className = '',
    disabled,
    as: Component = 'button', // Default to 'button'
    ...props
}) => {
    const baseStyles = "px-4 py-2.5 rounded-lg font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none";

    const variants = {
        primary: "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20",
        secondary: "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700",
        danger: "bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50"
    };

    return (
        <Component
            className={`${baseStyles} ${variants[variant]} ${className}`}
            // Only pass disabled if it's a button, though React handles this gracefully usually.
            // For span, we rely on CSS pointer-events or custom logic if strictly needed, 
            // but here we just pass it through.
            disabled={isLoading || disabled}
            {...props}
        >
            {isLoading && <span className="animate-spin">⏳</span>}
            {children}
        </Component>
    );
};