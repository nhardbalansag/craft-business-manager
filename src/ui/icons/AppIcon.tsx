import type { CSSProperties } from 'react';
import type { IconType } from 'react-icons';
import {
  LuActivity,
  LuArchive,
  LuArrowLeft,
  LuBookOpen,
  LuBox,
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuCircleCheck,
  LuCirclePlus,
  LuCornerDownRight,
  LuDollarSign,
  LuFactory,
  LuFlame,
  LuGitBranch,
  LuGlassWater,
  LuHistory,
  LuLayers,
  LuLoader,
  LuMenu,
  LuPackage,
  LuPalette,
  LuPencil,
  LuPlus,
  LuPrinter,
  LuRefreshCw,
  LuRotateCcw,
  LuScale,
  LuSearch,
  LuSlidersHorizontal,
  LuTrendingUp,
  LuTriangleAlert,
  LuX,
} from 'react-icons/lu';

/**
 * App-level icon names stay stable so views do not depend on a particular icon
 * pack. Use https://react-icons.github.io/react-icons/ when choosing new icons.
 */
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

// Central mapping makes it easy to swap icon designs without editing screens.
// React Icons only bundles the icons we import from this pack.
const iconMap: Record<AppIconName, IconType> = {
  menu: LuMenu,
  close: LuX,
  'chevron-left': LuChevronLeft,
  'chevron-right': LuChevronRight,
  'chevron-down': LuChevronDown,
  workbook: LuBookOpen,
  materials: LuLayers,
  calibration: LuSlidersHorizontal,
  products: LuPackage,
  yield: LuTrendingUp,
  production: LuFactory,
  pricing: LuDollarSign,
  search: LuSearch,
  alert: LuTriangleAlert,
  refresh: LuRefreshCw,
  scale: LuScale,
  'check-circle': LuCircleCheck,
  component: LuGitBranch,
  package: LuBox,
  inventory: LuArchive,
  plus: LuPlus,
  'plus-circle': LuCirclePlus,
  'arrow-left': LuArrowLeft,
  'corner-down-right': LuCornerDownRight,
  flame: LuFlame,
  jar: LuGlassWater,
  palette: LuPalette,
  activity: LuActivity,
  history: LuHistory,
  loader: LuLoader,
  printer: LuPrinter,
  edit: LuPencil,
  archive: LuArchive,
  restore: LuRotateCcw,
};

export function AppIcon({
  name,
  size = 20,
  strokeWidth = 1.8,
  className = '',
  label,
  style,
}: AppIconProps) {
  const Icon = iconMap[name];

  return (
    <Icon
      className={`app-icon ${className}`.trim()}
      size={size}
      strokeWidth={strokeWidth}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      style={style}
    />
  );
}
