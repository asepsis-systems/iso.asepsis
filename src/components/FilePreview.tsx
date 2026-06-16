import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  FileText, 
  Maximize2, 
  Minimize2, 
  AlertTriangle,
  ChevronRight,
  Eye,
  FileSpreadsheet,
  FileCheck,
  Trash2,
  MousePointer2,
  MessageSquareMore,
  Pencil,
  Highlighter,
  Type
} from 'lucide-react';
import * as XLSX from 'xlsx';
import clsx from 'clsx';

interface Annotation {
  id: string;
  type: 'draw' | 'highlight' | 'text' | 'comment';
  pageNumber: number;
  points?: { x: number; y: number }[];
  text?: string;
  x?: number;
  y?: number;
  color?: string;
}

interface FilePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number | null;
  creator?: string | null;
  verifier1?: string | null;
  verifier2?: string | null;
  verifier3?: string | null;
  creatorSignature?: string | null;
  verifier1Signature?: string | null;
  verifier2Signature?: string | null;
  verifier3Signature?: string | null;
  canSign?: boolean;
  onVerify?: (placement?: { page: string; pageNumber?: number; x: number; y: number }, annotations?: Annotation[]) => void;
  onRemoveVerify?: () => void;
  canTrash?: boolean;
  onTrash?: () => void;
  currentUserName?: string | null;
  currentUserSignature?: string | null;
}

// Sub-component to render individual PDF pages and capture clicks for signature placement
interface PdfPageProps {
  pdfDoc: any;
  pageNum: number;
  isPlacing: boolean;
  activeTool: 'select' | 'comment' | 'draw' | 'highlight' | 'text' | 'signature';
  annotations: Annotation[];
  onAddAnnotation: (ann: Annotation) => void;
  placedPage: number;
  placedX: number;
  placedY: number;
  onPlace: (x: number, y: number) => void;
  signatureUrl: string | null;
  canSign: boolean;
}

