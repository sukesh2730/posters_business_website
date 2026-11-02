import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  X, 
  Image as ImageIcon, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  RefreshCw, 
  Sparkles,
  AlertTriangle,
  ShieldCheck
} from 'lucide-react';
import { uploadPhotoPersistently } from '../services/persistentStorage';
import { 
  createInstantPreview, 
  revokePreview, 
  inspectImageDimensions, 
  estimatePrintQuality,
  PrintQualityAssessment 
} from '../utils/imageOptimization';
import { DEFAULT_FALLBACK_PRODUCT_IMAGE } from '../services/orderService';

export type UploadStage = 
  | 'idle' 
  | 'selected' 
  | 'optimizing' 
  | 'uploading' 
  | 'saving' 
  | 'success' 
  | 'error';

interface UploadItemState {
  id: string;
  file: File;
  previewUrl: string;
  permanentUrl: string | null;
  stage: UploadStage;
  stageText: string;
  progressPercent: number;
  error: string | null;
  quality?: PrintQualityAssessment;
}

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
  const [items, setItems] = useState<UploadItemState[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [overallStage, setOverallStage] = useState<UploadStage>('idle');
  const [overallStageText, setOverallStageText] = useState<string>('');
  const [overallProgress, setOverallProgress] = useState<number>(0);
  const [quotaWarning, setQuotaWarning] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up any remaining object URLs on unmount
  useEffect(() => {
    return () => {
      items.forEach((item) => {
        revokePreview(item.previewUrl);
      });
    };
  }, []);

  /**
   * Upload worker for an individual item with stage tracking
   */
  const processSingleFile = async (
    item: UploadItemState,
    updateItem: (id: string, updates: Partial<UploadItemState>) => void
  ): Promise<{ permanentUrl: string | null; error: string | null }> => {
    try {
      // Stage 2: Optimizing
      updateItem(item.id, {
        stage: 'optimizing',
        stageText: 'Optimizing image...',
        progressPercent: 20,
      });

      // DPI estimation
      const dims = await inspectImageDimensions(item.file);
      const quality = estimatePrintQuality(dims.width, dims.height);
      updateItem(item.id, { quality });

      // Stage 3 & 4: Uploading & Saving securely
      const result = await uploadPhotoPersistently(item.file, {
        onStageChange: (stageDesc) => {
          if (stageDesc.toLowerCase().includes('saving')) {
            updateItem(item.id, { stage: 'saving', stageText: 'Saving securely...', progressPercent: 80 });
          } else if (stageDesc.toLowerCase().includes('upload')) {
            updateItem(item.id, { stage: 'uploading', stageText: 'Uploading photo...', progressPercent: 60 });
          } else {
            updateItem(item.id, { stage: 'optimizing', stageText: stageDesc, progressPercent: 35 });
          }
        },
        onProgress: (pct) => {
          updateItem(item.id, { progressPercent: pct });
        },
      });

      // Stage 5: Success
      updateItem(item.id, {
        stage: 'success',
        stageText: 'Uploaded successfully',
        permanentUrl: result.url,
        progressPercent: 100,
        error: null,
      });

      return { permanentUrl: result.url, error: null };
    } catch (err: any) {
      // Stage 6: Error (keep preview intact for retry)
      updateItem(item.id, {
        stage: 'error',
        stageText: 'Upload failed',
        error: err.message || 'Failed to securely upload photo.',
        progressPercent: 0,
      });
      return { permanentUrl: null, error: err.message };
    }
  };

  /**
   * Main file processing queue
   */
  const processFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const remainingSlots = maxPhotos - photos.length;
    if (remainingSlots <= 0) {
      setQuotaWarning(`You have already uploaded the maximum allowed limit of ${maxPhotos} photos.`);
      setTimeout(() => setQuotaWarning(null), 4000);
      return;
    }

    const selectedFiles = Array.from(fileList).slice(0, remainingSlots);

    // 1. STAGE 1: Selected / Instant Zero-Latency Local Preview
    const newItems: UploadItemState[] = selectedFiles.map((file) => {
      const previewUrl = createInstantPreview(file);
      return {
        id: `upl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        file,
        previewUrl,
        permanentUrl: null,
        stage: 'selected',
        stageText: 'Selected / Previewing',
        progressPercent: 10,
        error: null,
      };
    });

    // Immediately display local preview URLs in consumer UI without waiting
    const immediatePhotos = [...photos, ...newItems.map((it) => it.previewUrl)];
    onChange(immediatePhotos);

    setItems((prev) => [...prev, ...newItems]);
    setIsProcessing(true);
    setOverallStage('selected');
    setOverallStageText('Selected / Previewing');
    setOverallProgress(10);

    const updateItemState = (id: string, updates: Partial<UploadItemState>) => {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, ...updates } : it))
      );
    };

    // 2. Controlled Background Upload
    setOverallStage('optimizing');
    setOverallStageText('Optimizing images...');
    setOverallProgress(30);

    let completed = 0;
    const finalPhotoList = [...immediatePhotos];

    for (const item of newItems) {
      setOverallStage('uploading');
      setOverallStageText(`Uploading photo ${completed + 1} of ${newItems.length}...`);

      const res = await processSingleFile(item, updateItemState);
      completed++;
      setOverallProgress(Math.round((completed / newItems.length) * 100));

      if (res.permanentUrl) {
        // Swap out temporary blob preview with durable URL
        const idx = finalPhotoList.indexOf(item.previewUrl);
        if (idx !== -1) {
          finalPhotoList[idx] = res.permanentUrl;
          onChange([...finalPhotoList]);
        }
        // Safely revoke temporary blob
        revokePreview(item.previewUrl);
      }
    }

    setIsProcessing(false);
    setOverallStage('success');
    setOverallStageText('All photos uploaded successfully');
    setTimeout(() => {
      setOverallStage('idle');
      setOverallProgress(0);
    }, 1500);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Retry an individual failed item
   */
  const handleRetryItem = async (itemId: string) => {
    const item = items.find((it) => it.id === itemId);
    if (!item) return;

    const updateItemState = (id: string, updates: Partial<UploadItemState>) => {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, ...updates } : it))
      );
    };

    setIsProcessing(true);
    const res = await processSingleFile(item, updateItemState);
    setIsProcessing(false);

    if (res.permanentUrl) {
      const currentList = [...photos];
      const idx = currentList.indexOf(item.previewUrl);
      if (idx !== -1) {
        currentList[idx] = res.permanentUrl;
        onChange(currentList);
      }
      revokePreview(item.previewUrl);
    }
  };

  /**
   * Remove photo and revoke local blob
   */
  const handleRemovePhoto = (photoUrlToRemove: string, indexToRemove: number) => {
    revokePreview(photoUrlToRemove);
    setItems((prev) => prev.filter((it) => it.previewUrl !== photoUrlToRemove && it.permanentUrl !== photoUrlToRemove));
    onChange(photos.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <div className="space-y-4">
      {/* Maximum Photo Limit Notice */}
      {quotaWarning && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{quotaWarning}</span>
        </div>
      )}

      {/* Upload Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          processFiles(e.dataTransfer.files);
        }}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
          dragOver
            ? 'border-rose-400 bg-rose-50/50 scale-[1.01]'
            : 'border-slate-300 hover:border-rose-300 hover:bg-rose-50/20 bg-white/60'
        } ${isProcessing ? 'pointer-events-none opacity-90' : ''}`}
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
          <div className="w-12 h-12 rounded-full bg-rose-100/80 text-rose-600 flex items-center justify-center transition-transform group-hover:scale-105">
            {isProcessing ? (
              <Loader2 className="w-6 h-6 animate-spin text-rose-600" />
            ) : (
              <Upload className="w-6 h-6" />
            )}
          </div>

          <div>
            <p className="font-semibold text-slate-800 text-sm">
              {isProcessing ? (
                <span className="flex items-center gap-1.5 justify-center">
                  <span>{overallStageText || 'Uploading photos...'}</span>
                  <span className="text-rose-600 font-mono font-bold">({overallProgress}%)</span>
                </span>
              ) : (
                'Click to upload or drag & drop photos here'
              )}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Instant local preview • Auto-compressed • Fast durable storage
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

        {/* Global Progress Bar during active upload */}
        {isProcessing && (
          <div className="mt-4 w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-rose-600 h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.max(5, overallProgress)}%` }}
            />
          </div>
        )}
      </div>

      {/* Uploaded Photos Grid with Status & Quality Badges */}
      {photos.length > 0 && (
        <div className="space-y-3">
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

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {photos.map((url, idx) => {
              const matchedItem = items.find(
                (it) => it.previewUrl === url || it.permanentUrl === url
              );
              const isBlob = url.startsWith('blob:');
              const hasError = matchedItem?.stage === 'error';
              const isUploadingThis = isBlob && matchedItem?.stage !== 'error';

              return (
                <div
                  key={`${url}_${idx}`}
                  className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100 group shadow-xs transition-all hover:shadow-md"
                >
                  <img
                    src={url}
                    alt={`Uploaded photo ${idx + 1}`}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = DEFAULT_FALLBACK_PRODUCT_IMAGE;
                    }}
                    className="w-full h-full object-cover"
                  />

                  {/* Uploading overlay */}
                  {isUploadingThis && (
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex flex-col items-center justify-center text-white p-2 text-center">
                      <Loader2 className="w-5 h-5 animate-spin text-white mb-1" />
                      <span className="text-[10px] font-medium leading-tight">
                        {matchedItem?.stageText || 'Saving...'}
                      </span>
                    </div>
                  )}

                  {/* Failed Upload Overlay with Retry Button */}
                  {hasError && (
                    <div className="absolute inset-0 bg-rose-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-white p-2 text-center">
                      <AlertCircle className="w-5 h-5 text-rose-300 mb-1" />
                      <span className="text-[10px] font-semibold text-rose-200 leading-tight line-clamp-2 mb-1.5">
                        {matchedItem?.error || 'Upload failed'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (matchedItem) handleRetryItem(matchedItem.id);
                        }}
                        className="px-2 py-0.5 bg-white text-rose-700 rounded-full text-[10px] font-bold shadow-sm hover:bg-rose-50 flex items-center gap-1 active:scale-95 transition-transform"
                      >
                        <RefreshCw className="w-2.5 h-2.5" /> Retry
                      </button>
                    </div>
                  )}

                  {/* Low Resolution / DPI Warning Badge (Non-blocking) */}
                  {matchedItem?.quality?.quality === 'low' && !hasError && (
                    <div 
                      className="absolute bottom-1 inset-x-1 bg-amber-500/90 text-white rounded px-1.5 py-0.5 text-[9px] font-medium flex items-center gap-1 shadow-xs"
                      title={matchedItem.quality.warning || 'Lower resolution image'}
                    >
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span className="truncate">Low Res (~{matchedItem.quality.estimatedDpi} DPI)</span>
                    </div>
                  )}

                  {/* Archival Quality Badge */}
                  {matchedItem?.quality?.quality === 'archival' && !hasError && (
                    <div 
                      className="absolute bottom-1 left-1 bg-emerald-600/90 text-white rounded px-1.5 py-0.5 text-[9px] font-bold flex items-center gap-0.5 shadow-xs"
                      title="Archival 300+ DPI quality image"
                    >
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>300 DPI</span>
                    </div>
                  )}

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemovePhoto(url, idx);
                    }}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-rose-600 text-white rounded-full flex items-center justify-center transition-colors shadow-sm"
                    title="Remove photo"
                  >
                    <X className="w-3 h-3" />
                  </button>

                  {/* Index badge */}
                  <span className="absolute top-1 left-1 bg-black/60 text-[10px] text-white px-1.5 py-0.5 rounded font-mono">
                    #{idx + 1}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
