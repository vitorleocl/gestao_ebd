import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/config';

export interface UploadProgressCallback {
  (progress: number): void;
}

export async function uploadReceiptImage(
  file: File,
  onProgress?: UploadProgressCallback
): Promise<{ downloadUrl: string; fileName: string }> {
  // Generate unique file path
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `receipts/${timestamp}_${sanitizedName}`;
  const storageRef = ref(storage, path);

  try {
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type || 'image/jpeg',
      customMetadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString()
      }
    });

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) {
            onProgress(Math.round(progress));
          }
        },
        (error) => {
          console.error("Erro no upload do Firebase Storage:", error);
          // Fallback to base64 data URL if storage bucket fails/rules limit
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              downloadUrl: reader.result as string,
              fileName: file.name
            });
          };
          reader.onerror = () => reject(error);
          reader.readAsDataURL(file);
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            resolve({
              downloadUrl,
              fileName: file.name
            });
          } catch (urlErr) {
            console.warn("Falha ao obter URL de download, usando fallback local:", urlErr);
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                downloadUrl: reader.result as string,
                fileName: file.name
              });
            };
            reader.readAsDataURL(file);
          }
        }
      );
    });
  } catch (err) {
    console.warn("Erro ao iniciar upload, utilizando leitor local:", err);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          downloadUrl: reader.result as string,
          fileName: file.name
        });
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  }
}
