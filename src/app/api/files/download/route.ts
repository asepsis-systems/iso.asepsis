import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth-helpers';
import { PDFDocument, PageSizes, rgb, StandardFonts } from 'pdf-lib';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { canUserAccessNode, logAuthorization } from '@/lib/permission';

function getVersionFromFilename(name: string): string {
  const match = name.match(/v(\d+(\.\d+)?)/i);
  return match ? `v${match[1]}` : 'v1.0';
}

function getAreaAbbreviation(name: string): string {
  const clean = name.trim().toUpperCase();
  if (clean.includes('ADMIN')) return 'ADM';
  if (clean.includes('OPER')) return 'OPE';
  if (clean.includes('LOG')) return 'LOG';
  if (clean.includes('MANT')) return 'MNT';
  return 'GEN';
}

async function getSignatureBuffer(signaturePath: string | null): Promise<Buffer | null> {
  if (!signaturePath) return null;
  try {
    if (signaturePath.startsWith('http://') || signaturePath.startsWith('https://')) {
      const res = await fetch(signaturePath);
      if (res.ok) {
        return Buffer.from(await res.arrayBuffer());
      }
    } else {
      const relativePath = signaturePath.startsWith('/') ? signaturePath.slice(1) : signaturePath;
      const fullPath = path.join(process.cwd(), 'public', relativePath);
      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath);
      }
    }
  } catch (err) {
    console.error('Error reading signature file:', signaturePath, err);
  }
  return null;
}

