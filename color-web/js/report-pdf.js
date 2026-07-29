(function initializeReportPdf(global) {
    'use strict';

    async function downloadImageAsPdf(imagePath, fileName) {
        if (!global.jspdf || !global.jspdf.jsPDF) {
            throw new Error('PDF 元件尚未載入');
        }

        const response = await fetch(imagePath, { cache: 'force-cache' });
        if (!response.ok) {
            throw new Error(`找不到站內報告素材：HTTP ${response.status}`);
        }

        const imageBlob = await response.blob();
        const imageDataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('無法讀取報告素材'));
            reader.readAsDataURL(imageBlob);
        });

        const imageSize = await new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
            image.onerror = () => reject(new Error('報告素材格式無法辨識'));
            image.src = imageDataUrl;
        });

        const orientation = imageSize.width > imageSize.height ? 'landscape' : 'portrait';
        const pdf = new global.jspdf.jsPDF({
            orientation,
            unit: 'mm',
            format: 'a4',
            compress: true
        });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imageRatio = imageSize.width / imageSize.height;
        const pageRatio = pageWidth / pageHeight;
        let renderWidth = pageWidth;
        let renderHeight = pageHeight;

        if (imageRatio > pageRatio) {
            renderHeight = pageWidth / imageRatio;
        } else {
            renderWidth = pageHeight * imageRatio;
        }

        const offsetX = (pageWidth - renderWidth) / 2;
        const offsetY = (pageHeight - renderHeight) / 2;
        pdf.addImage(imageDataUrl, 'PNG', offsetX, offsetY, renderWidth, renderHeight, undefined, 'FAST');

        const pdfBlob = pdf.output('blob');
        const downloadUrl = URL.createObjectURL(pdfBlob);
        const downloadLink = document.createElement('a');
        downloadLink.href = downloadUrl;
        downloadLink.download = fileName;
        downloadLink.hidden = true;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

        return { fileName, size: pdfBlob.size, type: pdfBlob.type };
    }

    global.ColorLabReportPdf = Object.freeze({ downloadImageAsPdf });
})(window);
