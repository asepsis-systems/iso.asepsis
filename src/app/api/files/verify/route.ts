import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth-helpers';
import { supabase } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

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

      const updatedNode = await db.node.update({
        where: { id: fileId },
        data: updateData
      });

      return NextResponse.json({
        success: true,
        message: 'Tu firma ha sido removida con éxito.',
        node: updatedNode
      });
    }

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
    let updateData: any = {};
    if (!node.verifier1) {
      updateData.verifier1 = user.name;
    } else if (!node.verifier2) {
      updateData.verifier2 = user.name;
    } else if (!node.verifier3) {
      updateData.verifier3 = user.name;
    } else {
      return NextResponse.json({ error: 'Este documento ya está completamente verificado (3/3 firmas).' }, { status: 400 });
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

    const fileLower = node.name.toLowerCase();
    const isPdf = fileLower.endsWith('.pdf');
    const isDocx = fileLower.endsWith('.docx');

    if (isPdf || isDocx) {
      // 1. Download/Read original file buffer
      let fileBuffer: Buffer;
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

      // 2. Perform stamping
      if (isPdf) {
        if (placement || (annotations && annotations.length > 0)) {
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
                  const sigW = 100;
                  const sigH = 60;

                  const targetX = (placement.x / 100) * width;
                  const targetY = (placement.y / 100) * height;

                  targetPage.drawImage(img, {
                    x: Math.max(0, Math.min(targetX - sigW / 2, width - sigW)),
                    y: Math.max(0, Math.min(targetY - sigH / 2, height - sigH)),
                    width: sigW,
                    height: sigH
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

    return NextResponse.json({
      success: true,
      message: 'Firma registrada con éxito.',
      node: updatedNode
    });

  } catch (error: any) {
    console.error('Error during file verification:', error);
    return NextResponse.json({ error: 'Error interno en el servidor: ' + error.message }, { status: 500 });
  }
}
