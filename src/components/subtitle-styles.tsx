import React from 'react';

export type SubtitleStyleProps = {
    text: string;
};

// 1. Modern Clean
const ModernStyle: React.FC<SubtitleStyleProps> = ({ text }) => (
    <h2
        className="text-white font-bold drop-shadow-md mx-auto"
        style={{
            fontFamily: '"Inter", "Roboto", sans-serif',
            fontSize: '52px',
            lineHeight: 1.2,
            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
            margin: 0,
        }}
    >
        {text}
    </h2>
);

// 2. Classic Yellow (Broadcast Style)
const ClassicStyle: React.FC<SubtitleStyleProps> = ({ text }) => (
    <h2
        className="mx-auto"
        style={{
            fontFamily: 'Arial, sans-serif',
            fontSize: '52px',
            color: '#FFD700', // Gold
            textShadow:
                '3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
            fontWeight: 600,
            margin: 0,
        }}
    >
        {text}
    </h2>
);

// 3. Boxed (YouTube/Social Style)
const BoxedStyle: React.FC<SubtitleStyleProps> = ({ text }) => (
    <span
        className="mx-auto"
        style={{
            fontFamily: '"Roboto", sans-serif',
            fontSize: '42px',
            fontWeight: 'bold',
            color: 'white',
            backgroundColor: 'rgba(0,0,0,0.75)',
            padding: '8px 24px',
            borderRadius: '12px',
            display: 'inline-block',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}
    >
        {text}
    </span>
);

// 4. Impact (Meme/Shorts Style)
const ImpactStyle: React.FC<SubtitleStyleProps> = ({ text }) => (
    <h2
        className="mx-auto"
        style={{
            fontFamily: 'Impact, sans-serif',
            fontSize: '72px',
            color: 'white',
            WebkitTextStroke: '4px black',
            textShadow: '4px 4px 0 #000',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            margin: 0,
        }}
    >
        {text}
    </h2>
);

// 5. Neon (Cyberpunk Style)
const NeonStyle: React.FC<SubtitleStyleProps> = ({ text }) => (
    <h2
        className="mx-auto"
        style={{
            fontFamily: 'sans-serif',
            fontSize: '60px',
            color: '#fff',
            textShadow: `
                0 0 7px #fff,
                0 0 10px #fff,
                0 0 21px #fff,
                0 0 42px #0fa,
                0 0 82px #0fa
            `,
            fontWeight: 'bold',
            margin: 0,
        }}
    >
        {text}
    </h2>
);

export const SUBTITLE_STYLES = {
    modern: { component: ModernStyle, label: 'Modern', bg: 'bg-slate-900', border: 'border-slate-600', text: 'Aa' },
    classic: { component: ClassicStyle, label: 'Classic', bg: 'bg-yellow-400', border: 'border-yellow-600', text: 'Aa' },
    boxed: { component: BoxedStyle, label: 'Boxed', bg: 'bg-black', border: 'border-slate-700', text: 'Aa' },
    impact: { component: ImpactStyle, label: 'Impact', bg: 'bg-white', border: 'border-black', text: 'AA' },
    neon: { component: NeonStyle, label: 'Neon', bg: 'bg-green-900', border: 'border-green-500', text: 'Aa' },
} as const;

export type SubtitleStyleId = keyof typeof SUBTITLE_STYLES;