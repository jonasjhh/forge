import './ui.css';
import React from 'react';
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    label: string;
}

export default function IconButton({ label, children, ...props }: IconButtonProps) {
    return (
        <button type="button" className="icon-button" title={label} aria-label={label} {...props}>
            {children}
        </button>
    );
}
