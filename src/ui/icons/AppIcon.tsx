import type { CSSProperties } from 'react';

export type AppIconName =
  | 'menu'
  | 'close'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'workbook'
  | 'materials'
  | 'calibration'
  | 'products'
  | 'yield'
  | 'production'
  | 'pricing'
  | 'search'
  | 'alert'
  | 'refresh'
  | 'scale'
  | 'check-circle'
  | 'component'
  | 'package'
  | 'inventory'
  | 'plus'
  | 'plus-circle'
  | 'arrow-left'
  | 'corner-down-right'
  | 'flame'
  | 'jar'
  | 'palette'
  | 'activity'
  | 'history'
  | 'loader'
  | 'printer'
  | 'edit'
  | 'archive'
  | 'restore';

export interface AppIconProps {
  readonly name: AppIconName;
  readonly size?: number;
  readonly strokeWidth?: number;
  readonly className?: string;
  readonly label?: string;
  readonly style?: CSSProperties;
}

function IconPaths({ name }: { readonly name: AppIconName }) {
  switch (name) {
    case 'menu':
      return <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>;
    case 'close':
      return <><path d="m6 6 12 12" /><path d="M18 6 6 18" /></>;
    case 'chevron-left':
      return <path d="m15 18-6-6 6-6" />;
    case 'chevron-right':
      return <path d="m9 18 6-6-6-6" />;
    case 'chevron-down':
      return <path d="m6 9 6 6 6-6" />;
    case 'arrow-left':
      return <><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></>;
    case 'workbook':
      return <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 3v18" /><path d="M12 8h5" /><path d="M12 12h5" /><path d="M12 16h3" /></>;
    case 'materials':
      return <><path d="m12 3 8 4-8 4-8-4 8-4Z" /><path d="m4 12 8 4 8-4" /><path d="m4 17 8 4 8-4" /></>;
    case 'calibration':
      return <><path d="M4 7h10" /><path d="M18 7h2" /><circle cx="16" cy="7" r="2" /><path d="M4 17h2" /><path d="M10 17h10" /><circle cx="8" cy="17" r="2" /><path d="M4 12h5" /><path d="M13 12h7" /><circle cx="11" cy="12" r="2" /></>;
    case 'products':
      return <><path d="m12 3 7.5 4.2v9.6L12 21l-7.5-4.2V7.2L12 3Z" /><path d="m4.8 7.4 7.2 4 7.2-4" /><path d="M12 11.4V21" /></>;
    case 'yield':
      return <><path d="M4 18 10 12l4 4 6-8" /><path d="M15 8h5v5" /></>;
    case 'production':
      return <><path d="M3 21V9l6 3V9l6 3V6l6 4v11H3Z" /><path d="M7 17h2" /><path d="M13 17h2" /><path d="M18 17h1" /></>;
    case 'pricing':
      return <><circle cx="12" cy="12" r="9" /><path d="M16 8.5c-.9-.9-2.1-1.5-4-1.5-2.2 0-3.5 1-3.5 2.5 0 1.7 1.6 2.2 3.8 2.6 2.1.4 3.2.9 3.2 2.5 0 1.5-1.3 2.5-3.5 2.5-1.9 0-3.3-.6-4.2-1.6" /><path d="M12 5v14" /></>;
    case 'search':
      return <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>;
    case 'alert':
      return <><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>;
    case 'refresh':
      return <><path d="M20 6v5h-5" /><path d="M4 18v-5h5" /><path d="M18.2 9A7 7 0 0 0 6.6 6.4L4 9" /><path d="M5.8 15A7 7 0 0 0 17.4 17.6L20 15" /></>;
    case 'scale':
      return <><path d="M12 3v18" /><path d="M5 7h14" /><path d="m7 7-3 6h6L7 7Z" /><path d="m17 7-3 6h6l-3-6Z" /><path d="M8 21h8" /></>;
    case 'check-circle':
      return <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16.5 9" /></>;
    case 'component':
      return <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="8.5" y="14" width="7" height="7" rx="1.5" /><path d="M6.5 10v2h11v-2" /><path d="M12 12v2" /></>;
    case 'package':
      return <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4 7.5 8 4.5 8-4.5" /><path d="M12 12v9" /></>;
    case 'inventory':
      return <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 5V3h10v2" /><path d="M3 10h18" /><path d="M8 14h3" /><path d="M8 17h7" /></>;
    case 'plus':
      return <><path d="M12 5v14" /><path d="M5 12h14" /></>;
    case 'plus-circle':
      return <><circle cx="12" cy="12" r="9" /><path d="M12 8v8" /><path d="M8 12h8" /></>;
    case 'corner-down-right':
      return <><path d="M5 4v7a4 4 0 0 0 4 4h10" /><path d="m15 11 4 4-4 4" /></>;
    case 'flame':
      return <><path d="M12 22c4.4 0 7-2.8 7-6.6 0-3.1-1.8-5.1-4.8-8.4-.3 2.1-1.1 3.5-2.3 4.5.1-3.5-1.6-6.3-4.3-9.5.1 4.2-2.6 6.3-2.6 10.3C5 17.7 7.9 22 12 22Z" /><path d="M9.5 17c0 1.7 1.1 3 2.5 3s2.5-1.3 2.5-3c0-1.4-.7-2.4-2.2-4.1-.2 1.1-.6 1.8-1.2 2.4-.1-1.6-.7-2.8-1.6-4.1.1 2.2 0 3.4 0 5.8Z" /></>;
    case 'jar':
      return <><path d="M7 4h10" /><path d="M8 4v3l-2 3v8a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-8l-2-3V4" /><path d="M6 11h12" /></>;
    case 'palette':
      return <><path d="M12 3a9 9 0 1 0 0 18h1.2a1.8 1.8 0 0 0 1.1-3.2c-.8-.6-.4-1.8.6-1.8H17a4 4 0 0 0 4-4c0-5-4-9-9-9Z" /><circle cx="7.5" cy="10" r="1" /><circle cx="10" cy="6.8" r="1" /><circle cx="14.2" cy="6.8" r="1" /><circle cx="17" cy="10" r="1" /></>;
    case 'activity':
      return <><path d="M3 12h4l2-5 4 10 2-5h6" /></>;
    case 'history':
      return <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></>;
    case 'loader':
      return <><path d="M12 3a9 9 0 0 1 9 9" /><path d="M12 21a9 9 0 0 1-9-9" /></>;
    case 'printer':
      return <><path d="M6 9V3h12v6" /><rect x="6" y="14" width="12" height="7" rx="1" /><path d="M6 17H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" /><path d="M18 12h.01" /></>;
    case 'edit':
      return <><path d="M12 20h9" /><path d="m16.5 3.5 4 4L8 20H4v-4L16.5 3.5Z" /></>;
    case 'archive':
      return <><path d="M4 7h16" /><path d="M5 7v13h14V7" /><path d="M3 3h18v4H3z" /><path d="M9 11h6" /></>;
    case 'restore':
      return <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>;
  }
}

export function AppIcon({
  name,
  size = 20,
  strokeWidth = 1.8,
  className = '',
  label,
  style,
}: AppIconProps) {
  return (
    <svg
      className={`app-icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      style={style}
    >
      <IconPaths name={name} />
    </svg>
  );
}
