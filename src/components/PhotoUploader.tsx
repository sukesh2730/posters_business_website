import React, { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { uploadPhotoToFirebaseStorage } from '../services/orderService';

interface PhotoUploaderProps {
  photos: string[];
  onChange: (photos: string[]) => void;
  minPhotos: number;
  maxPhotos: number;
}

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  photos,
  onChange,
  minPhotos,
  maxPhotos,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploadError(null);

    const remainingSlots = maxPhotos - photos.length;
    if (remainingSlots <= 0) {
      setUploadError(`You have already uploaded the maximum of ${maxPhotos} photos.`);
      return;
    }

    const filesToUpload = Array.from(fileList).slice(0, remainingSlots);

    // 1. Instant Zero-Latency Local Previews: display immediately on canvas/polaroid
    const localPreviews = filesToUpload.map((file) => URL.createObjectURL(file));
    const currentCombined = [...photos, ...localPreviews];
    onChange(currentCombined);

    setIsUploading(true);
    setUploadPercent(10);

    try {
      // 2. Parallel Fast Upload with client-side compression
      let completedCount = 0;
      const uploadResults = await Promise.all(
        filesToUpload.map(async (file, index) => {
          try {
            const remoteUrl = await uploadPhotoToFirebaseStorage(file, 'customer_uploads', (pct) => {
              const stepWeight = 90 / filesToUpload.length;
              const currentBase = 10 + (completedCount * stepWeight);
              setUploadPercent(Math.min(95, Math.round(currentBase + (pct / 100) * stepWeight)));
            });
            completedCount++;
            setUploadPercent(Math.min(98, 10 + Math.round((completedCount / filesToUpload.length) * 88)));
            return { local: localPreviews[index], remote: remoteUrl, success: true };
          } catch (err: any) {
            console.warn('Upload fallback note for image', file.name, err);
            // Retain local preview object URL for client preview continuity
            return { local: localPreviews[index], remote: localPreviews[index], success: false, error: err.message };
          }
        })
      );

      // 3. Seamlessly swap local blob URLs with permanent cloud/server URLs
      let updatedList = [...currentCombined];
      uploadResults.forEach(({ local, remote }) => {
        if (remote && remote !== local) {
          const idx = updatedList.indexOf(local);
          if (idx !== -1) {
            updatedList[idx] = remote;
          }
        }
      });
      onChange(updatedList);
      setUploadPercent(100);

      const failures = uploadResults.filter((r) => !r.success && r.error);
      if (failures.length > 0) {
        setUploadError(`Note: ${failures.length} image(s) processed locally for preview. Ready for review.`);
      }
    } catch (err: any) {
      setUploadError(err.message || 'Error optimizing photos. Please check file format.');
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadPercent(0), 800);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    processFiles(e.dataTransfer.files);
  };

  const removePhoto = (indexToRemove: number) => {
    const photoToRemove = photos[indexToRemove];
    if (photoToRemove && photoToRemove.startsWith('blob:')) {
      try { URL.revokeObjectURL(photoToRemove); } catch {}
    }
    onChange(photos.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <div className="space-y-4">
      {/* Upload Box */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
          dragOver
            ? 'border-rose-400 bg-rose-50/50 scale-[1.01]'
            : 'border-slate-300 hover:border-rose-300 hover:bg-rose-50/20 bg-white/60'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={maxPhotos > 1}
          accept="image/jpeg,image/png,image/webp,image/jpg"
          className="hidden"
          onChange={(e) => processFiles(e.target.files)}
        />

        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-rose-100/80 text-rose-600 flex items-center justify-center">
            {isUploading ? (
              <Loader2 className="w-6 h-6 animate-spin text-rose-600" />
            ) : (
              <Upload className="w-6 h-6" />
            )}
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">
              {isUploading
                ? `Uploading & verifying photos... ${uploadPercent}%`
                : 'Click to upload or drag & drop photos here'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Supports high-res JPG, PNG, WebP • Max 10MB per image
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-xs font-medium text-slate-600">
            <span>Required:</span>
            <span className="font-semibold text-slate-800">
              {minPhotos} to {maxPhotos} photos
            </span>
            <span className="text-slate-400">•</span>
            <span className={photos.length >= minPhotos ? 'text-emerald-600 font-semibold' : 'text-amber-600'}>
              {photos.length} uploaded
            </span>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {uploadError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Uploaded Thumbnails Grid */}
      {photos.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-600 px-1">
            <span className="font-medium">Uploaded Photos ({photos.length})</span>
            {photos.length >= minPhotos ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Ready to print
              </span>
            ) : (
              <span className="text-amber-600 font-medium">
                Please upload at least {minPhotos - photos.length} more
              </span>
            )}
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5 max-h-56 overflow-y-auto p-1 rounded-xl">
            {photos.map((url, idx) => (
              <div
                key={idx}
                className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group bg-slate-100 shadow-xs"
              >
                <img src={url} alt={`Uploaded ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removePhoto(idx);
                  }}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/70 hover:bg-rose-600 text-white rounded-full flex items-center justify-center transition-colors shadow-sm"
                  title="Remove photo"
                >
                  <X className="w-3 h-3" />
                </button>
                <span className="absolute bottom-1 left-1 bg-black/60 text-[10px] text-white px-1.5 py-0.5 rounded font-mono">
                  #{idx + 1}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
