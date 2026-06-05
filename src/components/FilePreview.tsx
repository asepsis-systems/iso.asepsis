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
  FileCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';

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
  canSign?: boolean;
  onVerify?: () => void;
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
  canSign = false,
  onVerify
}: FilePreviewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [excelSheets, setExcelSheets] = useState<string[]>([]);
  const [currentSheet, setCurrentSheet] = useState<string>('');
  const [excelData, setExcelData] = useState<any[][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
  const isPDF = mimeType === 'application/pdf' || fileExtension === 'pdf';
  const isImage = mimeType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(fileExtension);
  const isExcel = mimeType.includes('spreadsheet') || mimeType.includes('excel') || ['xlsx', 'xls', 'csv'].includes(fileExtension);
  const isWord = mimeType.includes('word') || ['docx', 'doc'].includes(fileExtension);
  
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
            {canSign && onVerify && (
              <button
                onClick={onVerify}
                className="mr-2 px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 active:scale-95 animate-pulse"
                title="Firmar / Verificar este documento"
              >
                <FileCheck className="w-4 h-4" />
                <span>Firmar Documento</span>
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
        <div className="flex-1 bg-slate-100 overflow-auto flex flex-col">
          
          {/* PDF Previewer */}
          {isPDF && (
            <div className="w-full h-full">
              <iframe
                src={`${fileUrl}#toolbar=0`}
                className="w-full h-full border-none bg-slate-500"
                title={fileName}
              />
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
  );
}
