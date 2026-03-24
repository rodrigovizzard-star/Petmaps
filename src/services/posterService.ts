import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, db } from '../services/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Pet } from '../types';
import { getTranslation } from '../utils/translations';

export const posterService = {
  async generatePosters(pet: Pet, countryCode?: string): Promise<{ whatsapp: Blob; pdf: Blob }> {
    console.log('posterService: Iniciando geração de cartazes para pet:', pet.id);
    const publicUrl = `${window.location.origin}/pet/${pet.petId || pet.id}`;
    
    // Rule: Always use photo number 1 (first in imageUrls array, or fallback to imageUrl)
    const petImageUrl = (pet.imageUrls && pet.imageUrls.length > 0) ? pet.imageUrls[0] : pet.imageUrl;
    
    let qrCodeDataUrl = '';
    try {
      qrCodeDataUrl = await QRCode.toDataURL(publicUrl, {
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
    } catch (err) {
      console.error('posterService: Erro ao gerar QR Code:', err);
      throw new Error('Falha ao gerar QR Code');
    }

    // Pre-load pet image as base64 to avoid CORS issues during html2canvas render
    let petImageBase64 = '';
    if (petImageUrl) {
      try {
        petImageBase64 = await this.getBase64Image(petImageUrl);
      } catch (err) {
        console.warn('posterService: Falha ao carregar imagem do pet como base64, usando URL original:', err);
        petImageBase64 = petImageUrl;
      }
    }

    try {
      // Wait for fonts to be ready
      if (document.fonts) {
        await document.fonts.ready;
      }

      const whatsappBlob = await this.renderPosterToBlob(pet, qrCodeDataUrl, petImageBase64, 'story', countryCode);
      const pdfBlob = await this.renderPosterToPdfBlob(pet, qrCodeDataUrl, petImageBase64, countryCode);

      return { whatsapp: whatsappBlob, pdf: pdfBlob };
    } catch (err) {
      console.error('posterService: Erro durante a geração dos cartazes:', err);
      throw err;
    }
  },

  async generateAndUploadPosters(pet: Pet, countryCode?: string) {
    console.log('posterService: Iniciando geração e upload de cartazes para pet:', pet.id);
    const publicUrl = `${window.location.origin}/pet/${pet.petId || pet.id}`;
    
    const petImageUrl = (pet.imageUrls && pet.imageUrls.length > 0) ? pet.imageUrls[0] : pet.imageUrl;

    let qrCodeDataUrl = '';
    try {
      qrCodeDataUrl = await QRCode.toDataURL(publicUrl, {
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      console.log('posterService: QR Code gerado com sucesso');
    } catch (err) {
      console.error('posterService: Erro ao gerar QR Code:', err);
      throw new Error('Falha ao gerar QR Code');
    }

    // Pre-load pet image as base64
    let petImageBase64 = '';
    if (petImageUrl) {
      try {
        petImageBase64 = await this.getBase64Image(petImageUrl);
      } catch (err) {
        console.warn('posterService: Falha ao carregar imagem do pet como base64:', err);
        petImageBase64 = petImageUrl;
      }
    }

    try {
      // Wait for fonts
      if (document.fonts) {
        await document.fonts.ready;
      }

      console.log('posterService: Gerando versão Story...');
      const storyBlob = await this.renderPosterToBlob(pet, qrCodeDataUrl, petImageBase64, 'story', countryCode);
      console.log('posterService: Uploading Story poster...');
      const storyUrl = await this.uploadFile(storyBlob, `posters/${pet.id}/story.png`);

      console.log('posterService: Gerando versão PDF...');
      const pdfBlob = await this.renderPosterToPdfBlob(pet, qrCodeDataUrl, petImageBase64, countryCode);
      console.log('posterService: Uploading PDF poster...');
      const pdfUrl = await this.uploadFile(pdfBlob, `posters/${pet.id}/poster.pdf`);

      console.log('posterService: Atualizando Firestore...');
      const petRef = doc(db, 'pets', pet.id);
      await updateDoc(petRef, {
        posterStoryUrl: storyUrl,
        posterPdfUrl: pdfUrl,
      });

      console.log('posterService: Processo concluído com sucesso!');
      return { storyUrl, pdfUrl };
    } catch (err) {
      console.error('posterService: Erro durante a geração/upload:', err);
      throw err;
    }
  },

  async renderPosterToBlob(pet: Pet, qrCode: string, petImage: string, type: 'story', countryCode?: string): Promise<Blob> {
    const width = 1080;
    const height = 1920;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('Não foi possível obter o contexto do canvas');

    // 1. Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // 2. Red Border
    const borderSize = 24;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = borderSize * 2;
    ctx.strokeRect(0, 0, width, height);

    // 3. Header Box
    const headerMargin = 60;
    const headerHeight = 220;
    ctx.fillStyle = '#ef4444';
    this.roundRect(ctx, headerMargin, headerMargin, width - (headerMargin * 2), headerHeight, 20);
    ctx.fill();

    // 4. Header Text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 140px Arial';
    ctx.fillText('PET PERDIDO', width / 2, headerMargin + (headerHeight / 2) + 50);

    // 5. Pet Image
    const imgSize = 750;
    const imgY = headerMargin + headerHeight + 40;
    const imgX = (width - imgSize) / 2;

    // Image Shadow/Border
    ctx.fillStyle = '#f3f4f6';
    this.roundRect(ctx, imgX, imgY, imgSize, imgSize, 40);
    ctx.fill();

    if (petImage) {
      try {
        const img = await this.loadImage(petImage);
        ctx.save();
        this.roundRect(ctx, imgX, imgY, imgSize, imgSize, 40);
        ctx.clip();
        
        // Cover logic for image
        const imgRatio = img.width / img.height;
        const canvasRatio = 1; // Square
        let drawWidth, drawHeight, drawX, drawY;

        if (imgRatio > canvasRatio) {
          drawHeight = imgSize;
          drawWidth = imgSize * imgRatio;
          drawX = imgX - (drawWidth - imgSize) / 2;
          drawY = imgY;
        } else {
          drawWidth = imgSize;
          drawHeight = imgSize / imgRatio;
          drawX = imgX;
          drawY = imgY - (drawHeight - imgSize) / 2;
        }
        
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        ctx.restore();
      } catch (e) {
        ctx.fillStyle = '#9ca3af';
        ctx.font = '40px Arial';
        ctx.fillText('Sem Foto', width / 2, imgY + (imgSize / 2));
      }
    }

    // 6. Pet Name
    const textY = imgY + imgSize + 80;
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 90px Arial';
    ctx.fillText((pet.name || 'PET SEM NOME').toUpperCase(), width / 2, textY);

    // 7. Last Seen
    ctx.fillStyle = '#4b5563';
    ctx.font = 'bold 45px Arial';
    const lastSeenText = getTranslation('lastSeen', countryCode);
    ctx.fillText(`${lastSeenText}: ${pet.city}`, width / 2, textY + 75);

    // 8. Observations
    if (pet.lostObservations) {
      ctx.fillStyle = '#374151';
      ctx.font = '32px Arial';
      const words = pet.lostObservations.split(' ');
      let line = '';
      let currentY = textY + 130;
      const maxWidth = 900;

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
          ctx.fillText(line, width / 2, currentY);
          line = words[n] + ' ';
          currentY += 45;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, width / 2, currentY);
    }

    // 9. Contact Box
    const contactY = height - 450;
    const contactWidth = 800;
    const contactHeight = 100;
    ctx.fillStyle = '#ef4444';
    this.roundRect(ctx, (width - contactWidth) / 2, contactY, contactWidth, contactHeight, 30);
    ctx.fill();
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px Arial';
    ctx.fillText(`CONTATO: ${pet.contactPhone || 'VER NO PERFIL'}`, width / 2, contactY + 65);

    // 10. Footer Section (QR Code)
    const footerY = height - 280;
    const footerWidth = width - 120;
    const footerHeight = 220;
    ctx.fillStyle = '#f9fafb';
    this.roundRect(ctx, 60, footerY, footerWidth, footerHeight, 30);
    ctx.fill();
    ctx.strokeStyle = '#f3f4f6';
    ctx.lineWidth = 2;
    ctx.stroke();

    // QR Code
    try {
      const qrImg = await this.loadImage(qrCode);
      ctx.drawImage(qrImg, 100, footerY + 20, 180, 180);
    } catch (e) {}

    // QR Text
    ctx.textAlign = 'left';
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 30px Arial';
    ctx.fillText('ESCANEIE O QR CODE', 310, footerY + 70);
    
    ctx.fillStyle = '#6b7280';
    ctx.font = '22px Arial';
    ctx.fillText('Para ver localização e mais fotos', 310, footerY + 110);

    // ID Badge
    ctx.fillStyle = '#fee2e2';
    this.roundRect(ctx, 310, footerY + 140, 300, 50, 10);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`ID: ${pet.petId || pet.id}`, 330, footerY + 175);

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Falha ao converter canvas para blob'));
      }, 'image/png', 0.9);
    });
  },

  // Helper to draw rounded rectangles on canvas
  roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  },

  // Helper to load image as HTMLImageElement
  loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      if (!src.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => resolve(img);
      img.onerror = (e) => {
        console.error('posterService: Erro ao carregar imagem no elemento Image:', src.substring(0, 50) + '...', e);
        reject(e);
      };
      img.src = src;
    });
  },

  async renderPosterToPdfBlob(pet: Pet, qrCode: string, petImage: string, countryCode?: string): Promise<Blob> {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Background Color (Red Header Area)
    pdf.setFillColor(239, 68, 68);
    pdf.rect(0, 0, pageWidth, 45, 'F');

    // Title
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(48);
    pdf.setFont('helvetica', 'bold');
    pdf.text('PET PERDIDO', pageWidth / 2, 30, { align: 'center' });

    // Border
    pdf.setDrawColor(239, 68, 68);
    pdf.setLineWidth(4);
    pdf.rect(2, 2, pageWidth - 4, pageHeight - 4);

    // Pet Image
    if (petImage) {
      try {
        // Use the pre-loaded base64 image
        const imgData = petImage;
        
        // Center image - New dimensions: 141.0mm x 101.898mm
        const imgWidth = 141.0;
        const imgHeight = 101.898;
        const imgX = (pageWidth - imgWidth) / 2;
        const imgY = 55;
        
        // Shadow-like effect
        pdf.setDrawColor(243, 244, 246);
        pdf.setLineWidth(1);
        pdf.rect(imgX + 1, imgY + 1, imgWidth, imgHeight);
        
        pdf.addImage(imgData, 'JPEG', imgX, imgY, imgWidth, imgHeight, undefined, 'FAST');
        pdf.setDrawColor(255, 255, 255);
        pdf.setLineWidth(2);
        pdf.rect(imgX, imgY, imgWidth, imgHeight);
      } catch (e) {
        console.error('Error adding image to PDF:', e);
        pdf.setDrawColor(209, 213, 219);
        const imgWidth = 141.0;
        const imgHeight = 101.898;
        const imgX = (pageWidth - imgWidth) / 2;
        pdf.rect(imgX, 55, imgWidth, imgHeight);
        pdf.setTextColor(156, 163, 175);
        pdf.setFontSize(20);
        pdf.text('Foto do Pet', pageWidth / 2, 55 + (imgHeight / 2), { align: 'center' });
      }
    } else {
      pdf.setDrawColor(209, 213, 219);
      const imgWidth = 141.0;
      const imgHeight = 101.898;
      const imgX = (pageWidth - imgWidth) / 2;
      pdf.rect(imgX, 55, imgWidth, imgHeight);
      pdf.setTextColor(156, 163, 175);
      pdf.setFontSize(20);
      pdf.text('Sem Foto', pageWidth / 2, 55 + (imgHeight / 2), { align: 'center' });
    }

    // Name - Redistributed position
    pdf.setTextColor(17, 24, 39);
    pdf.setFontSize(36);
    pdf.setFont('helvetica', 'bold');
    pdf.text((pet.name || 'PET SEM NOME').toUpperCase(), pageWidth / 2, 175, { align: 'center' });

    // City - Redistributed position
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(75, 85, 99);
    const lastSeenText = getTranslation('lastSeen', countryCode);
    pdf.text(`${lastSeenText}: ${pet.city}`, pageWidth / 2, 188, { align: 'center' });
    
    // Observations - Redistributed position
    if (pet.lostObservations) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(55, 65, 81);
      const splitText = pdf.splitTextToSize(pet.lostObservations, pageWidth - 40);
      pdf.text(splitText, pageWidth / 2, 198, { align: 'center' });
    }

    // Contact Box
    pdf.setFillColor(239, 68, 68);
    pdf.roundedRect(30, 230, pageWidth - 60, 20, 5, 5, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(22);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`CONTATO: ${pet.contactPhone || 'VER NO PERFIL'}`, pageWidth / 2, 243, { align: 'center' });

    // Footer Area
    pdf.setFillColor(249, 250, 251);
    pdf.rect(10, 255, pageWidth - 20, 35, 'F');
    
    // QR Code
    pdf.addImage(qrCode, 'PNG', 20, 258, 28, 28);

    // QR Info
    pdf.setTextColor(17, 24, 39);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('ESCANEIE O QR CODE', 55, 268);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(107, 114, 128);
    pdf.text('Para ver localização e mais fotos', 55, 275);
    
    // ID Badge
    pdf.setFillColor(254, 226, 226);
    pdf.roundedRect(pageWidth - 65, 265, 50, 12, 2, 2, 'F');
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(239, 68, 68);
    pdf.text(`ID: ${pet.petId || pet.id}`, pageWidth - 40, 273, { align: 'center' });

    return pdf.output('blob');
  },

  async getBase64Image(url: string): Promise<string> {
    if (!url) throw new Error('URL da imagem não fornecida');
    if (url.startsWith('data:')) return url;
    
    try {
      console.log('posterService: Convertendo imagem para base64 via proxy:', url);
      
      // Use our server-side proxy to bypass CORS entirely
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        throw new Error(`Proxy error! status: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.data) {
        return result.data;
      }
      
      throw new Error('Proxy returned no data');
    } catch (err) {
      console.error('posterService: Erro ao converter imagem via proxy, tentando fallback direto:', err);
      
      // Fallback to direct fetch if proxy fails (though proxy is usually more reliable for CORS)
      try {
        const corsUrl = url.includes('firebasestorage.googleapis.com') 
          ? `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`
          : url;

        const response = await fetch(corsUrl, { 
          mode: 'cors',
          cache: 'no-cache',
        });
        
        if (!response.ok) throw new Error(`Direct fetch error! status: ${response.status}`);
        
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Erro ao ler blob da imagem'));
          reader.readAsDataURL(blob);
        });
      } catch (fallbackErr) {
        console.error('posterService: Fallback direto também falhou:', fallbackErr);
        return url; // Return original URL as last resort
      }
    }
  },

  async uploadFile(blob: Blob, path: string): Promise<string> {
    try {
      const fileRef = ref(storage, path);
      await uploadBytes(fileRef, blob);
      return await getDownloadURL(fileRef);
    } catch (storageError: any) {
      console.warn('posterService: Erro no Storage (poster), usando fallback base64:', storageError);
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          if (base64.length > 1000000) {
            reject(new Error('O cartaz gerado é muito grande para o backup.'));
          } else {
            resolve(base64);
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  },
};
