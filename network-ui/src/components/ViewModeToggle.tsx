/**
 * ViewModeToggle Component
 * 
 * Clean, technical toggle for switching between visualization modes.
 * 2D (Graph) -> 2.5D (Depth) -> 3D (Spatial)
 * 
 * Respects device capabilities: WebGL-required modes are disabled
 * on unsupported devices.
 */

import { type ViewMode, VIEW_MODES, isWebGLSupported } from '../lib/spatial-adapter';
import { Grid3X3, Layers, Box } from 'lucide-react';

interface ViewModeToggleProps {
  currentMode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  disabled?: boolean;
}

const MODE_ICONS: Record<ViewMode, typeof Grid3X3> = {
  graph: Grid3X3,
  depth: Layers,
  spatial: Box,
};

export default function ViewModeToggle({
  currentMode,
  onModeChange,
  disabled = false,
}: ViewModeToggleProps) {
  const webGLAvailable = isWebGLSupported();

  return (
    <div className="flex items-center gap-1 bg-gray-800/90 backdrop-blur-sm border border-gray-700 rounded-lg p-1">
      {VIEW_MODES.map((mode) => {
        const Icon = MODE_ICONS[mode.id];
        const isActive = currentMode === mode.id;
        const isDisabled = disabled || (mode.requiresWebGL && !webGLAvailable);

        return (
          <button
            key={mode.id}
            onClick={() => !isDisabled && onModeChange(mode.id)}
            disabled={isDisabled}
            title={
              isDisabled && mode.requiresWebGL && !webGLAvailable
                ? `${mode.label} requires WebGL`
                : mode.description
            }
            className={`
              relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
              transition-all duration-150
              ${isActive
                ? 'bg-blue-600 text-white shadow-sm'
                : isDisabled
                  ? 'text-gray-600 cursor-not-allowed'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }
            `}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{mode.label}</span>
            {isActive && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-blue-400 rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Compact version for mobile or constrained spaces
 */
export function ViewModeToggleCompact({
  currentMode,
  onModeChange,
  disabled = false,
}: ViewModeToggleProps) {
  const webGLAvailable = isWebGLSupported();

  return (
    <div className="flex items-center bg-gray-800/90 backdrop-blur-sm border border-gray-700 rounded-md">
      {VIEW_MODES.map((mode) => {
        const Icon = MODE_ICONS[mode.id];
        const isActive = currentMode === mode.id;
        const isDisabled = disabled || (mode.requiresWebGL && !webGLAvailable);

        return (
          <button
            key={mode.id}
            onClick={() => !isDisabled && onModeChange(mode.id)}
            disabled={isDisabled}
            title={mode.description}
            className={`
              p-2 transition-colors
              ${isActive
                ? 'bg-blue-600 text-white'
                : isDisabled
                  ? 'text-gray-600 cursor-not-allowed'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }
              first:rounded-l-md last:rounded-r-md
            `}
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
}
