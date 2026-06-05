import React from 'react';
import { UploadCloud } from 'lucide-react';

interface UploadZoneProps {
  isDragging: boolean;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
}

export default function UploadZone({
  isDragging,
  onDragLeave,
  onDrop
}: UploadZoneProps) {
  if (!isDragging) return null;

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="absolute inset-0 bg-slate-900/40 backdrop-blur-[4px] z-50 flex items-center justify-center p-8 transition-all duration-300"
    >
      <div className="w-full max-w-lg aspect-video rounded-3xl border-2 border-dashed border-brand-400 bg-white/90 shadow-2xl flex flex-col items-center justify-center gap-4 transition-transform duration-300 scale-100 animate-pulse">
        <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-500 shadow-md">
          <UploadCloud className="w-8 h-8" />
        </div>
        <div className="text-center">
          <h3 className="font-bold text-slate-800 text-lg">Subir archivos a Mi Unidad</h3>
          <p className="text-sm text-slate-500 mt-1">
            Suelta los archivos aquí para cargarlos instantáneamente
          </p>
        </div>
        <div className="px-4 py-1.5 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold">
          Formatos PDF, Word (.docx) y Excel (.xlsx) soportados
        </div>
      </div>
    </div>
  );
}