function PdfPage({ 
  pdfDoc, 
  pageNum, 
  isPlacing, 
  activeTool,
  annotations,
  onAddAnnotation,
  placedPage, 
  placedX, 
  placedY, 
  onPlace, 
  signatureUrl,
  canSign
}: PdfPageProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([]);
  const [textInput, setTextInput] = useState<{ x: number; y: number; val: string } | null>(null);

  useEffect(() => {
    let active = true;
    if (pdfDoc) {
      setLoading(true);
      pdfDoc.getPage(pageNum).then((page: any) => {
        if (!active) return;
        const viewport = page.getViewport({ scale: 1.5 });
        if (active) {
          setPageSize({ width: viewport.width / 1.5, height: viewport.height / 1.5 });
        }
        const canvas = canvasRef.current;
        if (canvas) {
          const context = canvas.getContext('2d');
          if (context) {
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            const overlayCanvas = overlayCanvasRef.current;
            if (overlayCanvas) {
              overlayCanvas.height = viewport.height;
              overlayCanvas.width = viewport.width;
            }

            page.render({
              canvasContext: context,
              viewport: viewport
            }).promise.then(() => {
              if (active) setLoading(false);
            }).catch((err: any) => {
              console.error("Error rendering page:", pageNum, err);
            });
          }
        }
      }).catch((err: any) => {
        console.error("Error getting page:", pageNum, err);
      });
    }
    return () => {
      active = false;
    };
  }, [pdfDoc, pageNum]);

  // Redraw annotations on the overlay canvas
  const drawAnnotations = () => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = canvas.width;
    const h = canvas.height;

    annotations.forEach((ann) => {
      if (ann.pageNumber !== pageNum) return;

      if (ann.type === 'draw' || ann.type === 'highlight') {
        if (!ann.points || ann.points.length === 0) return;
        ctx.beginPath();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (ann.type === 'highlight') {
          ctx.strokeStyle = ann.color || 'rgba(253, 224, 71, 0.4)';
          ctx.lineWidth = 15 * (w / 612);
        } else {
          ctx.strokeStyle = ann.color || '#ef4444';
          ctx.lineWidth = 2 * (w / 612);
        }

        const first = ann.points[0];
        ctx.moveTo((first.x / 100) * w, (first.y / 100) * h);

        for (let i = 1; i < ann.points.length; i++) {
          const pt = ann.points[i];
          ctx.lineTo((pt.x / 100) * w, (pt.y / 100) * h);
        }
        ctx.stroke();
      }
    });

    if (isDrawing && currentStroke.length > 0) {
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (activeTool === 'highlight') {
        ctx.strokeStyle = 'rgba(253, 224, 71, 0.4)';
        ctx.lineWidth = 15 * (w / 612);
      } else if (activeTool === 'draw') {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2 * (w / 612);
      }

      const first = currentStroke[0];
      ctx.moveTo((first.x / 100) * w, (first.y / 100) * h);

      for (let i = 1; i < currentStroke.length; i++) {
        const pt = currentStroke[i];
        ctx.lineTo((pt.x / 100) * w, (pt.y / 100) * h);
      }
      ctx.stroke();
    }
  };

  useEffect(() => {
    drawAnnotations();
  }, [annotations, currentStroke, isDrawing, pageSize]);

  useEffect(() => {
    if (isPlacing && pageSize && overlayCanvasRef.current) {
      const canvas = overlayCanvasRef.current;
      canvas.width = pageSize.width * 1.5;
      canvas.height = pageSize.height * 1.5;
      drawAnnotations();
    }
  }, [pageSize, isPlacing]);

  const getCoordinatesFromEvent = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return { x, y };
  };

  const handleStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (activeTool !== 'draw' && activeTool !== 'highlight') return;
    if ('touches' in e) {
      e.preventDefault();
    }
    const coords = getCoordinatesFromEvent(e);
    if (!coords) return;
    setIsDrawing(true);
    setCurrentStroke([coords]);
  };

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    if ('touches' in e) {
      e.preventDefault();
    }
    const coords = getCoordinatesFromEvent(e);
    if (!coords) return;
    setCurrentStroke((prev) => [...prev, coords]);
  };

  const handleEnd = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentStroke.length > 1) {
      onAddAnnotation({
        id: Math.random().toString(36).substr(2, 9),
        type: activeTool === 'highlight' ? 'highlight' : 'draw',
        pageNumber: pageNum,
        points: currentStroke,
        color: activeTool === 'highlight' ? 'rgba(253, 224, 71, 0.4)' : '#ef4444'
      });
    }
    setCurrentStroke([]);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool !== 'text' && activeTool !== 'comment') return;
    const coords = getCoordinatesFromEvent(e);
    if (!coords) return;
    setTextInput({ x: coords.x, y: coords.y, val: '' });
  };

  const getCursorClass = () => {
    switch (activeTool) {
      case 'draw':
      case 'highlight':
        return 'cursor-crosshair';
      case 'text':
      case 'comment':
        return 'cursor-text';
      case 'signature':
        return 'cursor-pointer';
      default:
        return 'cursor-default';
    }
  };

  const handleSignatureMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canSign) return;
    e.stopPropagation();
    e.preventDefault();
    
    const canvas = overlayCanvasRef.current;
    if (!canvas || !pageSize) return;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      const y = ((moveEvent.clientY - rect.top) / rect.height) * 100;
      
      const halfW = (50 / pageSize.width) * 100;
      const halfH = (30 / pageSize.height) * 100;
      
      const clampedX = Math.max(halfW, Math.min(x, 100 - halfW));
      const clampedY = Math.max(halfH, Math.min(y, 100 - halfH));
      
      onPlace(Math.round(clampedX), Math.round(clampedY));
    };
    
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleSignatureTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!canSign) return;
    e.stopPropagation();
    if (e.touches.length === 0) return;
    
    const canvas = overlayCanvasRef.current;
    if (!canvas || !pageSize) return;
    
    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length === 0) return;
      const rect = canvas.getBoundingClientRect();
      const clientX = moveEvent.touches[0].clientX;
      const clientY = moveEvent.touches[0].clientY;
      
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;
      
      const halfW = (50 / pageSize.width) * 100;
      const halfH = (30 / pageSize.height) * 100;
      
      const clampedX = Math.max(halfW, Math.min(x, 100 - halfW));
      const clampedY = Math.max(halfH, Math.min(y, 100 - halfH));
      
      onPlace(Math.round(clampedX), Math.round(clampedY));
    };
    
    const handleTouchEnd = () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
    
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
  };

  return (
    <div className="relative mx-auto my-4 bg-white shadow-lg border border-slate-200/60 rounded-2xl overflow-hidden select-none" style={{ maxWidth: '612px', width: '100%' }}>
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/70 z-10 min-h-[400px]">
          <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-[10px] text-slate-400 mt-2 font-semibold">Renderizando pág. {pageNum}...</span>
        </div>
      )}
      <canvas ref={canvasRef} className="w-full h-auto block" />
      
      {isPlacing && (
        <div 
          className="absolute inset-0 z-10 select-none pointer-events-auto"
        >
          {/* Overlay canvas for drawings/highlights */}
          <canvas 
            ref={overlayCanvasRef} 
            className={`w-full h-auto block absolute inset-0 z-10 ${getCursorClass()}`}
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
            onClick={(e) => {
              if (activeTool === 'signature') {
                if (!pageSize) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const rawX = ((e.clientX - rect.left) / rect.width) * 100;
                const rawY = ((e.clientY - rect.top) / rect.height) * 100;
                
                const halfW = (50 / pageSize.width) * 100;
                const halfH = (30 / pageSize.height) * 100;
                
                const clampedX = Math.max(halfW, Math.min(rawX, 100 - halfW));
                const clampedY = Math.max(halfH, Math.min(rawY, 100 - halfH));
                
                onPlace(Math.round(clampedX), Math.round(clampedY));
              } else {
                handleCanvasClick(e);
              }
            }}
            onDragOver={(e) => {
              if (activeTool === 'signature') {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }
            }}
            onDrop={(e) => {
              if (activeTool === 'signature') {
                e.preventDefault();
                if (!pageSize) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const rawX = ((e.clientX - rect.left) / rect.width) * 100;
                const rawY = ((e.clientY - rect.top) / rect.height) * 100;
                
                const halfW = (50 / pageSize.width) * 100;
                const halfH = (30 / pageSize.height) * 100;
                
                const clampedX = Math.max(halfW, Math.min(rawX, 100 - halfW));
                const clampedY = Math.max(halfH, Math.min(rawY, 100 - halfH));
                
                onPlace(Math.round(clampedX), Math.round(clampedY));
              }
            }}
          />

          {/* HTML Overlay for text annotations */}
          {annotations.filter(a => a.pageNumber === pageNum && a.type === 'text').map((ann) => (
            <div
              key={ann.id}
              style={{
                left: `${ann.x}%`,
                top: `${ann.y}%`,
                color: ann.color || '#ef4444'
              }}
              className="absolute z-20 text-[12px] font-bold pointer-events-none select-none whitespace-pre-wrap max-w-[200px]"
            >
              {ann.text}
            </div>
          ))}

          {/* HTML Overlay for comment annotations */}
          {annotations.filter(a => a.pageNumber === pageNum && a.type === 'comment').map((ann) => (
            <div
              key={ann.id}
              style={{
                left: `${ann.x}%`,
                top: `${ann.y}%`,
                transform: 'translate(-50%, -50%)'
              }}
              className="absolute z-20 w-6 h-6 bg-amber-500 border-2 border-white rounded-full flex items-center justify-center cursor-pointer shadow-md text-[10px] hover:scale-110 active:scale-95 transition-all group pointer-events-auto"
            >
              <span>💬</span>
              
              {/* Tooltip on hover */}
              <div className="absolute bottom-full mb-2 bg-slate-900/95 text-white text-[10px] p-2 rounded-xl shadow-xl w-48 hidden group-hover:block z-40 pointer-events-none select-text leading-relaxed font-semibold">
                <div className="font-bold text-amber-400 mb-0.5">Nota:</div>
                {ann.text}
              </div>
            </div>
          ))}

          {/* Inline Text/Comment Input Popup */}
          {textInput && (
            <div 
              style={{
                left: `${textInput.x}%`,
                top: `${textInput.y}%`,
                transform: 'translate(-5px, -5px)'
              }}
              className="absolute z-30 bg-white border border-slate-300 rounded-xl p-2.5 shadow-xl flex flex-col gap-2 w-64 animate-in zoom-in-95 duration-100 pointer-events-auto"
            >
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {activeTool === 'text' ? 'Añadir Texto' : 'Añadir Comentario'}
              </span>
              <textarea
                value={textInput.val}
                onChange={(e) => setTextInput(prev => prev ? { ...prev, val: e.target.value } : null)}
                placeholder={activeTool === 'text' ? 'Escribe tu texto aquí...' : 'Escribe tu nota/comentario aquí...'}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-h-[60px]"
                autoFocus
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setTextInput(null)}
                  className="px-2.5 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 rounded-md transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (textInput.val.trim()) {
                      onAddAnnotation({
                        id: Math.random().toString(36).substr(2, 9),
                        type: activeTool === 'text' ? 'text' : 'comment',
                        pageNumber: pageNum,
                        x: textInput.x,
                        y: textInput.y,
                        text: textInput.val.trim(),
                        color: activeTool === 'text' ? '#ef4444' : '#f59e0b'
                      });
                    }
                    setTextInput(null);
                  }}
                  className="px-2.5 py-1 text-[10px] font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                >
                  Aceptar
                </button>
              </div>
            </div>
          )}

          {/* Signature Box Overlay */}
          {placedPage === pageNum && (
            <div 
              style={{
                left: `${placedX}%`,
                top: `${placedY}%`,
                width: pageSize ? `${(100 / pageSize.width) * 100}%` : '16.3%',
                height: pageSize ? `${(60 / pageSize.height) * 100}%` : '7.6%',
                transform: 'translate(-50%, -50%)'
              }}
              onMouseDown={canSign ? handleSignatureMouseDown : undefined}
              onTouchStart={canSign ? handleSignatureTouchStart : undefined}
              className={clsx(
                "absolute border-2 border-brand-500 bg-brand-50/90 rounded-xl shadow-lg flex items-center justify-center animate-in zoom-in-95 duration-100 z-20",
                canSign ? "cursor-move pointer-events-auto" : "pointer-events-none cursor-default"
              )}
            >
              {signatureUrl ? (
                <img src={signatureUrl} alt="Firma" className="max-h-full max-w-full object-contain mix-blend-multiply pointer-events-none" />
              ) : (
                <span className="text-[9px] font-bold text-brand-600 pointer-events-none">Mi Firma</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function FilePreview({
  isOpen,
  onClose,
  fileName,
  fileUrl,
  mimeType,
  fileSize,
  creator,
  verifier1,
  verifier2,
  verifier3,
  creatorSignature,
  verifier1Signature,
  verifier2Signature,
  verifier3Signature,
  canSign = false,
  onVerify,
  onRemoveVerify,
  canTrash = false,
  onTrash,
  currentUserName = '',
  currentUserSignature = null
}: FilePreviewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [excelSheets, setExcelSheets] = useState<string[]>([]);
  const [currentSheet, setCurrentSheet] = useState<string>('');
  const [excelData, setExcelData] = useState<any[][]>([]);

  const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
  const isPDF = mimeType === 'application/pdf' || fileExtension === 'pdf';
  const isImage = mimeType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(fileExtension);
  const isExcel = mimeType.includes('spreadsheet') || mimeType.includes('excel') || ['xlsx', 'xls', 'csv'].includes(fileExtension);
  const isWord = mimeType.includes('word') || ['docx', 'doc'].includes(fileExtension);

  const isNextSlotV1 = canSign && !verifier1;
  const isNextSlotV2 = canSign && verifier1 && !verifier2;
  const userNormalized = currentUserName?.trim().toLowerCase();
  const hasUserSigned = 
    (verifier1?.trim().toLowerCase() === userNormalized) ||
    (verifier2?.trim().toLowerCase() === userNormalized) ||
    (verifier3?.trim().toLowerCase() === userNormalized);

  const [isPlacingSignature, setIsPlacingSignature] = useState(false);
  const [placementPage, setPlacementPage] = useState<'last' | 'first' | 'number'>('last');
  const [placementPageNumber, setPlacementPageNumber] = useState<number>(1);
  const [posX, setPosX] = useState(80);
  const [posY, setPosY] = useState(85);
  const [activeTool, setActiveTool] = useState<'select' | 'comment' | 'draw' | 'highlight' | 'text' | 'signature'>('signature');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  useEffect(() => {
    if (isOpen) {
      setAnnotations([]);
      setActiveTool('signature');
      if (isPDF && canSign) {
        setIsPlacingSignature(true);
      } else {
        setIsPlacingSignature(false);
      }
    } else {
      setIsPlacingSignature(false);
    }
  }, [isOpen, isPDF, canSign]);

  const handleSignClick = () => {
    setIsPlacingSignature(true);
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pdfDocObj, setPdfDocObj] = useState<any>(null);
  const [pdfTotalPages, setPdfTotalPages] = useState<number | null>(null);
  const [pdfPageLoading, setPdfPageLoading] = useState(false);

  // Load PDF.js document when open
  useEffect(() => {
    if (isOpen && isPDF && fileUrl) {
      let active = true;
      setPdfPageLoading(true);
      setPdfDocObj(null);
      setPdfTotalPages(null);

      const loadPdf = async () => {
        try {
          if (!(window as any).pdfjsLib) {
            await new Promise<void>((resolve, reject) => {
              const script = document.createElement('script');
              script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
              script.onload = () => {
                (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
                resolve();
              };
              script.onerror = reject;
              document.body.appendChild(script);
            });
          }

          const pdfjsLib = (window as any).pdfjsLib;
          if (!active) return;

          const loadingTask = pdfjsLib.getDocument(fileUrl);
          const pdf = await loadingTask.promise;
          if (active) {
            setPdfDocObj(pdf);
            setPdfTotalPages(pdf.numPages);
            // Default placement to last page
            setPlacementPageNumber(pdf.numPages);
          }
        } catch (err) {
          console.error('Error loading PDF document:', err);
        } finally {
          if (active) {
            setPdfPageLoading(false);
          }
        }
      };

      loadPdf();

      return () => {
        active = false;
      };
    }
  }, [isOpen, isPDF, fileUrl]);

  // Format File Size
  const formatSize = (bytes: number | null) => {
    if (bytes === null || bytes === undefined) return 'N/A';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Load Excel Spreadsheet Data
  useEffect(() => {
    if (isOpen && isExcel && fileUrl) {
      setLoading(true);
      setError(null);
      fetch(fileUrl)
        .then((res) => {
          if (!res.ok) throw new Error('Error al descargar el archivo Excel');
          return res.arrayBuffer();
        })
        .then((ab) => {
          const wb = XLSX.read(ab, { type: 'array' });
          setExcelSheets(wb.SheetNames);
          if (wb.SheetNames.length > 0) {
            const firstSheet = wb.SheetNames[0];
            setCurrentSheet(firstSheet);
            const sheet = wb.Sheets[firstSheet];
            const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
            setExcelData(data);
          }
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setError('No se pudo cargar la vista previa de Excel. Por favor descarga el archivo.');
          setLoading(false);
        });
    }
  }, [isOpen, isExcel, fileUrl]);

  // Handle Excel Sheet change
  const handleSheetChange = (sheetName: string) => {
    setCurrentSheet(sheetName);
    setLoading(true);
    fetch(fileUrl)
      .then((res) => res.arrayBuffer())
      .then((ab) => {
        const wb = XLSX.read(ab, { type: 'array' });
        const sheet = wb.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        setExcelData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 transition-all duration-300">
      <div className={`bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 border border-slate-200/80 ${
        isFullscreen ? 'w-full h-full p-2' : 'w-full max-w-5xl h-[85vh]'
      }`}>
        
        {/* Preview Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isPDF ? 'bg-red-50 text-red-500' :
              isExcel ? 'bg-emerald-50 text-emerald-600' :
              isWord ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'
            }`}>
              {isExcel ? <FileSpreadsheet className="w-4.5 h-4.5" /> : <FileText className="w-4.5 h-4.5" />}
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-sm max-w-[250px] md:max-w-md truncate" title={fileName}>
                {fileName}
              </h2>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
                  {isPDF ? 'PDF Document' : isExcel ? 'Excel Spreadsheet' : isWord ? 'Word Document' : 'Archivo'} • {formatSize(fileSize)}
                </p>
                {(creator || verifier1 || verifier2 || verifier3) && (
                  <span className="text-[10px] text-slate-300 select-none">•</span>
                )}
                {creator && (
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[9px] font-bold border border-slate-200">
                    Creador: {creator}
                  </span>
                )}
                {verifier1 && (
                  <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[9px] font-bold border border-blue-100">
                    Verif 1: {verifier1}
                  </span>
                )}
                {verifier2 && (
                  <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 text-[9px] font-bold border border-purple-100">
                    Verif 2: {verifier2}
                  </span>
                )}
                {verifier3 && (
                  <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 text-[9px] font-bold border border-indigo-100">
                    Verif 3: {verifier3}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isPDF && (
              <button
                onClick={() => setIsPlacingSignature(!isPlacingSignature)}
                className={clsx(
                  "mr-2 px-3 py-1.5 rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 active:scale-95",
                  isPlacingSignature 
                    ? "bg-blue-50 text-blue-600 hover:bg-blue-100" 
                    : "bg-slate-200/80 hover:bg-slate-300/80 text-slate-700"
                )}
                title={isPlacingSignature ? "Ocultar panel de herramientas" : "Mostrar panel de herramientas"}
              >
                <Pencil className="w-4 h-4" />
                <span>{isPlacingSignature ? "Ocultar Herramientas" : "Anotar / Firmar"}</span>
              </button>
            )}

            {canSign && onVerify && !isPlacingSignature && (
              <button
                onClick={handleSignClick}
                className="mr-2 px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 active:scale-95 animate-pulse"
                title="Firmar / Verificar este documento"
              >
                <FileCheck className="w-4 h-4" />
                <span>Firmar Documento</span>
              </button>
            )}

            {hasUserSigned && onRemoveVerify && (
              <button
                onClick={onRemoveVerify}
                className="mr-2 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 active:scale-95"
                title="Remover mi firma de este documento"
              >
                <X className="w-4 h-4" />
                <span>Remover mi Firma</span>
              </button>
            )}

            {canTrash && onTrash && (
              <button
                onClick={onTrash}
                className="p-2 rounded-xl text-rose-500 hover:text-red-600 hover:bg-rose-50 transition-colors"
                title="Mover a la papelera"
              >
                <Trash2 className="w-4.5 h-4.5" />
              </button>
            )}

            {/* Download file button */}
            <a
              href={fileUrl}
              download={fileName}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
              title="Descargar archivo"
            >
              <Download className="w-4.5 h-4.5" />
            </a>

            {/* Fullscreen toggle button */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
              title={isFullscreen ? "Minimizar" : "Pantalla completa"}
            >
              {isFullscreen ? <Minimize2 className="w-4.5 h-4.5" /> : <Maximize2 className="w-4.5 h-4.5" />}
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Cerrar"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* Preview Area Body */}
        <div className="flex-1 bg-slate-100 overflow-hidden flex">
          
          {/* Signature Mode Sidebar */}
          {isPlacingSignature && (
            <div className="w-80 border-r border-slate-200 bg-white flex shrink-0 animate-in slide-in-from-left duration-200">
              
              {/* Left Toolbar Column (Narrow) */}
              <div className="w-14 border-r border-slate-200 bg-slate-50/80 flex flex-col items-center py-4 justify-between">
                <div className="flex flex-col gap-3.5 items-center w-full">
                  {/* Selector tool */}
                  <button 
                    type="button" 
                    onClick={() => setActiveTool('select')}
                    className={clsx("p-2 rounded-xl transition-all active:scale-95", activeTool === 'select' ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "text-slate-400 hover:bg-slate-200/60 hover:text-slate-700")}
                    title="Seleccionar"
                  >
                    <MousePointer2 className="w-5 h-5" />
                  </button>
                  {/* Notes / Annotation tool */}
                  <button 
                    type="button" 
                    onClick={() => setActiveTool('comment')}
                    className={clsx("p-2 rounded-xl transition-all active:scale-95", activeTool === 'comment' ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "text-slate-400 hover:bg-slate-200/60 hover:text-slate-700")}
                    title="Anotación"
                  >
                    <MessageSquareMore className="w-5 h-5" />
                  </button>
                  {/* Pen / Draw tool */}
                  <button 
                    type="button" 
                    onClick={() => setActiveTool('draw')}
                    className={clsx("p-2 rounded-xl transition-all active:scale-95", activeTool === 'draw' ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "text-slate-400 hover:bg-slate-200/60 hover:text-slate-700")}
                    title="Dibujar"
                  >
                    <Pencil className="w-5 h-5" />
                  </button>
                  {/* Highlighter tool */}
                  <button 
                    type="button" 
                    onClick={() => setActiveTool('highlight')}
                    className={clsx("p-2 rounded-xl transition-all active:scale-95", activeTool === 'highlight' ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "text-slate-400 hover:bg-slate-200/60 hover:text-slate-700")}
                    title="Resaltar"
                  >
                    <Highlighter className="w-5 h-5" />
                  </button>
                  {/* Text tool */}
                  <button 
                    type="button" 
                    onClick={() => setActiveTool('text')}
                    className={clsx("p-2 rounded-xl transition-all active:scale-95", activeTool === 'text' ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "text-slate-400 hover:bg-slate-200/60 hover:text-slate-700")}
                    title="Texto"
                  >
                    <Type className="w-5 h-5" />
                  </button>
                  {/* Signature tool (Active highlighted in blue, matching screenshot) */}
                  <button 
                    type="button" 
                    onClick={() => setActiveTool('signature')}
                    className={clsx("p-2 rounded-xl transition-all active:scale-95", activeTool === 'signature' ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "text-slate-400 hover:bg-slate-200/60 hover:text-slate-700")}
                    title="Firmas"
                  >
                    <FileCheck className="w-5 h-5" />
                  </button>
                </div>
                
                {/* Cancel tool at the bottom */}
                <button 
                  type="button"
                  onClick={() => setIsPlacingSignature(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all active:scale-95"
                  title="Cancelar Firma"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Right Panel Content */}
              <div className="flex-1 flex flex-col justify-between overflow-hidden">
                <div className="p-5 flex-1 overflow-auto">
                  <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <span>Panel de Firmas y Anotaciones</span>
                  </h3>
                  
                  <p className="text-[11px] text-slate-400 mb-6 leading-relaxed font-medium">
                    {isPDF 
                      ? "Usa la barra izquierda para dibujar, resaltar, escribir o colocar notas adhesivas. Para colocar la firma, selecciónala en la barra y arrástrala al documento." 
                      : "Tu firma se posicionará de forma automática sobre tu nombre en el documento de Word."}
                  </p>

                  <div className="space-y-4">
                    {/* List of signatures, matching the user's screenshot layout */}
                    {/* List of signatures, matching the user's screenshot layout */}
                    {activeTool === 'signature' && (
                      <div className="space-y-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mis Firmas Guardadas</span>
                        
                        {!canSign ? (
                          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-center">
                            <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                              La firma de documentos está deshabilitada en el modo vista.
                            </p>
                          </div>
                        ) : !currentUserSignature ? (
                          <div className="border border-amber-200 bg-amber-50/50 rounded-xl p-3 text-center">
                            <p className="text-[10px] text-amber-800 font-semibold leading-relaxed">
                              No has configurado tu firma digital en tu perfil. Puedes usar las anotaciones y textos, pero para firmar físicamente debes subir tu firma haciendo clic en tus iniciales arriba a la derecha.
                            </p>
                          </div>
                        ) : (
                          <>
                            {/* Signature Box 1 */}
                            <div 
                              draggable="true"
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/plain", "signature");
                              }}
                              className="border-2 border-blue-500 rounded-xl p-3 bg-white relative group transition-all shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-600 hover:shadow-md"
                            >
                              <div className="h-16 flex items-center justify-center overflow-hidden pointer-events-none">
                                <img src={currentUserSignature} alt="Firma Principal" className="max-h-full max-w-full object-contain mix-blend-multiply" />
                              </div>
                              <button 
                                type="button"
                                className="absolute top-2 right-2 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                title="Eliminar firma"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                              <div className="border-t border-slate-100 mt-2.5 pt-2 text-center flex items-center justify-between pointer-events-none">
                                <span className="text-[10px] font-bold text-slate-500 block truncate max-w-[130px] text-left">{currentUserName}</span>
                                <span className="text-[8px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase">Principal</span>
                              </div>
                            </div>

                            {/* Signature Box 2 */}
                            <div 
                              draggable="true"
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/plain", "signature");
                              }}
                              className="border border-slate-200/80 hover:border-blue-400 rounded-xl p-3 bg-white relative group transition-all shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md"
                            >
                              <div className="h-16 flex items-center justify-center overflow-hidden opacity-75 pointer-events-none">
                                <img src={currentUserSignature} alt="Firma Alternativa" className="max-h-full max-w-full object-contain mix-blend-multiply scale-90" />
                              </div>
                              <button 
                                type="button"
                                className="absolute top-2 right-2 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                title="Eliminar firma"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                              <div className="border-t border-slate-100 mt-2.5 pt-2 text-center flex items-center justify-between pointer-events-none">
                                <span className="text-[10px] font-bold text-slate-400 block truncate max-w-[130px] text-left">Iniciales / Media</span>
                                <span className="text-[8px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded uppercase">Alternativa</span>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {isPDF && (
                      <>
                        {!canSign && (
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-slate-500 text-[10px] leading-relaxed">
                            <span className="font-bold text-slate-700 block mb-1">Modo Vista de Lectura</span>
                            No tienes permisos para firmar o modificar este archivo (eres el creador o ya has firmado). Puedes realizar anotaciones y dibujos temporales en pantalla, pero no se guardarán en el servidor.
                          </div>
                        )}

                        {/* Presets */}
                        {canSign && activeTool === 'signature' && (
                          <div className="pt-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Posición Rápida</span>
                            <div className="grid grid-cols-3 gap-1.5">
                              <button 
                                type="button"
                                onClick={() => { setPosX(15); setPosY(82); }}
                                className="px-2 py-1.5 rounded-lg border border-slate-200 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
                              >
                                Izq.
                              </button>
                              <button 
                                type="button"
                                onClick={() => { setPosX(45); setPosY(82); }}
                                className="px-2 py-1.5 rounded-lg border border-slate-200 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
                              >
                                Centro
                              </button>
                              <button 
                                type="button"
                                onClick={() => { setPosX(75); setPosY(82); }}
                                className="px-2 py-1.5 rounded-lg border border-brand-200 bg-brand-50/20 text-[10px] font-semibold text-brand-700 hover:bg-brand-50 active:scale-95 transition-all"
                              >
                                Der.
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Coordinates display */}
                        {canSign && activeTool === 'signature' && (
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[10px] font-semibold text-slate-500 space-y-1">
                            <div>Ubicación de firma:</div>
                            <div className="font-mono text-slate-700">Pág: {placementPage === 'number' ? placementPageNumber : (placementPage === 'first' ? 1 : (pdfTotalPages || 1))}</div>
                            <div className="font-mono text-slate-700">Coord X: {posX}%</div>
                            <div className="font-mono text-slate-700">Coord Y: {100 - posY}%</div>
                          </div>
                        )}

                        {/* Annotations List */}
                        {annotations.length > 0 && (
                          <div className="pt-4 border-t border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Anotaciones y Notas</span>
                            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                              {annotations.map((ann) => (
                                <div key={ann.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-100 text-[10px] text-slate-600">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="font-bold text-slate-500">
                                      {ann.type === 'draw' ? '✍️' :
                                       ann.type === 'highlight' ? '🟡' :
                                       ann.type === 'text' ? '📝' : '💬'}
                                    </span>
                                    <span className="truncate max-w-[140px]" title={ann.text || ''}>
                                      {ann.type === 'text' || ann.type === 'comment' ? ann.text : `Dibujo (Pág. ${ann.pageNumber})`}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setAnnotations(prev => prev.filter(a => a.id !== ann.id))}
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                                    title="Eliminar anotación"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Sidebar Actions */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-2">
                  {canSign && (
                    <button 
                      type="button"
                      onClick={() => {
                        if (activeTool === 'signature' && !currentUserSignature) {
                          alert("No puedes colocar una firma física porque no has configurado tu firma en tu perfil. Por favor, configúrala primero.");
                          return;
                        }
                        setIsPlacingSignature(false);
                        if (onVerify) {
                          if (isPDF) {
                            onVerify(
                              activeTool === 'signature' 
                                ? {
                                    page: placementPage,
                                    pageNumber: placementPage === 'number' ? placementPageNumber : undefined,
                                    x: posX,
                                    y: 100 - posY
                                  } 
                                : undefined,
                              annotations
                            );
                          } else {
                            onVerify();
                          }
                        }
                      }}
                      className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-95"
                    >
                      {activeTool === 'signature' ? "Confirmar Firma" : "Confirmar Cambios"}
                    </button>
                  )}
                  <button 
                    type="button"
                    onClick={() => setIsPlacingSignature(false)}
                    className={clsx(
                      "w-full py-2.5 rounded-xl font-bold transition-all active:scale-95 text-xs",
                      canSign 
                        ? "border border-slate-200 bg-white hover:bg-slate-50 text-slate-500" 
                        : "bg-slate-800 hover:bg-slate-900 text-white shadow-md"
                    )}
                  >
                    {canSign ? "Cancelar" : "Cerrar Panel"}
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* Right Pane document content view */}
          <div className="flex-1 overflow-auto flex flex-col relative bg-slate-100">
            
            {/* PDF Previewer */}
            {isPDF && (
              <div className="w-full h-full flex flex-col bg-slate-200/50 p-4 overflow-auto">
                {pdfPageLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3">
                    <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm font-medium text-slate-500">Cargando PDF...</span>
                  </div>
                ) : pdfDocObj ? (
                  <div className="space-y-4">
                    {Array.from({ length: pdfTotalPages || 0 }, (_, idx) => (
                      <PdfPage
                        key={idx}
                        pdfDoc={pdfDocObj}
                        pageNum={idx + 1}
                        isPlacing={isPlacingSignature}
                        activeTool={activeTool}
                        annotations={annotations}
                        onAddAnnotation={(ann) => setAnnotations(prev => [...prev, ann])}
                        placedPage={placementPage === 'number' ? placementPageNumber : (placementPage === 'first' ? 1 : (pdfTotalPages || 1))}
                        placedX={posX}
                        placedY={posY}
                        onPlace={(x, y) => {
                          setPlacementPage('number');
                          setPlacementPageNumber(idx + 1);
                          setPosX(x);
                          setPosY(y);
                        }}
                        signatureUrl={currentUserSignature}
                        canSign={canSign}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="w-full h-full">
                    <iframe
                      src={`${fileUrl}#toolbar=0`}
                      className="w-full h-full border-none bg-slate-500"
                      title={fileName}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Image Previewer */}
            {isImage && (
              <div className="w-full h-full flex items-center justify-center p-8 bg-slate-900/5">
                <img
                  src={fileUrl}
                  alt={fileName}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-md"
                />
              </div>
            )}

            {/* Excel spreadsheet previewer using SheetJS */}
            {isExcel && (
              <div className="w-full h-full flex flex-col bg-white">
                {loading ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3">
                    <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm font-medium text-slate-500">Cargando celdas de Excel...</span>
                  </div>
                ) : error ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
                    <AlertTriangle className="w-12 h-12 text-amber-500" />
                    <h3 className="font-semibold text-slate-700">{error}</h3>
                  </div>
                ) : (
                  <>
                    {/* Sheet Tabs */}
                    {excelSheets.length > 1 && (
                      <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 p-2 overflow-x-auto">
                        {excelSheets.map((sheet) => (
                          <button
                            key={sheet}
                            onClick={() => handleSheetChange(sheet)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                              currentSheet === sheet
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                            }`}
                          >
                            {sheet}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Grid Table Container */}
                    <div className="flex-1 overflow-auto p-4 bg-slate-50">
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-100/80 text-slate-500 font-semibold border-b border-slate-200">
                              <th className="p-2 border-r border-slate-200 text-center w-10">#</th>
                              {excelData[0]?.map((_, colIndex) => (
                                <th key={colIndex} className="p-2 border-r border-slate-200 font-semibold text-center uppercase tracking-wider">
                                  {String.fromCharCode(65 + (colIndex % 26))}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {excelData.map((row, rowIndex) => (
                              <tr key={rowIndex} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                <td className="p-2 bg-slate-50 font-bold border-r border-slate-200 text-center text-slate-400 select-none">
                                  {rowIndex + 1}
                                </td>
                                {row.map((cell, colIndex) => (
                                  <td 
                                    key={colIndex} 
                                    className="p-2 border-r border-slate-200 text-slate-700 whitespace-nowrap overflow-hidden max-w-[150px] truncate"
                                    title={cell !== null && cell !== undefined ? String(cell) : ''}
                                  >
                                    {cell !== null && cell !== undefined ? String(cell) : ''}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Word document previewer (Beautiful simulated visual document reader) */}
            {isWord && (
              <div className="w-full h-full flex flex-col items-center p-6 md:p-12 overflow-auto bg-slate-200/50">
                <div className="w-full max-w-3xl aspect-[1/1.4] bg-white rounded-xl shadow-lg border border-slate-200/80 p-12 md:p-16 flex flex-col relative select-none">
                  
                  {/* Visual Header Mock */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-8">
                    <div className="flex items-center gap-2 text-brand-600 text-xs font-semibold">
                      <FileCheck className="w-4 h-4" />
                      <span>Documento Verificado por Asepsis</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">Pág. 1 de 1</span>
                  </div>

                  {/* Main Visual Representation */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      {/* Document Title */}
                      <h1 className="text-2xl font-bold text-slate-800 mb-6 leading-tight select-all">
                        {fileName.replace(/\.docx?$/, '')}
                      </h1>

                      {/* Simulated Text Lines representing document structure */}
                      <div className="space-y-4">
                        <div className="h-4 bg-slate-100 rounded-md w-11/12" />
                        <div className="h-4 bg-slate-100 rounded-md w-full" />
                        <div className="h-4 bg-slate-100 rounded-md w-10/12" />
                        <div className="h-4 bg-slate-100 rounded-md w-full" />
                        
                        <div className="pt-4 space-y-4">
                          <div className="h-4 bg-slate-100 rounded-md w-9/12" />
                          <div className="h-4 bg-slate-100 rounded-md w-11/12" />
                          <div className="h-4 bg-slate-100 rounded-md w-full" />
                        </div>

                        <div className="pt-4 space-y-4">
                          <div className="h-4 bg-slate-100 rounded-md w-10/12" />
                          <div className="h-4 bg-slate-100 rounded-md w-8/12" />
                        </div>
                      </div>
                    </div>

                    {/* Summary/Metadata panel inside paper */}
                    <div className="bg-slate-50 rounded-2xl border border-slate-100 p-6 mt-8 flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-700">Previsualización Segura del Archivo</h4>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Para ver o editar el formato original completo del documento, descárgalo.
                          </p>
                        </div>
                      </div>
                      <a
                        href={fileUrl}
                        download={fileName}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm hover:shadow transition-all flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Descargar Word</span>
                      </a>
                    </div>
                  </div>

                  {/* Stamp watermark */}
                  <div className="absolute right-12 bottom-12 opacity-5 pointer-events-none select-none">
                    <Eye className="w-36 h-36" />
                  </div>
                </div>
              </div>
            )}

            {/* Fallback Previewer for unknown extensions */}
            {!isPDF && !isImage && !isExcel && !isWord && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50">
                <div className="w-16 h-16 rounded-2xl bg-slate-200/80 flex items-center justify-center text-slate-400 mb-4 shadow-inner">
                  <FileText className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-slate-700 text-base">{fileName}</h3>
                <p className="text-xs text-slate-400 max-w-sm text-center mt-1">
                  La vista previa para este tipo de archivo no está disponible de forma integrada. Puedes descargarlo directamente en tu ordenador.
                </p>
                <a
                  href={fileUrl}
                  download={fileName}
                  className="mt-6 px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold shadow-md hover:shadow-lg transition-all flex items-center gap-2 active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Archivo</span>
                </a>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
