import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ISO-ASEPSIS - Gestión de Archivos Inteligente',
  description: 'Un panel de control premium para organizar, previsualizar y gestionar tus documentos, hojas de cálculo y PDFs.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full">
      <body className="h-full overflow-hidden">
        {children}
      </body>
    </html>
  );
}
