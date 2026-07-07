import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth-helpers';
import { supabase } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';
import { PDFDocument, rgb, StandardFonts, PageSizes } from 'pdf-lib';
import crypto from 'crypto';

function getVersionFromFilename(name: string): string {
  const match = name.match(/_v(?:ersion)?_?(\d+(?:\.\d+)?)/i) || name.match(/v(?:ersion)?_?(\d+(?:\.\d+)?)/i);
  return match ? match[1] : '1.0';
}

function getAreaAbbreviation(areaName: string): string {
  const normalized = areaName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (normalized.includes('operacion')) return 'OP';
  if (normalized.includes('administra')) return 'AD';
  if (normalized.includes('mantenimien')) return 'MN';
  if (normalized.includes('logistica')) return 'LO';
  return 'GD';
}

function formatDateTime(date: Date | string): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const d = new Date(date);
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

async function appendValidationPage(
  pdfDoc: PDFDocument,
  node: any,
  doc: any,
  currentUser: any,
  currentIp: string
) {
  // 1. Add A4 page
  const page = pdfDoc.addPage(PageSizes.A4);
  const { width, height } = page.getSize();
  
  // 2. Load Fonts
  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // 3. Load Logo of ASEPSIS PERÚ
  let logoImg = null;
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo2.jpg');
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      logoImg = await pdfDoc.embedJpg(logoBuffer);
    }
  } catch (err) {
    console.error('Error loading logo for validation page:', err);
  }
  
  // 4. Draw Header
  page.drawRectangle({
    x: 30,
    y: height - 80,
    width: width - 60,
    height: 50,
    color: rgb(0.96, 0.97, 0.98),
    borderColor: rgb(0.8, 0.82, 0.85),
    borderWidth: 1
  });
  
  if (logoImg) {
    const logoW = 100;
    const logoH = 30;
    page.drawImage(logoImg, {
      x: 40,
      y: height - 70,
      width: logoW,
      height: logoH
    });
  } else {
    page.drawText('ASEPSIS PERÚ', {
      x: 40,
      y: height - 58,
      size: 14,
      font: fontHelveticaBold,
      color: rgb(0.08, 0.18, 0.36)
    });
  }
  
  const titleText = 'HOJA DE VALIDACIÓN Y APROBACIONES';
  const titleWidth = fontHelveticaBold.widthOfTextAtSize(titleText, 11);
  page.drawText(titleText, {
    x: width - 40 - titleWidth,
    y: height - 58,
    size: 11,
    font: fontHelveticaBold,
    color: rgb(0.08, 0.18, 0.36)
  });
  
  // 5. Draw Document Details Section
  let y = height - 100;
  
  page.drawText('DETALLES DEL DOCUMENTO', {
    x: 30,
    y: y - 12,
    size: 9,
    font: fontHelveticaBold,
    color: rgb(0.4, 0.45, 0.5)
  });
  
  y -= 20;
  
  const detailBoxH = 80;
  page.drawRectangle({
    x: 30,
    y: y - detailBoxH,
    width: width - 60,
    height: detailBoxH,
    color: rgb(0.98, 0.98, 0.99),
    borderColor: rgb(0.9, 0.91, 0.93),
    borderWidth: 1
  });
  
  const docVersion = getVersionFromFilename(node.name);
  const areaName = doc?.area?.name || 'Gestión Documental';
  const areaAbbr = getAreaAbbreviation(areaName);
  const docCode = `ASEPSIS-${areaAbbr}-${node.id.split('-')[0].toUpperCase()}`;
  const docEmitDate = new Date(node.createdAt).toLocaleDateString('es-PE', { timeZone: 'America/Lima' });
  
  page.drawText('Nombre del documento:', { x: 45, y: y - 20, size: 8.5, font: fontHelveticaBold, color: rgb(0.3, 0.3, 0.3) });
  page.drawText(node.name, { x: 160, y: y - 20, size: 8.5, font: fontHelvetica, color: rgb(0.1, 0.1, 0.1) });
  
  page.drawText('Código del documento:', { x: 45, y: y - 35, size: 8.5, font: fontHelveticaBold, color: rgb(0.3, 0.3, 0.3) });
  page.drawText(docCode, { x: 160, y: y - 35, size: 8.5, font: fontHelvetica, color: rgb(0.1, 0.1, 0.1) });
  
  page.drawText('Versión:', { x: 45, y: y - 50, size: 8.5, font: fontHelveticaBold, color: rgb(0.3, 0.3, 0.3) });
  page.drawText(docVersion, { x: 160, y: y - 50, size: 8.5, font: fontHelvetica, color: rgb(0.1, 0.1, 0.1) });
  
  page.drawText('Fecha de emisión:', { x: 340, y: y - 20, size: 8.5, font: fontHelveticaBold, color: rgb(0.3, 0.3, 0.3) });
  page.drawText(docEmitDate, { x: 440, y: y - 20, size: 8.5, font: fontHelvetica, color: rgb(0.1, 0.1, 0.1) });
  
  page.drawText('Estado del documento:', { x: 340, y: y - 35, size: 8.5, font: fontHelveticaBold, color: rgb(0.3, 0.3, 0.3) });
  
  page.drawRectangle({
    x: 440,
    y: y - 39,
    width: 65,
    height: 14,
    color: rgb(0.9, 0.98, 0.93),
    borderColor: rgb(0.6, 0.9, 0.7),
    borderWidth: 0.5
  });
  page.drawText('APROBADO', { x: 447, y: y - 34, size: 7.5, font: fontHelveticaBold, color: rgb(0.1, 0.5, 0.25) });
  
  y -= detailBoxH + 15;
  
  // 6. Draw Signatures Section
  page.drawText('FIRMAS Y APROBACIONES REGISTRADAS', {
    x: 30,
    y: y - 12,
    size: 9,
    font: fontHelveticaBold,
    color: rgb(0.4, 0.45, 0.5)
  });
  
  y -= 20;
  
  const audits = await db.audit.findMany({
    where: {
      action: 'FIRMAR_DOCUMENTO',
      detail: {
        contains: node.name
      }
    }
  });
  
  const signatures = await db.signature.findMany({
    where: { documentId: doc.id },
    include: { user: true }
  });
  
  const verifiers = doc?.area?.verifiers || [];
  const verifierOrderMap = new Map<string, number>();
  verifiers.forEach((v: any) => {
    verifierOrderMap.set(v.userId, v.signOrder);
  });
  
  const sortedSignatures = signatures.sort((a, b) => {
    const orderA = verifierOrderMap.get(a.userId) || 99;
    const orderB = verifierOrderMap.get(b.userId) || 99;
    return orderA - orderB;
  });
  
  const cardH = 90;
  for (const sig of sortedSignatures) {
    const isCurrent = sig.userId === currentUser.id;
    const sigUser = sig.user;
    
    page.drawRectangle({
      x: 30,
      y: y - cardH,
      width: width - 60,
      height: cardH,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.88, 0.9, 0.92),
      borderWidth: 1
    });
    
    let verifierIp = '127.0.0.1';
    if (isCurrent) {
      verifierIp = currentIp;
    } else {
      const audit = audits.find(a => a.username === sigUser.username);
      if (audit) {
        try {
          verifierIp = JSON.parse(audit.detail).ip || '127.0.0.1';
        } catch {}
      }
    }
    
    const signDateStr = isCurrent 
      ? formatDateTime(new Date()) 
      : (sig.signedAt ? formatDateTime(sig.signedAt) : 'Pendiente');
    
    let cargo = sigUser.cargo ? sigUser.cargo : 'Verificador';
    if (!sigUser.cargo) {
      if (sigUser.role === 'ADMIN') {
        cargo = 'Gerente General';
      } else if (sigUser.role === 'VERIFIER') {
        cargo = 'Verificador de Control';
      } else if (sigUser.role === 'CREATOR') {
        cargo = 'Creador';
      }
    }
    
    page.drawText(sigUser.name.toUpperCase(), { x: 45, y: y - 20, size: 9, font: fontHelveticaBold, color: rgb(0.08, 0.18, 0.36) });
    
    page.drawText('Cargo:', { x: 45, y: y - 35, size: 7.5, font: fontHelveticaBold, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(cargo, { x: 120, y: y - 35, size: 7.5, font: fontHelvetica, color: rgb(0.1, 0.1, 0.1) });
    
    page.drawText('Fecha / Hora:', { x: 45, y: y - 48, size: 7.5, font: fontHelveticaBold, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(signDateStr, { x: 120, y: y - 48, size: 7.5, font: fontHelvetica, color: rgb(0.1, 0.1, 0.1) });
    
    page.drawText('Dirección IP:', { x: 45, y: y - 61, size: 7.5, font: fontHelveticaBold, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(verifierIp, { x: 120, y: y - 61, size: 7.5, font: fontHelvetica, color: rgb(0.1, 0.1, 0.1) });
    
    page.drawText('Estado Firma:', { x: 45, y: y - 74, size: 7.5, font: fontHelveticaBold, color: rgb(0.4, 0.4, 0.4) });
    page.drawText('APROBADO Y FIRMADO', { x: 120, y: y - 74, size: 7.5, font: fontHelveticaBold, color: rgb(0.1, 0.5, 0.25) });
    
    if (sigUser.signature) {
      try {
        const sigBuffer = await getSignatureBuffer(sigUser.signature);
        if (sigBuffer) {
          let sigImg;
          if (sigUser.signature.toLowerCase().endsWith('.jpg') || sigUser.signature.toLowerCase().endsWith('.jpeg')) {
            sigImg = await pdfDoc.embedJpg(sigBuffer);
          } else {
            sigImg = await pdfDoc.embedPng(sigBuffer);
          }
          if (sigImg) {
            const sigImgW = 100;
            const sigImgH = 50;
            page.drawImage(sigImg, {
              x: width - 40 - sigImgW,
              y: y - cardH + (cardH - sigImgH) / 2,
              width: sigImgW,
              height: sigImgH
            });
          }
        }
      } catch (err) {
        console.error('Error drawing signature on validation page for:', sigUser.name, err);
      }
    }
    
    y -= cardH + 12;
  }
  
  // 7. Draw Footer Section
  const footerY = 80;
  
  page.drawLine({
    start: { x: 30, y: footerY + 50 },
    end: { x: width - 30, y: footerY + 50 },
    thickness: 0.5,
    color: rgb(0.7, 0.72, 0.75)
  });
  
  const now = new Date();
  const pad = (num: number) => num.toString().padStart(2, '0');
  const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const shortId = (currentUser.id || node.id || '00000').substring(0, 5).toUpperCase();
  const uniqueCode = `DOC-${dateStr}-${shortId}`;
  
  const docHash = crypto.createHash('sha256').update(await pdfDoc.save()).digest('hex');
  
  page.drawText('CÓDIGO ÚNICO DE VERIFICACIÓN:', { x: 30, y: footerY + 38, size: 7.5, font: fontHelveticaBold, color: rgb(0.4, 0.4, 0.4) });
  page.drawText(uniqueCode, { x: 180, y: footerY + 38, size: 7.5, font: fontHelvetica, color: rgb(0.1, 0.1, 0.1) });
  
  page.drawText('HASH SHA-256 DEL DOCUMENTO:', { x: 30, y: footerY + 26, size: 7.5, font: fontHelveticaBold, color: rgb(0.4, 0.4, 0.4) });
  page.drawText(docHash, { x: 180, y: footerY + 26, size: 7.5, font: fontHelvetica, color: rgb(0.1, 0.1, 0.1) });
  
  page.drawText('FECHA DE GENERACIÓN REPORTE:', { x: 30, y: footerY + 14, size: 7.5, font: fontHelveticaBold, color: rgb(0.4, 0.4, 0.4) });
  page.drawText(formatDateTime(now), { x: 180, y: footerY + 14, size: 7.5, font: fontHelvetica, color: rgb(0.1, 0.1, 0.1) });
  
  const footerText = 'Generado automáticamente por el Sistema de Gestión Documental de ASEPSIS PERÚ.';
  const footerTextW = fontHelvetica.widthOfTextAtSize(footerText, 7);
  page.drawText(footerText, {
    x: (width - footerTextW) / 2,
    y: footerY - 10,
    size: 7,
    font: fontHelvetica,
    color: rgb(0.5, 0.53, 0.56)
  });
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

export async function POST(request: NextRequest) {
  try {
    const { fileId, placement, action, annotations } = await request.json();
    const clientIp = request.headers.get('x-forwarded-for') || request.ip || '127.0.0.1';

    if (!fileId) {
      return NextResponse.json({ error: 'ID del archivo es obligatorio' }, { status: 400 });
    }

    // Retrieve active user from cookies
    const token = request.cookies.get('session_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado. Por favor inicia sesión.' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Sesión inválida o expirada.' }, { status: 401 });
    }

    // Get user from DB
    const user = await db.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Find the file node
    const node = await db.node.findUnique({
      where: { id: fileId }
    });

    if (!node) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }

    if (node.type !== 'FILE') {
      return NextResponse.json({ error: 'Solo se pueden verificar archivos, no carpetas.' }, { status: 400 });
    }

    if (node.isTrashed) {
      return NextResponse.json({ error: 'No se puede verificar un archivo que está en la papelera.' }, { status: 400 });
    }

    const diskFileName = `${node.id}-${node.name}`;
    const normalizedCreator = node.creator?.trim().toLowerCase() || '';
    const normalizedUser = user.name?.trim().toLowerCase() || '';

    // Fetch area document details if it exists
    const doc = await db.document.findUnique({
      where: { nodeId: fileId },
      include: {
        area: {
          include: {
            verifiers: {
              orderBy: { signOrder: 'asc' },
              include: {
                user: true
              }
            }
          }
        },
        signatures: true
      }
    });

    if (doc && doc.status === 'APROBADO') {
      return NextResponse.json({ error: 'No se puede modificar un documento que ya está completamente aprobado.' }, { status: 400 });
    }

    // Handle Document Rejection
    if (action === 'reject') {
      if (!doc) {
        return NextResponse.json({ error: 'Este documento no pertenece a un área con flujo de firmas.' }, { status: 400 });
      }

      const userSignature = doc.signatures.find(s => s.userId === user.id);
      if (!userSignature) {
        return NextResponse.json({ error: 'No eres un verificador asignado para este documento.' }, { status: 403 });
      }

      // Update signature status to RECHAZADO
      await db.signature.update({
        where: { id: userSignature.id },
        data: {
          status: 'RECHAZADO',
          signedAt: new Date()
        }
      });

      // Update document status to RECHAZADO
      await db.document.update({
        where: { id: doc.id },
        data: { status: 'RECHAZADO' }
      });

      // Audit Log
      let fileHash = '';
      try {
        let fileBuffer: Buffer | null = null;
        if (supabase) {
          const { data } = await supabase.storage.from('files').download(diskFileName);
          if (data) fileBuffer = Buffer.from(await data.arrayBuffer());
        } else {
          const filePath = path.join(process.cwd(), 'uploads', diskFileName);
          if (fs.existsSync(filePath)) fileBuffer = fs.readFileSync(filePath);
        }
        if (fileBuffer) {
          fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        }
      } catch (err) {
        console.error('Error computing hash for reject audit:', err);
      }

      await db.audit.create({
        data: {
          username: user.username,
          action: 'RECHAZAR_DOCUMENTO',
          detail: JSON.stringify({
            message: `Rechazó el documento "${node.name}" en el área "${doc.area.name}"`,
            documentName: node.name,
            action: 'RECHAZAR_DOCUMENTO',
            ip: clientIp,
            status: 'RECHAZADO',
            sha256: fileHash,
            timestamp: new Date()
          })
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Documento rechazado con éxito.'
      });
    }

    // Handle Signature Removal
    if (action === 'remove') {
      let verifierSlotToRemove = 0;
      if (node.verifier3?.trim().toLowerCase() === normalizedUser) {
        verifierSlotToRemove = 3;
      } else if (node.verifier2?.trim().toLowerCase() === normalizedUser) {
        verifierSlotToRemove = 2;
      } else if (node.verifier1?.trim().toLowerCase() === normalizedUser) {
        verifierSlotToRemove = 1;
      }

      if (verifierSlotToRemove === 0) {
        return NextResponse.json({ error: 'No has firmado este documento.' }, { status: 400 });
      }

      const backupFileName = `${diskFileName}.verifier${verifierSlotToRemove}-backup`;
      const uploadDir = path.join(process.cwd(), 'uploads');
      const backupPath = path.join(uploadDir, backupFileName);
      const filePath = path.join(uploadDir, diskFileName);

      let fileRestored = false;
      let newSize = node.size;

      if (supabase) {
        const { data: backupData, error: downloadError } = await supabase.storage.from('files').download(backupFileName);
        if (!downloadError && backupData) {
          const buffer = Buffer.from(await backupData.arrayBuffer());
          const { error: uploadError } = await supabase.storage.from('files').upload(diskFileName, buffer, {
            upsert: true,
            contentType: node.mimeType || 'application/octet-stream'
          });
          if (!uploadError) {
            fileRestored = true;
            newSize = buffer.length;
          }
        }
      } else {
        if (fs.existsSync(backupPath)) {
          fs.copyFileSync(backupPath, filePath);
          fileRestored = true;
          newSize = fs.statSync(filePath).size;
        }
      }

      const updateData: any = {
        size: newSize
      };

      if (verifierSlotToRemove === 1) {
        updateData.verifier1 = null;
        updateData.verifier2 = null;
        updateData.verifier3 = null;
      } else if (verifierSlotToRemove === 2) {
        updateData.verifier2 = null;
        updateData.verifier3 = null;
      } else if (verifierSlotToRemove === 3) {
        updateData.verifier3 = null;
      }

      const deleteBackup = async (slot: number) => {
        const name = `${diskFileName}.verifier${slot}-backup`;
        if (supabase) {
          await supabase.storage.from('files').remove([name]);
        } else {
          const pathName = path.join(uploadDir, name);
          if (fs.existsSync(pathName)) {
            fs.unlinkSync(pathName);
          }
        }
      };

      for (let s = verifierSlotToRemove; s <= 3; s++) {
        try {
          await deleteBackup(s);
        } catch (err) {
          console.error(`Error deleting backup verifier${s}:`, err);
        }
      }

      if (doc) {
        // Sync with Signature table
        const verifiersByOrder = doc.area.verifiers;
        for (const v of verifiersByOrder) {
          if (v.signOrder >= verifierSlotToRemove) {
            const sig = doc.signatures.find(s => s.userId === v.userId);
            if (sig) {
              await db.signature.update({
                where: { id: sig.id },
                data: {
                  status: 'PENDIENTE',
                  signedAt: null
                }
              });
            }
          }
        }

        // Update Document status
        await db.document.update({
          where: { id: doc.id },
          data: {
            status: verifierSlotToRemove === 1 ? 'PENDIENTE' : 'EN_PROCESO'
          }
        });

        // Audit Log
        let fileHash = '';
        try {
          let fileBuffer: Buffer | null = null;
          if (supabase) {
            const { data } = await supabase.storage.from('files').download(diskFileName);
            if (data) fileBuffer = Buffer.from(await data.arrayBuffer());
          } else {
            const filePath = path.join(process.cwd(), 'uploads', diskFileName);
            if (fs.existsSync(filePath)) fileBuffer = fs.readFileSync(filePath);
          }
          if (fileBuffer) {
            fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
          }
        } catch (err) {
          console.error('Error computing hash for remove audit:', err);
        }

        await db.audit.create({
          data: {
            username: user.username,
            action: 'REMOVER_FIRMA',
            detail: JSON.stringify({
              message: `Removió su firma del documento "${node.name}" en el área "${doc.area.name}"`,
              documentName: node.name,
              action: 'REMOVER_FIRMA',
              ip: clientIp,
              status: verifierSlotToRemove === 1 ? 'PENDIENTE' : 'EN_PROCESO',
              sha256: fileHash,
              timestamp: new Date()
            })
          }
        });
      }

      const updatedNode = await db.node.update({
        where: { id: fileId },
        data: updateData
      });

      const finalNode = await db.node.findUnique({
        where: { id: fileId },
        include: {
          document: {
            include: {
              signatures: true
            }
          }
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Tu firma ha sido removida con éxito.',
        node: finalNode || updatedNode
      });
    }

    let updateData: any = {};
    let myOrder = 0;

    if (doc) {
      // Area Signature Flow Validation
      const userSignature = doc.signatures.find(s => s.userId === user.id);
      if (!userSignature) {
        return NextResponse.json({ error: 'No eres un verificador asignado para este documento/área.' }, { status: 403 });
      }

      if (userSignature.status === 'APROBADO') {
        return NextResponse.json({ error: 'Ya has firmado este documento.' }, { status: 400 });
      }

      // Find my signOrder
      const verifierConf = doc.area.verifiers.find(v => v.userId === user.id);
      myOrder = verifierConf ? verifierConf.signOrder : 99;

      // Enforce sequential signature order
      const previousVerifiers = doc.area.verifiers.filter(v => v.signOrder < myOrder);
      for (const prev of previousVerifiers) {
        const prevSig = doc.signatures.find(s => s.userId === prev.userId);
        if (!prevSig || prevSig.status !== 'APROBADO') {
          return NextResponse.json({ 
            error: `Es el turno de firma del verificador anterior (${prev.user?.name || 'orden ' + prev.signOrder}).` 
          }, { status: 400 });
        }
      }

      // Assign to appropriate verifier slot
      if (myOrder === 1) {
        updateData.verifier1 = user.name;
      } else if (myOrder === 2) {
        updateData.verifier2 = user.name;
      } else if (myOrder === 3) {
        updateData.verifier3 = user.name;
      }
    } else {
      // Legacy Orderless Flow Validation
      // Rule 1: The creator cannot verify their own file
      if (normalizedCreator === normalizedUser) {
        return NextResponse.json({ 
          error: 'Restricción de control: El creador del archivo no puede firmar como verificador.' 
        }, { status: 403 });
      }

      // Rule 2: The user cannot sign twice
      const alreadySigned = 
        node.verifier1?.trim().toLowerCase() === normalizedUser || 
        node.verifier2?.trim().toLowerCase() === normalizedUser || 
        node.verifier3?.trim().toLowerCase() === normalizedUser;

      if (alreadySigned) {
        return NextResponse.json({ 
          error: 'Ya has firmado/verificado este documento.' 
        }, { status: 400 });
      }

      // Rule 3: Find the next empty verifier slot in order (1 -> 2 -> 3)
      if (!node.verifier1) {
        updateData.verifier1 = user.name;
      } else if (!node.verifier2) {
        updateData.verifier2 = user.name;
      } else if (!node.verifier3) {
        updateData.verifier3 = user.name;
      } else {
        return NextResponse.json({ error: 'Este documento ya está completamente verificado (3/3 firmas).' }, { status: 400 });
      }
    }

    // Gather names for user signatures mapping
    const creatorName = node.creator;
    const verifier1Name = updateData.verifier1 || node.verifier1;
    const verifier2Name = updateData.verifier2 || node.verifier2;
    const verifier3Name = updateData.verifier3 || node.verifier3;

    const namesToFetch = [creatorName, verifier1Name, verifier2Name, verifier3Name].filter(Boolean) as string[];
    const dbUsers = await db.user.findMany({
      where: {
        name: { in: namesToFetch }
      }
    });

    const userMap = new Map<string, { role: string; signature: string | null }>();
    dbUsers.forEach(u => {
      if (u.name) {
        userMap.set(u.name.trim().toLowerCase(), {
          role: u.role,
          signature: u.signature
        });
      }
    });

    const creatorDetail = creatorName ? {
      name: creatorName,
      role: userMap.get(creatorName.trim().toLowerCase())?.role || 'CREATOR',
      signature: userMap.get(creatorName.trim().toLowerCase())?.signature || null
    } : null;

    const verifier1Detail = verifier1Name ? {
      name: verifier1Name,
      role: userMap.get(verifier1Name.trim().toLowerCase())?.role || 'VERIFIER',
      signature: userMap.get(verifier1Name.trim().toLowerCase())?.signature || null
    } : null;

    const verifier2Detail = verifier2Name ? {
      name: verifier2Name,
      role: userMap.get(verifier2Name.trim().toLowerCase())?.role || 'VERIFIER',
      signature: userMap.get(verifier2Name.trim().toLowerCase())?.signature || null
    } : null;

    const verifier3Detail = verifier3Name ? {
      name: verifier3Name,
      role: userMap.get(verifier3Name.trim().toLowerCase())?.role || 'VERIFIER',
      signature: userMap.get(verifier3Name.trim().toLowerCase())?.signature || null
    } : null;

    // Load signature buffers
    const creatorSigBuffer = creatorDetail?.signature ? await getSignatureBuffer(creatorDetail.signature) : null;
    const verifier1SigBuffer = verifier1Detail?.signature ? await getSignatureBuffer(verifier1Detail.signature) : null;
    const verifier2SigBuffer = verifier2Detail?.signature ? await getSignatureBuffer(verifier2Detail.signature) : null;
    const verifier3SigBuffer = verifier3Detail?.signature ? await getSignatureBuffer(verifier3Detail.signature) : null;

    const certDate = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });
    const totalSignatures = [creatorDetail, verifier1Detail, verifier2Detail, verifier3Detail].filter(Boolean).length;

    let pageSigned: number | null = null;
    let coordX: number | null = null;
    let coordY: number | null = null;

    const fileLower = node.name.toLowerCase();
    const isPdf = fileLower.endsWith('.pdf');
    const isDocx = fileLower.endsWith('.docx');
    let fileBuffer: any;

    if (isPdf || isDocx) {
      // 1. Download/Read original file buffer
      if (supabase) {
        const { data, error: downloadError } = await supabase.storage.from('files').download(diskFileName);
        if (downloadError || !data) {
          throw new Error('No se pudo descargar el archivo original de Supabase: ' + (downloadError?.message || 'Sin datos'));
        }
        fileBuffer = Buffer.from(await data.arrayBuffer());
      } else {
        const uploadDir = path.join(process.cwd(), 'uploads');
        const filePath = path.join(uploadDir, diskFileName);
        if (!fs.existsSync(filePath)) {
          throw new Error('El archivo físico no se encuentra en el servidor local');
        }
        fileBuffer = fs.readFileSync(filePath);
      }

      // Create backup of the file before stamping
      let verifierSlot = 1;
      if (updateData.verifier1) {
        verifierSlot = 1;
      } else if (updateData.verifier2) {
        verifierSlot = 2;
      } else if (updateData.verifier3) {
        verifierSlot = 3;
      }
      const backupFileName = `${diskFileName}.verifier${verifierSlot}-backup`;
      if (supabase) {
        const { error: uploadError } = await supabase.storage.from('files').upload(backupFileName, fileBuffer, {
          upsert: true,
          contentType: node.mimeType || 'application/octet-stream'
        });
        if (uploadError) {
          console.error('Error creating backup in Supabase:', uploadError);
        }
      } else {
        const uploadDir = path.join(process.cwd(), 'uploads');
        const backupPath = path.join(uploadDir, backupFileName);
        fs.writeFileSync(backupPath, fileBuffer);
      }

      let willBeApproved = false;
      if (doc) {
        const otherSigs = doc.signatures.filter(s => s.userId !== user.id);
        const allOthersApproved = otherSigs.every(s => s.status === 'APROBADO');
        willBeApproved = allOthersApproved;
      }

      // 2. Perform stamping
      if (isPdf) {
        if (placement || (annotations && annotations.length > 0) || willBeApproved) {
          const pdfDoc = await PDFDocument.load(fileBuffer);
          const pages = pdfDoc.getPages();
          const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

          // 1. Draw signature if placement exists
          if (placement) {
            let pageIdx = pages.length - 1; // Default last page
            if (placement.page === 'first') {
              pageIdx = 0;
            } else if (placement.page === 'number' && placement.pageNumber) {
              pageIdx = Math.min(Math.max(0, placement.pageNumber - 1), pages.length - 1);
            }
            pageSigned = pageIdx + 1;
            coordX = placement.x;
            coordY = placement.y;
            const targetPage = pages[pageIdx];
            const { width, height } = targetPage.getSize();

            // Find active verifier's signature buffer
            let activeSigBuffer = null;
            let activeSigPath = null;
            if (updateData.verifier1) {
              activeSigBuffer = verifier1SigBuffer;
              activeSigPath = verifier1Detail?.signature;
            } else if (updateData.verifier2) {
              activeSigBuffer = verifier2SigBuffer;
              activeSigPath = verifier2Detail?.signature;
            } else if (updateData.verifier3) {
              activeSigBuffer = verifier3SigBuffer;
              activeSigPath = verifier3Detail?.signature;
            }

            if (activeSigBuffer) {
              try {
                let img;
                const sigPathLower = (activeSigPath || '').toLowerCase();
                if (sigPathLower.endsWith('.jpg') || sigPathLower.endsWith('.jpeg')) {
                  img = await pdfDoc.embedJpg(activeSigBuffer);
                } else {
                  img = await pdfDoc.embedPng(activeSigBuffer);
                }

                if (img) {
                  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
                  const scale = placement.scale || 1.0;
                  const boxW = 160 * scale;
                  const boxH = 110 * scale;

                  const targetX = (placement.x / 100) * width;
                  const targetY = (placement.y / 100) * height;

                  const boxX = Math.max(0, Math.min(targetX - boxW / 2, width - boxW));
                  const boxY = Math.max(0, Math.min(targetY - boxH / 2, height - boxH));

                  // Draw premium bounding box (transparent background to avoid covering document text)
                  targetPage.drawRectangle({
                    x: boxX,
                    y: boxY,
                    width: boxW,
                    height: boxH,
                    borderColor: rgb(0.7, 0.7, 0.8),
                    borderWidth: 1
                  });

                  // Draw signature image
                  const imgW = 80 * scale;
                  const imgH = 40 * scale;
                  const imgX = boxX + (boxW - imgW) / 2;
                  const imgY = boxY + boxH - imgH - (8 * scale);

                  targetPage.drawImage(img, {
                    x: imgX,
                    y: imgY,
                    width: imgW,
                    height: imgH
                  });

                  // Draw user name (bold)
                  const nameText = (user.name || '').toUpperCase();
                  const nameFontSize = 7 * scale;
                  const nameWidth = helveticaBold.widthOfTextAtSize(nameText, nameFontSize);
                  const nameX = boxX + (boxW - nameWidth) / 2;
                  const nameY = imgY - (11 * scale);

                  targetPage.drawText(nameText, {
                    x: nameX,
                    y: nameY,
                    size: nameFontSize,
                    font: helveticaBold,
                    color: rgb(0.1, 0.1, 0.2)
                  });

                  // Draw user cargo/role in Spanish
                  let userRoleSpanish = user.cargo ? user.cargo : 'Verificador';
                  if (!user.cargo) {
                    if (user.role === 'ADMIN') {
                      userRoleSpanish = 'Gerente General';
                    } else if (user.role === 'VERIFIER') {
                      userRoleSpanish = 'Verificador de Control';
                    } else if (user.role === 'CREATOR') {
                      userRoleSpanish = 'Creador';
                    }
                  }

                  const roleFontSize = 6 * scale;
                  const roleWidth = helveticaFont.widthOfTextAtSize(userRoleSpanish, roleFontSize);
                  const roleX = boxX + (boxW - roleWidth) / 2;
                  const roleY = nameY - (8 * scale);

                  targetPage.drawText(userRoleSpanish, {
                    x: roleX,
                    y: roleY,
                    size: roleFontSize,
                    font: helveticaFont,
                    color: rgb(0.3, 0.3, 0.4)
                  });

                  // Draw certification stamp text
                  const labelText = 'Firma Digital';
                  const labelFontSize = 5.5 * scale;
                  const labelWidth = helveticaBold.widthOfTextAtSize(labelText, labelFontSize);
                  const labelX = boxX + (boxW - labelWidth) / 2;
                  const labelY = roleY - (10 * scale);

                  targetPage.drawText(labelText, {
                    x: labelX,
                    y: labelY,
                    size: labelFontSize,
                    font: helveticaBold,
                    color: rgb(0.1, 0.5, 0.3)
                  });

                  // Draw Date/Time
                  const pad = (num: number) => num.toString().padStart(2, '0');
                  const certDate = new Date().toLocaleString('es-PE', { 
                    timeZone: 'America/Lima',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                  });

                  const dateText = `Fecha: ${certDate}`;
                  const dateFontSize = 5 * scale;
                  const dateWidth = helveticaFont.widthOfTextAtSize(dateText, dateFontSize);
                  const dateX = boxX + (boxW - dateWidth) / 2;
                  const dateY = labelY - (7 * scale);

                  targetPage.drawText(dateText, {
                    x: dateX,
                    y: dateY,
                    size: dateFontSize,
                    font: helveticaFont,
                    color: rgb(0.4, 0.4, 0.5)
                  });

                  // Draw unique validation code
                  const now = new Date();
                  const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
                  const shortId = (user.id || fileId || '00000').substring(0, 5).toUpperCase();
                  const uniqueCode = `DOC-${dateStr}-${shortId}`;

                  const codeText = `Código: ${uniqueCode}`;
                  const codeFontSize = 5 * scale;
                  const codeWidth = helveticaFont.widthOfTextAtSize(codeText, codeFontSize);
                  const codeX = boxX + (boxW - codeWidth) / 2;
                  const codeY = dateY - (6 * scale);

                  targetPage.drawText(codeText, {
                    x: codeX,
                    y: codeY,
                    size: codeFontSize,
                    font: helveticaFont,
                    color: rgb(0.4, 0.4, 0.5)
                  });
                }
              } catch (err) {
                console.error("Error embedding signature on target page:", err);
              }
            }
          }

          // 2. Draw annotations if annotations exist
          if (annotations && annotations.length > 0) {
            for (const ann of annotations) {
              try {
                const pageIdx = Math.min(Math.max(0, ann.pageNumber - 1), pages.length - 1);
                const targetPage = pages[pageIdx];
                const { width, height } = targetPage.getSize();

                if (ann.type === 'draw' || ann.type === 'highlight') {
                  if (ann.points && ann.points.length > 1) {
                    for (let i = 0; i < ann.points.length - 1; i++) {
                      const p1 = ann.points[i];
                      const p2 = ann.points[i + 1];

                      const x1 = (p1.x / 100) * width;
                      const y1 = height - (p1.y / 100) * height;
                      const x2 = (p2.x / 100) * width;
                      const y2 = height - (p2.y / 100) * height;

                      targetPage.drawLine({
                        start: { x: x1, y: y1 },
                        end: { x: x2, y: y2 },
                        thickness: ann.type === 'highlight' ? 12 : 2,
                        color: ann.type === 'highlight' ? rgb(1, 0.9, 0.2) : rgb(0.94, 0.27, 0.27),
                        opacity: ann.type === 'highlight' ? 0.4 : 1.0,
                      });
                    }
                  }
                } else if (ann.type === 'text') {
                  if (ann.text && ann.x !== undefined && ann.y !== undefined) {
                    const tx = (ann.x / 100) * width;
                    const ty = height - (ann.y / 100) * height - 10; // top-left offset

                    targetPage.drawText(ann.text, {
                      x: tx,
                      y: ty,
                      size: 10,
                      font: helveticaFont,
                      color: rgb(0.94, 0.27, 0.27),
                    });
                  }
                } else if (ann.type === 'comment') {
                  if (ann.text && ann.x !== undefined && ann.y !== undefined) {
                    const cx = (ann.x / 100) * width;
                    const cy = height - (ann.y / 100) * height;

                    const noteW = 100;
                    const noteH = 40;

                    // Draw yellow background box
                    targetPage.drawRectangle({
                      x: cx - noteW / 2,
                      y: cy - noteH / 2,
                      width: noteW,
                      height: noteH,
                      color: rgb(0.96, 0.8, 0.27),
                      borderColor: rgb(0.8, 0.6, 0.1),
                      borderWidth: 1,
                      opacity: 0.9,
                    });

                    // Draw user name/header
                    targetPage.drawText(`[Nota: ${user.name}]`, {
                      x: cx - noteW / 2 + 5,
                      y: cy - noteH / 2 + 27,
                      size: 7,
                      font: helveticaFont,
                      color: rgb(0.4, 0.2, 0.0),
                    });

                    // Draw comment text (wrapped to fit)
                    const commentText = ann.text.length > 30 ? ann.text.substring(0, 27) + '...' : ann.text;
                    targetPage.drawText(commentText, {
                      x: cx - noteW / 2 + 5,
                      y: cy - noteH / 2 + 15,
                      size: 7,
                      font: helveticaFont,
                      color: rgb(0.1, 0.1, 0.1),
                    });
                  }
                }
              } catch (annErr) {
                console.error("Error drawing annotation on page:", ann, annErr);
              }
            }
          }

          // Note: The validation certificate is now generated dynamically during download
          // to support multiple download options (Option 1, 2, and 3).

          fileBuffer = Buffer.from(await pdfDoc.save());
        }
      } else if (isDocx) {
        // Find active verifier's signature buffer
        let activeSigBuffer = null;
        let activeSigPath = null;
        if (updateData.verifier1) {
          activeSigBuffer = verifier1SigBuffer;
          activeSigPath = verifier1Detail?.signature;
        } else if (updateData.verifier2) {
          activeSigBuffer = verifier2SigBuffer;
          activeSigPath = verifier2Detail?.signature;
        } else if (updateData.verifier3) {
          activeSigBuffer = verifier3SigBuffer;
          activeSigPath = verifier3Detail?.signature;
        }

        if (activeSigBuffer) {
          try {
            const JSZip = require('jszip');
            const zip = await JSZip.loadAsync(fileBuffer);

            // 1. Ensure [Content_Types].xml contains the image type extension
            let contentTypesXml = await zip.file('[Content_Types].xml').async('text');
            const ext = (activeSigPath || '').split('.').pop()?.toLowerCase() || 'png';
            const imageType: 'png' | 'jpg' = (ext === 'jpg' || ext === 'jpeg') ? 'jpg' : 'png';
            const mimeType = imageType === 'jpg' ? 'image/jpeg' : 'image/png';
            
            if (!contentTypesXml.includes(`Extension="${ext}"`) && !contentTypesXml.includes(`Extension='${ext}'`)) {
              contentTypesXml = contentTypesXml.replace('<Types ', `<Types><Default Extension="${ext}" ContentType="${mimeType}"/>`);
              zip.file('[Content_Types].xml', contentTypesXml);
            }

            // 2. Add image to zip
            const imageFileName = `media/image_sig_${user.id}_${Date.now()}.${ext}`;
            zip.file('word/' + imageFileName, activeSigBuffer);

            // 3. Add relationship in word/_rels/document.xml.rels
            const relsPath = 'word/_rels/document.xml.rels';
            let relsXml = await zip.file(relsPath).async('text');
            
            let maxId = 0;
            const rIdRegex = /Id="rId(\d+)"/g;
            let match;
            while ((match = rIdRegex.exec(relsXml)) !== null) {
              const id = parseInt(match[1]);
              if (id > maxId) maxId = id;
            }
            const nextRId = `rId${maxId + 1}`;

            const newRel = `<Relationship Id="${nextRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${imageFileName}"/>`;
            relsXml = relsXml.replace('</Relationships>', `${newRel}</Relationships>`);
            zip.file(relsPath, relsXml);

            // 4. Modify word/document.xml to insert drawing run above user name
            let docXml = await zip.file('word/document.xml').async('text');
            
            // Width: 100pt, Height: 60pt
            const cx = 100 * 12700;
            const cy = 60 * 12700;

            const imageDrawingXml = `<w:drawing>
              <wp:inline distT="0" distB="0" distL="0" distR="0">
                <wp:extent cx="${cx}" cy="${cy}"/>
                <wp:effectExtent l="0" t="0" r="0" b="0"/>
                <wp:docPr id="${Math.floor(Math.random() * 10000)}" name="Signature_${nextRId}"/>
                <wp:cNvGraphicFramePr>
                  <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
                </wp:cNvGraphicFramePr>
                <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                  <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                    <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                      <pic:nvPicPr>
                        <pic:cNvPr id="${Math.floor(Math.random() * 10000)}" name="Signature_${nextRId}"/>
                        <pic:cNvPicPr/>
                      </pic:nvPicPr>
                      <pic:blipFill>
                        <a:blip r:embed="${nextRId}"/>
                        <a:stretch>
                          <a:fillRect/>
                        </a:stretch>
                      </pic:blipFill>
                      <pic:spPr>
                        <a:xfrm>
                          <a:off x="0" y="0"/>
                          <a:ext cx="${cx}" cy="${cy}"/>
                        </a:xfrm>
                        <a:prstGeom prst="rect">
                          <a:avLst/>
                        </a:prstGeom>
                      </pic:spPr>
                    </pic:pic>
                  </a:graphicData>
                </a:graphic>
              </wp:inline>
            </w:drawing>`;

            // Paragraph run containing the drawing
            const newParagraphXml = `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r>${imageDrawingXml}</w:r></w:p>`;

            // Check if name is present in document paragraphs
            const targetName = user.name || '';
            const parts = docXml.split('</w:p>');
            let modified = false;
            
            const normalizedName = targetName.toLowerCase();
            const placeholderStr = `[firma_${updateData.verifier1 ? 'verificador_1' : updateData.verifier2 ? 'verificador_2' : 'verificador_3'}]`;
            
            for (let i = 0; i < parts.length - 1; i++) {
              const pContent = parts[i];
              const pStartIdx = pContent.lastIndexOf('<w:p');
              if (pStartIdx !== -1) {
                const pBody = pContent.slice(pStartIdx);
                const plainText = pBody.replace(/<[^>]+>/g, '').trim().toLowerCase();
                
                if (
                  (normalizedName && plainText.includes(normalizedName)) || 
                  plainText.includes(placeholderStr.toLowerCase()) ||
                  plainText.includes('[firma]')
                ) {
                  const beforeP = pContent.slice(0, pStartIdx);
                  const originalP = pContent.slice(pStartIdx);
                  
                  parts[i] = beforeP + newParagraphXml + originalP;
                  modified = true;
                  break;
                }
              }
            }

            if (modified) {
              docXml = parts.join('</w:p>');
            } else {
              // Fallback: append signature at the end of body
              docXml = docXml.replace('</w:body>', `${newParagraphXml}</w:body>`);
              modified = true;
            }

            if (modified) {
              zip.file('word/document.xml', docXml);
              fileBuffer = await zip.generateAsync({ type: 'nodebuffer' });
              console.log('Successfully stamped signature inline or at the end of the Word document!');
            }
          } catch (err) {
            console.error('Error during inline docx stamping:', err);
          }
        }
      }

      // 3. Write/Upload modified file buffer
      if (supabase) {
        const { error: uploadError } = await supabase.storage.from('files').upload(diskFileName, fileBuffer, {
          upsert: true,
          contentType: node.mimeType || 'application/octet-stream'
        });
        if (uploadError) {
          throw new Error('No se pudo subir el archivo firmado a Supabase: ' + uploadError.message);
        }
      } else {
        const uploadDir = path.join(process.cwd(), 'uploads');
        const filePath = path.join(uploadDir, diskFileName);
        fs.writeFileSync(filePath, fileBuffer);
      }

      // Add file size to updateData
      updateData.size = fileBuffer.length;
    }

    // Save update
    const updatedNode = await db.node.update({
      where: { id: fileId },
      data: updateData
    });

    // If this is an Area Document, update Signature status, Document status, and log Audit
    if (doc) {
      const userSignature = doc.signatures.find(s => s.userId === user.id);
      if (userSignature) {
        await db.signature.update({
          where: { id: userSignature.id },
          data: {
            status: 'APROBADO',
            signedAt: new Date(),
            pageNumber: pageSigned,
            coordX: coordX,
            coordY: coordY,
            ipAddress: clientIp
          }
        });
      }

      // Recalculate document status
      const allSigs = await db.signature.findMany({
        where: { documentId: doc.id }
      });
      const pendingSigs = allSigs.filter(s => s.status !== 'APROBADO');

      const newDocStatus = pendingSigs.length === 0 ? 'APROBADO' : 'EN_PROCESO';

      await db.document.update({
        where: { id: doc.id },
        data: { status: newDocStatus }
      });

      // Log Audit Trail
      let fileHash = '';
      if (typeof fileBuffer !== 'undefined' && fileBuffer) {
        fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      } else {
        try {
          let buf: Buffer | null = null;
          if (supabase) {
            const { data } = await supabase.storage.from('files').download(diskFileName);
            if (data) buf = Buffer.from(await data.arrayBuffer());
          } else {
            const uploadDir = path.join(process.cwd(), 'uploads');
            const filePath = path.join(uploadDir, diskFileName);
            if (fs.existsSync(filePath)) buf = fs.readFileSync(filePath);
          }
          if (buf) {
            fileHash = crypto.createHash('sha256').update(buf).digest('hex');
          }
        } catch (err) {
          console.error('Error computing hash for audit:', err);
        }
      }

      await db.audit.create({
        data: {
          username: user.username,
          action: 'FIRMAR_DOCUMENTO',
          detail: JSON.stringify({
            message: `Firmó el documento "${node.name}" en el área "${doc.area.name}" (Estado: ${newDocStatus})`,
            documentName: node.name,
            action: 'FIRMAR_DOCUMENTO',
            ip: clientIp,
            status: newDocStatus,
            sha256: fileHash,
            timestamp: new Date(),
            signerName: user.name,
            cargo: user.cargo || (user.role === 'ADMIN' ? 'Gerente General' : (user.role === 'VERIFIER' ? 'Verificador de Control' : 'Creador')),
            email: user.email || `${user.username}@asepsis.pe`,
            page: pageSigned,
            x: coordX,
            y: coordY
          })
        }
      });
    }

    const finalNode = await db.node.findUnique({
      where: { id: fileId },
      include: {
        document: {
          include: {
            signatures: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Firma registrada con éxito.',
      node: finalNode || updatedNode
    });

  } catch (error: any) {
    console.error('Error during file verification:', error);
    return NextResponse.json({ error: 'Error interno en el servidor: ' + error.message }, { status: 500 });
  }
}