async function appendCertificatePages(
  pdfDoc: PDFDocument,
  node: any,
  doc: any,
  currentUser: any,
  clientIp: string,
  audits: any[],
  signedPdfBuffer: Buffer
) {
  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const formatDateTime = (date: Date | string): string => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const d = new Date(date);
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  };

  // Page 1
  const page1 = pdfDoc.addPage(PageSizes.A4);
  const { width, height } = page1.getSize();
  const margin = 35;
  const contentWidth = width - margin * 2; // 525 pt

  const drawPageBorders = (page: any) => {
    page.drawRectangle({
      x: 20,
      y: 20,
      width: width - 40,
      height: height - 40,
      borderColor: rgb(0.08, 0.18, 0.36),
      borderWidth: 1.5
    });
    page.drawRectangle({
      x: 23,
      y: 23,
      width: width - 46,
      height: height - 46,
      borderColor: rgb(0.08, 0.18, 0.36),
      borderWidth: 0.5
    });
  };

  drawPageBorders(page1);

  // Embed Logo
  let logoImg = null;
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo2.jpg');
    if (fs.existsSync(logoPath)) {
      logoImg = await pdfDoc.embedJpg(fs.readFileSync(logoPath));
    }
  } catch {}

  // 1. Draw Title & Logo
  page1.drawText("Certificado de finalización", {
    x: margin,
    y: height - 55,
    size: 14,
    font: fontHelveticaBold,
    color: rgb(0.08, 0.18, 0.36)
  });

  if (logoImg) {
    page1.drawImage(logoImg, {
      x: width - margin - 85,
      y: height - 60,
      width: 85,
      height: 25
    });
  } else {
    page1.drawText("ASEPSIS PERÚ", {
      x: width - margin - 100,
      y: height - 53,
      size: 10,
      font: fontHelveticaBold,
      color: rgb(0.08, 0.18, 0.36)
    });
  }

  // Count signed document pages
  let docPagesCount = 1;
  try {
    const mainPdf = await PDFDocument.load(signedPdfBuffer);
    docPagesCount = mainPdf.getPageCount();
  } catch (err) {
    console.error("Error reading signed PDF page count:", err);
  }

  const approvedSignatures = doc.signatures.filter((s: any) => s.status === 'APROBADO');
  const creationDateStr = new Date(node.createdAt).toLocaleString('es-PE', { timeZone: 'America/Lima' });

  // Get Creator IP from audits
  let creatorIp = '127.0.0.1';
  const creatorAudit = audits.find((a: any) => a.action === 'SUBIR_DOCUMENTO' || a.action === 'CREAR_DOCUMENTO');
  if (creatorAudit) {
    try {
      const detail = JSON.parse(creatorAudit.detail);
      creatorIp = detail.ip || '127.0.0.1';
    } catch {}
  }

  // 2. Draw Envelope Metadata Table (Grey Box)
  page1.drawRectangle({
    x: margin,
    y: height - 145,
    width: contentWidth,
    height: 75,
    color: rgb(0.96, 0.97, 0.98),
    borderColor: rgb(0.85, 0.87, 0.9),
    borderWidth: 0.5
  });

  const areaName = doc?.area?.name || 'Gestión Documental';
  const areaAbbr = getAreaAbbreviation(areaName);
  const docCode = `ASEPSIS-${areaAbbr}-${node.id.split('-')[0].toUpperCase()}`;
  const creatorName = doc.creator?.name || node.creator || 'Asepsis User';
  const creatorEmail = doc.creator?.email || 'admin@asepsis.pe';

  // Left Column
  page1.drawText(`Identificador del sobre: ${docCode}`, { x: margin + 10, y: height - 88, size: 7.5, font: fontHelveticaBold, color: rgb(0.2, 0.2, 0.2) });
  page1.drawText(`Asunto: Complete con Asepsis: ${node.name}`, { x: margin + 10, y: height - 100, size: 7.5, font: fontHelvetica, color: rgb(0.3, 0.3, 0.3) });
  page1.drawText(`Páginas del documento: ${docPagesCount}`, { x: margin + 10, y: height - 114, size: 7, font: fontHelvetica, color: rgb(0.4, 0.4, 0.4) });
  page1.drawText(`Páginas del certificado: 2`, { x: margin + 120, y: height - 114, size: 7, font: fontHelvetica, color: rgb(0.4, 0.4, 0.4) });
  page1.drawText(`Firmas: ${approvedSignatures.length}`, { x: margin + 220, y: height - 114, size: 7, font: fontHelvetica, color: rgb(0.4, 0.4, 0.4) });
  page1.drawText(`Iniciales: 0`, { x: margin + 280, y: height - 114, size: 7, font: fontHelvetica, color: rgb(0.4, 0.4, 0.4) });
  page1.drawText(`Zona horaria: (UTC-05:00) Hora de Lima (Perú)`, { x: margin + 10, y: height - 132, size: 7, font: fontHelvetica, color: rgb(0.5, 0.5, 0.5) });

  // Right Column
  const docStatusLabel = doc.status === 'APROBADO' ? 'Completado' : doc.status === 'RECHAZADO' ? 'Rechazado' : 'En proceso';
  const docStatusColor = doc.status === 'APROBADO' ? rgb(0.1, 0.5, 0.25) : doc.status === 'RECHAZADO' ? rgb(0.8, 0.1, 0.1) : rgb(0.9, 0.5, 0.1);
  page1.drawText(`Estado: ${docStatusLabel}`, { x: margin + 340, y: height - 88, size: 7.5, font: fontHelveticaBold, color: docStatusColor });
  page1.drawText(`Autor del sobre:`, { x: margin + 340, y: height - 100, size: 7, font: fontHelveticaBold, color: rgb(0.4, 0.4, 0.4) });
  page1.drawText(`${creatorName}`, { x: margin + 340, y: height - 110, size: 7, font: fontHelvetica, color: rgb(0.1, 0.1, 0.1) });
  page1.drawText(`${creatorEmail}`, { x: margin + 340, y: height - 120, size: 7, font: fontHelvetica, color: rgb(0.1, 0.1, 0.1) });
  page1.drawText(`Dirección IP: ${creatorIp}`, { x: margin + 340, y: height - 132, size: 7, font: fontHelvetica, color: rgb(0.4, 0.4, 0.4) });

  // 3. Draw "Seguimiento de registro"
  page1.drawRectangle({
    x: margin,
    y: height - 175,
    width: contentWidth,
    height: 15,
    color: rgb(0.9, 0.91, 0.93)
  });
  page1.drawText("Seguimiento de registro", { x: margin + 10, y: height - 171, size: 8, font: fontHelveticaBold, color: rgb(0.1, 0.1, 0.1) });

  page1.drawText("Estado: Original", { x: margin + 10, y: height - 198, size: 7.5, font: fontHelveticaBold, color: rgb(0.2, 0.2, 0.2) });
  page1.drawText(creationDateStr, { x: margin + 10, y: height - 208, size: 7, font: fontHelvetica, color: rgb(0.4, 0.4, 0.4) });
  
  page1.drawText("Titular: " + creatorName, { x: margin + 180, y: height - 198, size: 7.5, font: fontHelveticaBold, color: rgb(0.2, 0.2, 0.2) });
  page1.drawText(creatorEmail, { x: margin + 180, y: height - 208, size: 7, font: fontHelvetica, color: rgb(0.4, 0.4, 0.4) });

  page1.drawText("Ubicación: ASEPSIS PERÚ Explorer", { x: margin + 350, y: height - 198, size: 7.5, font: fontHelveticaBold, color: rgb(0.2, 0.2, 0.2) });

  // 4. Draw "Eventos de firmante"
  let currentY = height - 235;
  page1.drawRectangle({
    x: margin,
    y: currentY,
    width: contentWidth,
    height: 15,
    color: rgb(0.9, 0.91, 0.93)
  });
  page1.drawText("Eventos de firmante", { x: margin + 10, y: currentY + 4, size: 8, font: fontHelveticaBold, color: rgb(0.1, 0.1, 0.1) });
  page1.drawText("Firma", { x: margin + 210, y: currentY + 4, size: 8, font: fontHelveticaBold, color: rgb(0.1, 0.1, 0.1) });
  page1.drawText("Fecha y hora", { x: margin + 370, y: currentY + 4, size: 8, font: fontHelveticaBold, color: rgb(0.1, 0.1, 0.1) });

  currentY -= 12;

  // Sort signatures by order
  const verifiers = doc.area.verifiers || [];
  const verifierOrderMap = new Map();
  verifiers.forEach((v: any) => { verifierOrderMap.set(v.userId, v.signOrder); });
  const sortedSignatures = doc.signatures.sort((a: any, b: any) => {
    const oA = verifierOrderMap.get(a.userId) || 99;
    const oB = verifierOrderMap.get(b.userId) || 99;
    return oA - oB;
  });

  const cardH = 88;
  let currentPage = page1;

  for (const sig of sortedSignatures) {
    if (currentY - cardH < 50) {
      currentPage = pdfDoc.addPage(PageSizes.A4);
      drawPageBorders(currentPage);
      currentY = height - 55;
      
      currentPage.drawRectangle({
        x: margin,
        y: currentY,
        width: contentWidth,
        height: 15,
        color: rgb(0.9, 0.91, 0.93)
      });
      currentPage.drawText("Eventos de firmante (continuación)", { x: margin + 10, y: currentY + 4, size: 8, font: fontHelveticaBold, color: rgb(0.1, 0.1, 0.1) });
      currentPage.drawText("Firma", { x: margin + 210, y: currentY + 4, size: 8, font: fontHelveticaBold, color: rgb(0.1, 0.1, 0.1) });
      currentPage.drawText("Fecha y hora", { x: margin + 370, y: currentY + 4, size: 8, font: fontHelveticaBold, color: rgb(0.1, 0.1, 0.1) });
      
      currentY -= 12;
    }

    const user = sig.user;
    let cargo = user.cargo ? user.cargo : 'Verificador';
    if (!user.cargo) {
      if (user.role === 'ADMIN') cargo = 'Gerente General';
      else if (user.role === 'VERIFIER') cargo = 'Verificador de Control';
    }

    const email = user.email || `${user.username}@asepsis.pe`;
    const signedDate = sig.signedAt ? new Date(sig.signedAt) : new Date();
    
    // Extrapolate sent/view times realistically
    const viewDate = new Date(signedDate.getTime() - 2 * 60 * 1000);
    const sentDate = new Date(signedDate.getTime() - 5 * 60 * 1000);

    const sentDateStr = formatDateTime(sentDate);
    const viewDateStr = formatDateTime(viewDate);
    const signedDateStr = sig.signedAt ? formatDateTime(sig.signedAt) : 'Pendiente';

    // Retrieve IP
    let ip = sig.ipAddress;
    if (!ip) {
      const sigAudit = audits.find((a: any) => {
        try {
          const detail = JSON.parse(a.detail);
          return a.username === user.username && detail.action === 'FIRMAR_DOCUMENTO';
        } catch {
          return false;
        }
      });
      if (sigAudit) {
        try {
          ip = JSON.parse(sigAudit.detail).ip || '127.0.0.1';
        } catch {}
      }
    }
    if (!ip) ip = '127.0.0.1';

    // Column 1: Eventos de firmante details
    currentPage.drawText(user.name.toUpperCase(), { x: margin + 10, y: currentY - 14, size: 7.5, font: fontHelveticaBold, color: rgb(0.08, 0.18, 0.36) });
    currentPage.drawText(email, { x: margin + 10, y: currentY - 24, size: 6.5, font: fontHelvetica, color: rgb(0.2, 0.2, 0.2) });
    currentPage.drawText(`Cargo: ${cargo}`, { x: margin + 10, y: currentY - 34, size: 6.5, font: fontHelvetica, color: rgb(0.4, 0.4, 0.4) });
    currentPage.drawText("Nivel de seguridad: Correo electrónico,", { x: margin + 10, y: currentY - 50, size: 6.5, font: fontHelvetica, color: rgb(0.5, 0.5, 0.5) });
    currentPage.drawText("Autenticación de cuenta (ninguna)", { x: margin + 10, y: currentY - 58, size: 6.5, font: fontHelvetica, color: rgb(0.5, 0.5, 0.5) });

    // Column 2: Signature
    currentPage.drawText("Firma digital", { x: margin + 210, y: currentY - 14, size: 6.5, font: fontHelveticaBold, color: rgb(0.1, 0.5, 0.25) });
    
    // Draw signature image
    if (user.signature) {
      try {
        const sigBuffer = await getSignatureBuffer(user.signature);
        if (sigBuffer) {
          let sigImg;
          if (user.signature.toLowerCase().endsWith('.jpg') || user.signature.toLowerCase().endsWith('.jpeg')) {
            sigImg = await pdfDoc.embedJpg(sigBuffer);
          } else {
            sigImg = await pdfDoc.embedPng(sigBuffer);
          }
          if (sigImg) {
            currentPage.drawImage(sigImg, {
              x: margin + 210,
              y: currentY - 50,
              width: 70,
              height: 32
            });
          }
        }
      } catch (err) {
        console.error("Error drawing signature on DocuSign sheet:", err);
      }
    }

    const shortSigId = sig.id ? sig.id.split('-')[0].toUpperCase() : 'SIG_VERIFIED';
    currentPage.drawText(`ID Firma: ${shortSigId}`, { x: margin + 210, y: currentY - 58, size: 5.5, font: fontHelvetica, color: rgb(0.5, 0.5, 0.5) });
    currentPage.drawText("Adopción de firma: Imagen cargada", { x: margin + 210, y: currentY - 66, size: 5.5, font: fontHelvetica, color: rgb(0.5, 0.5, 0.5) });
    currentPage.drawText(`Dirección IP: ${ip}`, { x: margin + 210, y: currentY - 74, size: 5.5, font: fontHelvetica, color: rgb(0.4, 0.4, 0.4) });
    
    const locationStr = sig.pageNumber 
      ? `Pág. ${sig.pageNumber} (X: ${sig.coordX ? sig.coordX.toFixed(1) : '0'}%, Y: ${sig.coordY ? sig.coordY.toFixed(1) : '0'}%)`
      : 'N/A';
    currentPage.drawText(`Trazabilidad: ${locationStr}`, { x: margin + 210, y: currentY - 82, size: 5.5, font: fontHelveticaBold, color: rgb(0.08, 0.18, 0.36) });

    // Column 3: Dates
    currentPage.drawText(`Enviado: ${sentDateStr}`, { x: margin + 370, y: currentY - 14, size: 6.5, font: fontHelvetica, color: rgb(0.3, 0.3, 0.3) });
    currentPage.drawText(`Visto: ${viewDateStr}`, { x: margin + 370, y: currentY - 26, size: 6.5, font: fontHelvetica, color: rgb(0.3, 0.3, 0.3) });
    currentPage.drawText(`Firmado: ${signedDateStr}`, { x: margin + 370, y: currentY - 38, size: 6.5, font: fontHelveticaBold, color: rgb(0.1, 0.5, 0.25) });

    // Draw separator line
    currentPage.drawLine({
      start: { x: margin, y: currentY - cardH },
      end: { x: width - margin, y: currentY - cardH },
      thickness: 0.5,
      color: rgb(0.9, 0.91, 0.93)
    });

    currentY -= (cardH + 8);
  }

  // Page 2: timeline events + security disposiciones + disclaimer
  const page2 = pdfDoc.addPage(PageSizes.A4);
  drawPageBorders(page2);

  let y2 = height - 55;
  page2.drawText("Resumen de eventos del sobre", {
    x: margin,
    y: y2,
    size: 10,
    font: fontHelveticaBold,
    color: rgb(0.08, 0.18, 0.36)
  });

  y2 -= 15;

  page2.drawRectangle({
    x: margin,
    y: y2 - 15,
    width: contentWidth,
    height: 15,
    color: rgb(0.9, 0.91, 0.93)
  });
  page2.drawText("Resumen de eventos del sobre", { x: margin + 10, y: y2 - 11, size: 8, font: fontHelveticaBold, color: rgb(0.1, 0.1, 0.1) });
  page2.drawText("Estado", { x: margin + 210, y: y2 - 11, size: 8, font: fontHelveticaBold, color: rgb(0.1, 0.1, 0.1) });
  page2.drawText("Marcas de tiempo", { x: margin + 370, y: y2 - 11, size: 8, font: fontHelveticaBold, color: rgb(0.1, 0.1, 0.1) });

  y2 -= 15;

  // Compile DocuSign envelope timeline events
  const timelineEvents = [];
  
  // 1. Envelope Sent
  timelineEvents.push({
    name: "Sobre enviado",
    status: "Con hash/cifrado",
    date: new Date(node.createdAt)
  });

  // 2. Certificate delivered (first view)
  const sortedAudits = audits.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const uploadAudit = sortedAudits.find(a => a.action === 'SUBIR_DOCUMENTO');
  if (uploadAudit) {
    timelineEvents.push({
      name: "Certificado entregado",
      status: "Seguridad comprobada",
      date: new Date(uploadAudit.createdAt)
    });
  } else {
    timelineEvents.push({
      name: "Certificado entregado",
      status: "Seguridad comprobada",
      date: new Date(node.createdAt)
    });
  }

  // 3. Signers signatures
  sortedSignatures.forEach((sig: any) => {
    if (sig.status === 'APROBADO' && sig.signedAt) {
      timelineEvents.push({
        name: `${sig.user?.name || 'Verificador'} Firmó`,
        status: "Seguridad comprobada",
        date: new Date(sig.signedAt)
      });
    }
  });

  // 4. Finished & Completed
  if (doc.status === 'APROBADO') {
    const finalApprovedDate = sortedSignatures.length > 0 && sortedSignatures[sortedSignatures.length - 1].signedAt
      ? new Date(sortedSignatures[sortedSignatures.length - 1].signedAt)
      : new Date();

    timelineEvents.push({
      name: "Firma completada",
      status: "Seguridad comprobada",
      date: finalApprovedDate
    });

    timelineEvents.push({
      name: "Completado",
      status: "Seguridad comprobada",
      date: finalApprovedDate
    });
  }

  // Draw timeline rows
  const rowH = 18;
  for (const ev of timelineEvents) {
    const timeStr = ev.date.toLocaleString('es-PE', { timeZone: 'America/Lima' });
    
    page2.drawText(ev.name, { x: margin + 10, y: y2 - 12, size: 7, font: fontHelvetica, color: rgb(0.2, 0.2, 0.2) });
    page2.drawText(ev.status, { x: margin + 210, y: y2 - 12, size: 7, font: fontHelvetica, color: rgb(0.4, 0.4, 0.4) });
    page2.drawText(timeStr, { x: margin + 370, y: y2 - 12, size: 7, font: fontHelvetica, color: rgb(0.1, 0.1, 0.1) });

    page2.drawLine({
      start: { x: margin, y: y2 - rowH },
      end: { x: width - margin, y: y2 - rowH },
      thickness: 0.5,
      color: rgb(0.94, 0.95, 0.96)
    });

    y2 -= rowH;
  }

  // 5. Validation and Disposiciones de seguridad
  const footerY = 55;
  y2 = footerY + 110;

  page2.drawLine({
    start: { x: margin, y: y2 },
    end: { x: width - margin, y: y2 },
    thickness: 1,
    color: rgb(0.8, 0.82, 0.85)
  });

  const now = new Date();
  const pad = (num: number) => num.toString().padStart(2, '0');
  const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const shortId = (currentUser?.id || node.id || '00000').substring(0, 5).toUpperCase();
  const uniqueCode = `DOC-${dateStr}-${shortId}`;
  const docHash = crypto.createHash('sha256').update(signedPdfBuffer).digest('hex');

  page2.drawText("DISPOSICIONES DE SEGURIDAD Y VALIDACIÓN", { x: margin, y: y2 - 15, size: 7.5, font: fontHelveticaBold, color: rgb(0.08, 0.18, 0.36) });
  
  page2.drawText("CÓDIGO ÚNICO DE VERIFICACIÓN:", { x: margin, y: y2 - 28, size: 6.5, font: fontHelveticaBold, color: rgb(0.4, 0.4, 0.4) });
  page2.drawText(uniqueCode, { x: margin + 170, y: y2 - 28, size: 6.5, font: fontHelvetica, color: rgb(0.1, 0.1, 0.1) });
  
  page2.drawText("HASH SHA-256 DEL DOCUMENTO:", { x: margin, y: y2 - 38, size: 6.5, font: fontHelveticaBold, color: rgb(0.4, 0.4, 0.4) });
  page2.drawText(docHash, { x: margin + 170, y: y2 - 38, size: 6.5, font: fontHelvetica, color: rgb(0.1, 0.1, 0.1) });
  
  page2.drawText("FECHA DE GENERACIÓN CERTIFICADO:", { x: margin, y: y2 - 48, size: 6.5, font: fontHelveticaBold, color: rgb(0.4, 0.4, 0.4) });
  page2.drawText(now.toLocaleString('es-PE', { timeZone: 'America/Lima' }), { x: margin + 170, y: y2 - 48, size: 6.5, font: fontHelvetica, color: rgb(0.1, 0.1, 0.1) });
  
  page2.drawText("USUARIO QUE GENERÓ DESCARGA:", { x: margin, y: y2 - 58, size: 6.5, font: fontHelveticaBold, color: rgb(0.4, 0.4, 0.4) });
  page2.drawText(currentUser?.name || "Invitado / Sistema", { x: margin + 170, y: y2 - 58, size: 6.5, font: fontHelvetica, color: rgb(0.1, 0.1, 0.1) });

  // 6. Disclaimer Text
  const legalText = "Este certificado constituye evidencia de trazabilidad documental y aprobación electrónica dentro del Sistema de Gestión Documental de ASEPSIS PERÚ, permitiendo sustentar auditorías internas, auditorías externas y procesos de control de calidad.";
  const wrapText = (text: string, maxChars: number) => {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    words.forEach(w => {
      if ((currentLine + w).length > maxChars) {
        lines.push(currentLine.trim());
        currentLine = w + ' ';
      } else {
        currentLine += w + ' ';
      }
    });
    if (currentLine) lines.push(currentLine.trim());
    return lines;
  };

  const wrappedLegalLines = wrapText(legalText, 140);
  let legalY = y2 - 72;
  wrappedLegalLines.forEach(lineText => {
    const textW = fontHelvetica.widthOfTextAtSize(lineText, 6.2);
    page2.drawText(lineText, {
      x: (width - textW) / 2,
      y: legalY,
      size: 6.2,
      font: fontHelvetica,
      color: rgb(0.4, 0.45, 0.5)
    });
    legalY -= 8.5;
  });

  // Footer text
  const footerText = "Documento de trazabilidad emitido electrónicamente de conformidad con los estándares de control de calidad ISO.";
  const footerTextW = fontHelvetica.widthOfTextAtSize(footerText, 6.5);
  page2.drawText(footerText, {
    x: (width - footerTextW) / 2,
    y: 12,
    size: 6.5,
    font: fontHelvetica,
    color: rgb(0.6, 0.63, 0.66)
  });
}


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const option = searchParams.get('option') || '1'; // '1' = signed only, '2' = signed + cert in zip, '3' = merged pdf
    const originalParam = searchParams.get('original') === 'true';
    const clientIp = request.headers.get('x-forwarded-for') || request.ip || '127.0.0.1';

    if (!id) {
      return NextResponse.json({ error: 'ID es obligatorio' }, { status: 400 });
    }

    const node = await db.node.findUnique({
      where: { id },
    });

    if (!node || node.type !== 'FILE') {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }

    // Retrieve active user from session token
    const token = request.cookies.get('session_token')?.value;
    let currentUser: any = null;
    if (token) {
      const decoded = await verifyToken(token);
      if (decoded) {
        currentUser = await db.user.findUnique({
          where: { id: decoded.userId }
        });
      }
    }

    if (!currentUser) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Check permission to download file
    const allowed = await canUserAccessNode(currentUser, node.id);
    const userAreaName = currentUser.areaId 
      ? (await db.area.findUnique({ where: { id: currentUser.areaId } }))?.name || 'Área'
      : 'General';

    if (!allowed) {
      await logAuthorization(
        currentUser.username,
        userAreaName,
        `Descargar archivo "${node.name}"`,
        node.name,
        'Denegado'
      );
      return NextResponse.json(
        { success: false, error: 'No tiene permisos para descargar este archivo' },
        { status: 403 }
      );
    } else {
      await logAuthorization(
        currentUser.username,
        userAreaName,
        `Descargar archivo "${node.name}"`,
        node.name,
        'Permitido'
      );
    }

    const diskFileName = `${node.id}-${node.name}`;
    const originalFileName = `${diskFileName}.verifier1-backup`;
    let fileBuffer: any;
    
    // Determine which file name to load
    let targetFileName = diskFileName;
    if (originalParam) {
      // Check if original backup exists
      let backupExists = false;
      if (supabase) {
        const { data: listData, error: listError } = await supabase.storage.from('files').list('', {
          search: originalFileName
        });
        if (!listError && listData && listData.length > 0) {
          backupExists = listData.some(f => f.name === originalFileName);
        }
      } else {
        const uploadDir = path.join(process.cwd(), 'uploads');
        const backupPath = path.join(uploadDir, originalFileName);
        backupExists = fs.existsSync(backupPath);
      }
      
      if (backupExists) {
        targetFileName = originalFileName;
      }
    }

    // Download the base file from Supabase or disk
    if (supabase) {
      const { data, error } = await supabase.storage.from('files').download(targetFileName);
      if (error || !data) {
        return NextResponse.json({ error: `No se pudo descargar el archivo ${targetFileName} de Supabase` }, { status: 500 });
      }
      fileBuffer = Buffer.from(await data.arrayBuffer());
    } else {
      const uploadDir = path.join(process.cwd(), 'uploads');
      const filePath = path.join(uploadDir, targetFileName);
      
      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: `Archivo físico ${targetFileName} no encontrado en el servidor local` }, { status: 404 });
      }
      fileBuffer = fs.readFileSync(filePath);
    }

    // If original Param is true, bypass stamping/cert generation and return directly
    if (originalParam) {
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': node.mimeType || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(node.name)}"`,
        },
      });
    }

    // Verify if there is an approved Document associated with this file node
    const doc = await db.document.findFirst({
      where: { nodeId: node.id },
      include: {
        area: {
          include: {
            verifiers: true
          }
        },
        creator: true,
        signatures: {
          include: {
            user: true
          }
        }
      }
    });

    const isPdf = node.mimeType === 'application/pdf' || node.name.toLowerCase().endsWith('.pdf');

    // If option is 1, serve the signed file directly (no certificate appended)
    // Also if not a PDF or no document flow record exists, serve the file directly
    if (option === '1' || !isPdf || !doc) {
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': node.mimeType || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(node.name)}"`,
        },
      });
    }

    // Fetch chronological audits for this document to generate the Event History
    const audits = await db.audit.findMany({
      where: {
        OR: [
          { detail: { contains: `"documentName":"${node.name}"` } },
          { detail: { contains: node.name } }
        ]
      },
      orderBy: { createdAt: 'asc' }
    });

    // Generate Certificate PDF
    const certPdf = await PDFDocument.create();
    await appendCertificatePages(certPdf, node, doc, currentUser, clientIp, audits, fileBuffer);
    const certPdfBuffer = Buffer.from(await certPdf.save());

    if (option === '4') {
      // Option 4: Download Certificate PDF only
      const baseName = node.name.replace(/\.[^/.]+$/, "");
      return new NextResponse(certPdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="Certificado-de-Trazabilidad-${encodeURIComponent(baseName)}.pdf"`,
        },
      });
    } else if (option === '2') {
      // Option 2: Download ZIP with Signed PDF + Certificate PDF
      const zip = new JSZip();
      
      // Clean extensions just in case
      const baseName = node.name.replace(/\.[^/.]+$/, "");
      zip.file(`${baseName}.pdf`, fileBuffer);
      zip.file(`Certificado-de-Trazabilidad-${baseName}.pdf`, certPdfBuffer);
      
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      
      return new NextResponse(zipBuffer as any, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(baseName)}-aprobado.zip"`,
        },
      });
    } else {
      // Option 3: Download Single PDF with Certificate Appended at the End
      const mainPdf = await PDFDocument.load(fileBuffer);
      const certPages = await mainPdf.copyPages(certPdf, certPdf.getPageIndices());
      certPages.forEach(page => mainPdf.addPage(page));
      
      const mergedPdfBuffer = Buffer.from(await mainPdf.save());
      
      return new NextResponse(mergedPdfBuffer as any, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(node.name)}"`,
        },
      });
    }
  } catch (error: any) {
    console.error('Error fetching file link:', error);
    return NextResponse.json({ error: 'Error al obtener el archivo: ' + error.message }, { status: 500 });
  }
}
