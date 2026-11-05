// Reduce fotos antes de subirlas a Storage (comprobantes de voluntariado, imágenes de inscripción).
export const compressImageFile = async (file, options = {}) => {
  if (!file || !file.type.startsWith('image/')) return file;

  const {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.8,
  } = options;

  return new Promise((resolve) => {
    const image = new Image();
    const src = URL.createObjectURL(file);

    image.onload = () => {
      const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');

      if (!context) {
        URL.revokeObjectURL(src);
        resolve(file);
        return;
      }

      context.drawImage(image, 0, 0, width, height);

      canvas.toBlob((blob) => {
        URL.revokeObjectURL(src);
        if (!blob) {
          resolve(file);
          return;
        }

        const safeBaseName = (file.name || 'evidencia').replace(/\.[^/.]+$/, '');
        const compressedFile = new File([blob], `${safeBaseName}-compressed.jpg`, { type: 'image/jpeg' });
        resolve(compressedFile);
      }, 'image/jpeg', quality);
    };

    image.onerror = () => {
      URL.revokeObjectURL(src);
      resolve(file);
    };

    image.src = src;
  });
};
