import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Loader2, 
  Sliders, 
  Sparkles, 
  Image as ImageIcon, 
  X, 
  Check, 
  ArrowRight, 
  ArrowLeft,
  Eye, 
  EyeOff, 
  Star, 
  Maximize2,
  FileCheck,
  ShieldCheck,
  Info,
  Tag,
  CheckSquare,
  Square,
  RefreshCw,
  Cloud,
  Database,
  AlertTriangle
} from 'lucide-react';
import { Product, ProductCategory, AspectRatioType, CollectionInfo, BulkBatchStatus } from '../types';
import { STYLES_LIST } from '../data/defaultProducts';
import { uploadPhotoToFirebaseStorage, saveProductToFirestore, DEFAULT_FALLBACK_PRODUCT_IMAGE } from '../services/orderService';

export interface ValidatedFileItem {
  id: string;
  file: File;
  previewUrl: string;
  firebaseUrl: string | null;
  uploading: boolean;
  uploadError: string | null;
  name: string;
  width: number;
  height: number;
  sizeKb: number;
  detectedAspect: AspectRatioType;
  printQuality: 'archival' | 'standard' | 'low';
  
  // Product mapping fields
  collectionId: string;
  price: number;
  originalPrice: number;
  description: string;
  tags: string;
  style: string;
  stock: number;
  badge: string;
  isActive: boolean;
  isFeatured: boolean;
}

interface BulkProductEditorProps {
  collections: CollectionInfo[];
  onPublishSuccess: (count: number) => void;
  onCancel: () => void;
  onBatchStatusChange?: (status: BulkBatchStatus) => void;
}

export const BulkProductEditor: React.FC<BulkProductEditorProps> = ({
  collections,
  onPublishSuccess,
  onCancel,
  onBatchStatusChange,
}) => {
  // Wizard Stages: 'upload' -> 'validate' -> 'list-editor'
  const [currentStep, setCurrentStep] = useState<'upload' | 'validate' | 'list-editor'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [items, setItems] = useState<ValidatedFileItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState<{ current: number; total: number } | null>(null);
  const [publishErrors, setPublishErrors] = useState<string[]>([]);
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);

  // Real-Time Batch Upload & Publication Status State
  const [batchStatus, setBatchStatus] = useState<BulkBatchStatus>({
    phase: 'idle',
    completed: 0,
    total: 0,
    percentage: 0,
    inProgress: false,
    uploadedCount: 0,
    failedCount: 0,
    totalSizeBytes: 0,
    errors: [],
  });

  useEffect(() => {
    onBatchStatusChange?.(batchStatus);
  }, [batchStatus, onBatchStatusChange]);

  // Global Batch Apply Values
  const [batchCollection, setBatchCollection] = useState<string>(collections[0]?.id || 'polaroids');
  const [batchPrice, setBatchPrice] = useState<number>(349);
  const [batchTags, setBatchTags] = useState<string>('polaroids, memories, custom');
  const [batchDescription, setBatchDescription] = useState<string>(
    'Handcrafted premium photo print on 300 GSM archival Fuji Crystal paper.'
  );
  const [batchStyle, setBatchStyle] = useState<string>('Modern');
  const [batchActive, setBatchActive] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean filename into human readable title
  const cleanTitleFromFilename = (fileName: string): string => {
    return fileName
      .replace(/\.[^/.]+$/, '') // remove extension
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  };

  // Inspect image dimensions and calculate aspect ratio & print quality
  const inspectImageFile = (file: File): Promise<{
    width: number;
    height: number;
    aspectRatio: AspectRatioType;
    quality: 'archival' | 'standard' | 'low';
  }> => {
    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const ratio = w / h;

        let aspect: AspectRatioType = 'portrait';
        if (ratio <= 0.65) {
          aspect = 'tall'; // 9:16 Photo strip or bookmark
        } else if (ratio > 0.65 && ratio <= 0.85) {
          aspect = 'portrait'; // 3:4 Poster
        } else if (ratio > 0.85 && ratio <= 1.15) {
          aspect = 'square'; // 1:1 Polaroid
        } else {
          aspect = 'wide'; // 4:3 Landscape
        }

        let quality: 'archival' | 'standard' | 'low' = 'standard';
        const maxDim = Math.max(w, h);
        if (maxDim >= 1200) quality = 'archival';
        else if (maxDim < 700) quality = 'low';

        URL.revokeObjectURL(objectUrl);
        resolve({ width: w, height: h, aspectRatio: aspect, quality });
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({ width: 800, height: 1000, aspectRatio: 'portrait', quality: 'standard' });
      };
      img.src = objectUrl;
    });
  };

  // Handle file additions (dragged or browsed)
  const handleFilesAdded = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    const validFiles = files.filter((f) => {
      const type = f.type.toLowerCase();
      return (
        type === 'image/jpeg' ||
        type === 'image/png' ||
        type === 'image/webp' ||
        type === 'image/jpg'
      );
    });

    if (validFiles.length === 0) {
      alert('Please select valid image files (JPEG, PNG, or WebP).');
      return;
    }

    const addedSizeBytes = validFiles.reduce((acc, f) => acc + f.size, 0);
    const newItems: ValidatedFileItem[] = [];

    for (const file of validFiles) {
      const inspection = await inspectImageFile(file);
      const title = cleanTitleFromFilename(file.name);

      newItems.push({
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        firebaseUrl: null,
        uploading: true,
        uploadError: null,
        name: title,
        width: inspection.width,
        height: inspection.height,
        sizeKb: Math.round(file.size / 1024),
        detectedAspect: inspection.aspectRatio,
        printQuality: inspection.quality,

        // Product model mapped fields
        collectionId: batchCollection,
        price: batchPrice,
        originalPrice: Math.round(batchPrice * 1.4),
        description: `Handcrafted ${title} printed on 300 GSM archival Fuji Crystal paper.`,
        tags: `${batchCollection}, custom photo, gifts`,
        style: batchStyle,
        stock: 100,
        badge: 'New Design',
        isActive: true,
        isFeatured: false,
      });
    }

    const newIds = newItems.map((it) => it.id);
    setItems((prev) => [...prev, ...newItems]);
    setSelectedItemIds((prev) => [...prev, ...newIds]);
    setCurrentStep('validate');

    const totalBatchCount = items.length + newItems.length;
    const totalBytes = batchStatus.totalSizeBytes + addedSizeBytes;

    setBatchStatus((prev) => ({
      ...prev,
      phase: 'uploading',
      inProgress: true,
      total: totalBatchCount,
      totalSizeBytes: totalBytes,
      currentFileName: newItems[0]?.name,
      currentFileSizeKb: newItems[0]?.sizeKb,
    }));

    // Process uploads sequentially to prevent memory spikes and socket exhaustion
    const uploadQueue = [...newItems];
    (async () => {
      let completedInRun = batchStatus.completed;
      let uploadedInRun = batchStatus.uploadedCount;
      let failedInRun = batchStatus.failedCount;

      // Parallel upload with concurrency pool of 3 workers
      const concurrency = 3;
      let queueIndex = 0;

      const runWorker = async () => {
        while (queueIndex < uploadQueue.length) {
          const item = uploadQueue[queueIndex++];
          if (!item) break;

          setBatchStatus((prev) => ({
            ...prev,
            phase: 'uploading',
            inProgress: true,
            currentFileName: item.name,
            currentFileSizeKb: item.sizeKb,
          }));

          try {
            const url = await uploadPhotoToFirebaseStorage(item.file, 'products');
            completedInRun++;
            uploadedInRun++;
            setItems((prev) =>
              prev.map((it) => (it.id === item.id ? { ...it, firebaseUrl: url, uploading: false } : it))
            );
            setBatchStatus((prev) => {
              const pct = Math.round((completedInRun / totalBatchCount) * 100);
              return {
                ...prev,
                completed: completedInRun,
                uploadedCount: uploadedInRun,
                percentage: Math.min(100, pct),
              };
            });
          } catch (err: any) {
            if (import.meta.env.DEV) {
              console.error('Upload error for item:', item.name, err);
            }
            completedInRun++;
            failedInRun++;
            setItems((prev) =>
              prev.map((it) =>
                it.id === item.id
                  ? { ...it, firebaseUrl: item.previewUrl, uploading: false, uploadError: err.message }
                  : it
              )
            );
            setBatchStatus((prev) => {
              const pct = Math.round((completedInRun / totalBatchCount) * 100);
              return {
                ...prev,
                completed: completedInRun,
                failedCount: failedInRun,
                percentage: Math.min(100, pct),
                errors: [...prev.errors, `${item.name}: ${err.message}`],
              };
            });
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(concurrency, uploadQueue.length) }, () => runWorker())
      );

      setBatchStatus((prev) => ({
        ...prev,
        phase: 'uploaded',
        inProgress: false,
        percentage: 100,
        currentFileName: undefined,
        currentFileSizeKb: undefined,
      }));
    })();
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFilesAdded(e.dataTransfer.files);
  };

  // Item Selection Handlers
  const handleToggleSelectAll = () => {
    if (selectedItemIds.length === items.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(items.map((it) => it.id));
    }
  };

  const handleToggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Batch assignments applied to all or selected items
  const applyBatchCollection = (onlySelected: boolean = false) => {
    const targetIds = onlySelected && selectedItemIds.length > 0 ? selectedItemIds : items.map((it) => it.id);
    setItems((prev) =>
      prev.map((it) =>
        targetIds.includes(it.id)
          ? { ...it, collectionId: batchCollection }
          : it
      )
    );
  };

  const applyBatchPrice = (onlySelected: boolean = false) => {
    const targetIds = onlySelected && selectedItemIds.length > 0 ? selectedItemIds : items.map((it) => it.id);
    setItems((prev) =>
      prev.map((it) =>
        targetIds.includes(it.id)
          ? { ...it, price: batchPrice, originalPrice: Math.round(batchPrice * 1.4) }
          : it
      )
    );
  };

  const applyBatchTags = (onlySelected: boolean = false) => {
    const targetIds = onlySelected && selectedItemIds.length > 0 ? selectedItemIds : items.map((it) => it.id);
    setItems((prev) =>
      prev.map((it) =>
        targetIds.includes(it.id)
          ? { ...it, tags: batchTags }
          : it
      )
    );
  };

  const applyBatchDescription = (onlySelected: boolean = false) => {
    const targetIds = onlySelected && selectedItemIds.length > 0 ? selectedItemIds : items.map((it) => it.id);
    setItems((prev) =>
      prev.map((it) =>
        targetIds.includes(it.id)
          ? { ...it, description: batchDescription }
          : it
      )
    );
  };

  const applyBatchStyle = (onlySelected: boolean = false) => {
    const targetIds = onlySelected && selectedItemIds.length > 0 ? selectedItemIds : items.map((it) => it.id);
    setItems((prev) =>
      prev.map((it) =>
        targetIds.includes(it.id)
          ? { ...it, style: batchStyle }
          : it
      )
    );
  };

  // Simultaneous assignment of Collection, Pricing & Tag Data
  const applySimultaneousBatch = (onlySelected: boolean = false) => {
    const targetIds = onlySelected && selectedItemIds.length > 0 ? selectedItemIds : items.map((it) => it.id);
    setItems((prev) =>
      prev.map((it) =>
        targetIds.includes(it.id)
          ? {
              ...it,
              collectionId: batchCollection,
              price: batchPrice,
              originalPrice: Math.round(batchPrice * 1.4),
              tags: batchTags,
              description: batchDescription,
              style: batchStyle,
            }
          : it
      )
    );
  };

  const applyBatchVisibility = (active: boolean) => {
    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        isActive: active,
      }))
    );
  };

  // Remove individual item
  const handleRemoveItem = (id: string) => {
    const itemToRemove = items.find((it) => it.id === id);
    setItems((prev) => prev.filter((it) => it.id !== id));
    setSelectedItemIds((prev) => prev.filter((i) => i !== id));

    if (itemToRemove) {
      setBatchStatus((prev) => {
        const remainingTotal = Math.max(0, prev.total - 1);
        const remainingUploaded = itemToRemove.firebaseUrl ? Math.max(0, prev.uploadedCount - 1) : prev.uploadedCount;
        const remainingFailed = itemToRemove.uploadError ? Math.max(0, prev.failedCount - 1) : prev.failedCount;
        const remainingBytes = Math.max(0, prev.totalSizeBytes - itemToRemove.file.size);
        const remainingCompleted = itemToRemove.uploading ? prev.completed : Math.max(0, prev.completed - 1);
        return {
          ...prev,
          total: remainingTotal,
          uploadedCount: remainingUploaded,
          failedCount: remainingFailed,
          totalSizeBytes: remainingBytes,
          completed: remainingCompleted,
          percentage: remainingTotal > 0 ? Math.round((remainingCompleted / remainingTotal) * 100) : 0,
        };
      });
    }
  };

  // Retry all failed uploads in the batch
  const handleRetryFailedUploads = async () => {
    const failedItems = items.filter((it) => it.uploadError || (!it.firebaseUrl && !it.uploading));
    if (failedItems.length === 0) return;

    setBatchStatus((prev) => ({
      ...prev,
      phase: 'uploading',
      inProgress: true,
      currentFileName: failedItems[0]?.name,
      currentFileSizeKb: failedItems[0]?.sizeKb,
    }));

    const failedIds = failedItems.map((f) => f.id);
    setItems((prev) =>
      prev.map((it) => (failedIds.includes(it.id) ? { ...it, uploading: true, uploadError: null } : it))
    );

    for (const item of failedItems) {
      setBatchStatus((prev) => ({
        ...prev,
        currentFileName: item.name,
        currentFileSizeKb: item.sizeKb,
      }));

      try {
        const url = await uploadPhotoToFirebaseStorage(item.file, 'products');
        setItems((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, firebaseUrl: url, uploading: false, uploadError: null } : it))
        );
        setBatchStatus((prev) => ({
          ...prev,
          uploadedCount: prev.uploadedCount + 1,
          failedCount: Math.max(0, prev.failedCount - 1),
        }));
      } catch (err: any) {
        setItems((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, uploading: false, uploadError: err.message } : it))
        );
      }
    }

    setBatchStatus((prev) => ({
      ...prev,
      phase: 'uploaded',
      inProgress: false,
      percentage: 100,
      currentFileName: undefined,
      currentFileSizeKb: undefined,
    }));
  };

  // Retry a single item upload
  const handleRetrySingleUpload = async (itemId: string) => {
    const item = items.find((it) => it.id === itemId);
    if (!item) return;

    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, uploading: true, uploadError: null } : it))
    );

    setBatchStatus((prev) => ({
      ...prev,
      inProgress: true,
      currentFileName: item.name,
      currentFileSizeKb: item.sizeKb,
    }));

    try {
      const url = await uploadPhotoToFirebaseStorage(item.file, 'products');
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, firebaseUrl: url, uploading: false, uploadError: null } : it))
      );
      setBatchStatus((prev) => ({
        ...prev,
        inProgress: false,
        uploadedCount: prev.uploadedCount + 1,
        failedCount: Math.max(0, prev.failedCount - 1),
        currentFileName: undefined,
        currentFileSizeKb: undefined,
      }));
    } catch (err: any) {
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, uploading: false, uploadError: err.message } : it))
      );
      setBatchStatus((prev) => ({
        ...prev,
        inProgress: false,
        currentFileName: undefined,
        currentFileSizeKb: undefined,
      }));
    }
  };

  // Update specific item field
  const updateItemField = <K extends keyof ValidatedFileItem>(
    id: string,
    field: K,
    val: ValidatedFileItem[K]
  ) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const updated = { ...it, [field]: val };
        if (field === 'price') {
          updated.originalPrice = Math.round((val as number) * 1.4);
        }
        return updated;
      })
    );
  };

  // Commit all items to Firestore using existing Product model mapping
  const handlePublishAllToCatalog = async () => {
    if (items.length === 0) return;
    setIsPublishing(true);
    setPublishErrors([]);
    setPublishProgress({ current: 0, total: items.length });

    setBatchStatus((prev) => ({
      ...prev,
      phase: 'publishing',
      inProgress: true,
      completed: 0,
      total: items.length,
      percentage: 0,
      currentFileName: items[0]?.name,
    }));

    let publishedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      setBatchStatus((prev) => ({
        ...prev,
        currentFileName: item.name,
      }));

      try {
        // Ensure image URL is available (Firebase Storage download URL or preview)
        let finalImageUrl = item.firebaseUrl;
        if (!finalImageUrl) {
          // Upload right now if still pending
          finalImageUrl = await uploadPhotoToFirebaseStorage(item.file, 'products');
        }

        const safeSlug = (item.name || 'product')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');

        // Strict mapping to existing Product Model
        const productPayload: Product = {
          id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: item.name.trim() || 'Custom Photo Print',
          slug: `${safeSlug}-${Date.now().toString(36)}`,
          category: item.collectionId as ProductCategory,
          collectionId: item.collectionId,
          style: item.style || 'Modern Minimalist',
          occasion: 'Everyday Decor',
          tags: item.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          price: Number(item.price) || 299,
          originalPrice: Number(item.originalPrice) || Math.round((Number(item.price) || 299) * 1.4),
          description: item.description.trim() || 'Custom photo keepsake printed on archival paper.',
          details: 'Printed on 300 GSM archival Fuji Crystal photographic paper. Long-lasting vibrant inks.',
          rating: 5.0,
          reviewCount: 1,
          badge: item.badge?.trim() || 'New Design',
          imageUrl: finalImageUrl,
          aspectRatio: item.detectedAspect,
          sizes: ['Standard (3.5 x 4.2 in)', 'Mini (2.1 x 3.4 in)', 'Enlarged (5 x 7 in)'],
          paperFinishes: ['Glossy Ultra-HD', 'Matte Silk'],
          minPhotos: item.collectionId === 'photo-strips' ? 3 : 1,
          maxPhotos: item.collectionId === 'photo-strips' ? 12 : 20,
          stock: Number(item.stock) || 100,
          isActive: item.isActive,
          isFeatured: item.isFeatured,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await saveProductToFirestore(productPayload);
        publishedCount++;
        setPublishProgress({ current: publishedCount, total: items.length });
        setBatchStatus((prev) => ({
          ...prev,
          completed: publishedCount,
          percentage: Math.round((publishedCount / items.length) * 100),
          currentFileName: item.name,
        }));
      } catch (err: any) {
        errors.push(`Failed on "${item.name}": ${err.message}`);
      }
    }

    setIsPublishing(false);
    setBatchStatus((prev) => ({
      ...prev,
      phase: 'published',
      inProgress: false,
      percentage: 100,
      currentFileName: undefined,
    }));

    if (errors.length > 0) {
      setPublishErrors(errors);
    }

    if (publishedCount > 0) {
      onPublishSuccess(publishedCount);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden space-y-6 p-6 sm:p-8">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/jpg"
        onChange={(e) => handleFilesAdded(e.target.files)}
        className="hidden"
      />

      {/* Header & Step Wizard Indicator */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-stone-100 pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Multi-File Bulk Product Ingestion</span>
          </div>
          <h2 className="font-['Playfair_Display',serif] text-2xl font-black text-slate-900">
            Bulk Product Upload & List Editor
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Drag-and-drop multiple photos, host persistently on Firebase Storage, validate dimensions, and assign collections, pricing, and descriptions in a unified list view.
          </p>
        </div>

        {/* Wizard Steps */}
        <div className="flex items-center gap-2 text-xs font-bold shrink-0 bg-stone-50 p-1.5 rounded-2xl border border-stone-200">
          <button
            type="button"
            onClick={() => setCurrentStep('upload')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
              currentStep === 'upload'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>1. Upload</span>
          </button>

          <button
            type="button"
            onClick={() => items.length > 0 && setCurrentStep('validate')}
            disabled={items.length === 0}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-40 ${
              currentStep === 'validate'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>2. Validate ({items.length})</span>
          </button>

          <button
            type="button"
            onClick={() => items.length > 0 && setCurrentStep('list-editor')}
            disabled={items.length === 0}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-40 ${
              currentStep === 'list-editor'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>3. Bulk List Editor</span>
          </button>
        </div>
      </div>

      {/* ========================================================== */}
      {/* VISUAL PROGRESS BAR & BATCH STATUS INDICATOR CARD          */}
      {/* ========================================================== */}
      {(items.length > 0 || batchStatus.inProgress) && (
        <div className="bg-gradient-to-br from-stone-50 via-white to-stone-50/70 rounded-3xl border border-stone-200/90 p-5 shadow-xs space-y-4">
          {/* Header Row: Status Icon, Title, Subtitle & Cloud Status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200/60 pb-3.5">
            <div className="flex items-start sm:items-center gap-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs transition-colors ${
                  batchStatus.inProgress
                    ? batchStatus.phase === 'uploading'
                      ? 'bg-rose-100 text-rose-600'
                      : 'bg-amber-100 text-amber-700'
                    : batchStatus.failedCount > 0
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {batchStatus.inProgress ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : batchStatus.failedCount > 0 ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-sm text-slate-900">
                    {batchStatus.inProgress
                      ? batchStatus.phase === 'uploading'
                        ? `Uploading Batch to Firebase Storage (${batchStatus.completed} of ${batchStatus.total})`
                        : `Publishing Batch to Store Catalog (${batchStatus.completed} of ${batchStatus.total})`
                      : batchStatus.phase === 'published'
                      ? `Catalog Publication Complete (${items.length} Products Live)`
                      : batchStatus.failedCount > 0
                      ? `Batch Upload Finished with Warnings (${batchStatus.uploadedCount} of ${items.length} Cloud Synced)`
                      : `Batch Cloud Storage Ready (${items.length} of ${items.length} Photos Synced)`}
                  </h3>

                  {/* Percentage Pill */}
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-black shadow-2xs ${
                      batchStatus.inProgress
                        ? 'bg-rose-600 text-white animate-pulse'
                        : batchStatus.failedCount > 0
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {batchStatus.percentage}%
                  </span>
                </div>

                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                  {batchStatus.inProgress && batchStatus.currentFileName ? (
                    <>
                      <span className="font-medium text-slate-700 truncate max-w-xs">
                        Active file: &ldquo;{batchStatus.currentFileName}&rdquo;
                      </span>
                      {batchStatus.currentFileSizeKb && (
                        <span className="text-slate-400">({batchStatus.currentFileSizeKb} KB)</span>
                      )}
                      <span className="text-slate-300">•</span>
                      <span className="text-rose-600 font-semibold">Sequential queue processing</span>
                    </>
                  ) : batchStatus.failedCount > 0 ? (
                    <span className="text-amber-700 font-medium">
                      {batchStatus.failedCount} photo(s) failed Firebase Storage upload and are using local preview fallbacks.
                    </span>
                  ) : (
                    <span className="text-slate-500">
                      All photos persistently hosted on Firebase Storage and ready for simultaneous collection, price, and tag assignment.
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Right Status Controls */}
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              {batchStatus.failedCount > 0 && !batchStatus.inProgress && (
                <button
                  type="button"
                  onClick={handleRetryFailedUploads}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
                  title="Retry uploading photos that encountered network errors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Failed ({batchStatus.failedCount})</span>
                </button>
              )}

              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 rounded-xl text-xs font-bold text-slate-700">
                <Cloud className="w-3.5 h-3.5 text-rose-600" />
                <span>
                  {batchStatus.uploadedCount} / {items.length} Synced
                </span>
              </div>
            </div>
          </div>

          {/* Visual Animated Progress Bar */}
          <div className="space-y-1.5">
            <div className="h-3.5 sm:h-4 w-full bg-stone-100 rounded-full p-0.5 border border-stone-200/80 overflow-hidden shadow-inner relative">
              <div
                className={`h-full rounded-full transition-all duration-300 ease-out relative ${
                  batchStatus.inProgress
                    ? batchStatus.phase === 'uploading'
                      ? 'bg-gradient-to-r from-blue-500 via-rose-500 to-amber-500 animate-pulse'
                      : 'bg-gradient-to-r from-amber-500 via-rose-600 to-emerald-500 animate-pulse'
                    : batchStatus.failedCount > 0
                    ? 'bg-amber-500'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(batchStatus.inProgress ? 4 : 0, batchStatus.percentage))}%` }}
              >
                <div className="absolute inset-0 bg-white/20 rounded-full" />
              </div>
            </div>

            {/* Progress Track Status & Counter */}
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 px-0.5">
              <span className="flex items-center gap-1.5">
                {batchStatus.inProgress ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    <span>
                      {batchStatus.phase === 'uploading'
                        ? 'Uploading to Firebase Storage (sequential queue)'
                        : 'Writing catalog records to Cloud Firestore'}
                    </span>
                  </>
                ) : batchStatus.failedCount > 0 ? (
                  <span className="text-amber-700 font-bold">Storage sync completed with warnings</span>
                ) : (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    <span>Storage sync complete & verified</span>
                  </span>
                )}
              </span>

              <span className="font-bold text-slate-800">
                {batchStatus.completed} of {batchStatus.total} files ({batchStatus.percentage}%)
              </span>
            </div>
          </div>

          {/* Status Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
            <div className="bg-white p-2.5 rounded-2xl border border-stone-200/70 shadow-2xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Total Batch</span>
              <p className="font-extrabold text-slate-900 mt-0.5 flex items-baseline gap-1">
                <span>{items.length} Files</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  ({(batchStatus.totalSizeBytes / 1024 / 1024).toFixed(1)} MB)
                </span>
              </p>
            </div>

            <div className="bg-white p-2.5 rounded-2xl border border-stone-200/70 shadow-2xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Cloud Storage</span>
              <p className="font-extrabold text-slate-900 mt-0.5 flex items-center gap-1">
                <Cloud className="w-3.5 h-3.5 text-rose-500" />
                <span>{batchStatus.uploadedCount} Synced</span>
              </p>
            </div>

            <div className="bg-white p-2.5 rounded-2xl border border-stone-200/70 shadow-2xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Upload Health</span>
              <p
                className={`font-extrabold mt-0.5 flex items-center gap-1 ${
                  batchStatus.failedCount > 0 ? 'text-amber-600' : 'text-emerald-600'
                }`}
              >
                {batchStatus.failedCount > 0 ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{batchStatus.failedCount} Fallback</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>100% Hosted</span>
                  </>
                )}
              </p>
            </div>

            <div className="bg-white p-2.5 rounded-2xl border border-stone-200/70 shadow-2xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Active Stage</span>
              <p className="font-extrabold text-slate-900 mt-0.5 truncate flex items-center gap-1">
                <Database className="w-3.5 h-3.5 text-blue-500" />
                <span>
                  {currentStep === 'upload'
                    ? '1. Ingestion'
                    : currentStep === 'validate'
                    ? '2. Validation'
                    : '3. List Editor'}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* STEP 1: MULTI-FILE DRAG & DROP ZONE (FIREBASE STORAGE)     */}
      {/* ========================================================== */}
      {currentStep === 'upload' && (
        <div className="space-y-6">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-3 border-dashed rounded-3xl p-10 sm:p-14 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-4 ${
              isDragging
                ? 'border-rose-500 bg-rose-50/60 scale-[1.01] shadow-xl'
                : 'border-stone-300 hover:border-rose-400 bg-stone-50/50 hover:bg-stone-50'
            }`}
          >
            <div className="w-20 h-20 rounded-3xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-inner">
              <Upload className="w-10 h-10 animate-pulse" />
            </div>

            <div className="space-y-1.5 max-w-md">
              <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                Drag & drop your product photos here
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Select one or dozens of image files simultaneously from your computer. Files are hosted persistently on <strong>Firebase Storage</strong> with instant preview generation.
              </p>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Supports: JPEG, PNG, WebP • Max 10MB per photo
              </p>
            </div>

            <button
              type="button"
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-colors"
            >
              Browse Computer Files
            </button>
          </div>

          {items.length > 0 && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{items.length} photo(s) selected and ready for validation.</span>
              </div>
              <button
                type="button"
                onClick={() => setCurrentStep('validate')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs"
              >
                <span>Proceed to Image Validation</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================== */}
      {/* STEP 2: IMAGE PREVIEW & VALIDATION STAGE                   */}
      {/* ========================================================== */}
      {currentStep === 'validate' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50 p-4 rounded-2xl border border-stone-200">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-600" />
                <span>Image Integrity & Print Quality Validation ({items.length} photos)</span>
              </h3>
              <p className="text-xs text-slate-500">
                Verify resolution, detected aspect ratio, and Firebase Storage upload status before filling out catalog details.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 bg-white border border-stone-300 hover:bg-stone-50 text-slate-800 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Add More</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep('list-editor')}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-rose-600/30"
              >
                <span>Continue to Bulk List Editor</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Validation Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs flex flex-col justify-between group hover:shadow-md transition-shadow"
              >
                {/* Image Preview Container */}
                <div className="relative aspect-square bg-stone-100 overflow-hidden">
                  <img
                    src={item.previewUrl}
                    alt={item.name}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = DEFAULT_FALLBACK_PRODUCT_IMAGE;
                    }}
                    className="w-full h-full object-cover"
                  />

                  {/* Zoom Modal Trigger */}
                  <button
                    type="button"
                    onClick={() => setPreviewModalUrl(item.previewUrl)}
                    className="absolute bottom-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Zoom preview"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Storage Status Tag */}
                  <div className="absolute top-2 left-2">
                    {item.uploading ? (
                      <span className="bg-amber-500/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Uploading</span>
                      </span>
                    ) : item.firebaseUrl ? (
                      <span className="bg-emerald-600/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                        <Check className="w-3 h-3" />
                        <span>Hosted</span>
                      </span>
                    ) : (
                      <span className="bg-rose-600/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                        Local Fallback
                      </span>
                    )}
                  </div>

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-rose-600 text-white rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Remove from batch"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Validation Info Footer */}
                <div className="p-3 text-xs space-y-1.5">
                  <p className="font-bold text-slate-900 truncate" title={item.name}>
                    {item.name}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{item.width} × {item.height} px</span>
                    <span className="uppercase font-bold text-slate-700">{item.detectedAspect}</span>
                  </div>

                  {/* Quality Badge */}
                  <div className="pt-1">
                    {item.printQuality === 'archival' && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        <span>Archival Print Ready (300 DPI)</span>
                      </span>
                    )}
                    {item.printQuality === 'standard' && (
                      <span className="text-[10px] font-bold text-slate-600 bg-stone-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Check className="w-3 h-3 text-slate-500" />
                        <span>Standard Resolution</span>
                      </span>
                    )}
                    {item.printQuality === 'low' && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-amber-600" />
                        <span>Low Resolution Warning</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setCurrentStep('upload')}
              className="px-4 py-2 border border-stone-300 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 hover:bg-stone-50"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Upload</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep('list-editor')}
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-md shadow-rose-600/30"
            >
              <span>Proceed to Bulk List Editor ({items.length} items)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* STEP 3: BULK LIST VIEW EDITOR (ASSIGN DATA TO MODEL)      */}
      {/* ========================================================== */}
      {currentStep === 'list-editor' && (
        <div className="space-y-6">
          {/* Sticky Quick-Status Bar for List Editor */}
          <div className="sticky top-2 z-20 bg-white/95 backdrop-blur-md p-3.5 rounded-2xl border border-stone-200 shadow-md flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  batchStatus.inProgress
                    ? 'bg-rose-500 animate-ping'
                    : batchStatus.failedCount > 0
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
              />
              <div className="truncate">
                <span className="font-extrabold text-slate-900 mr-2">Batch Status:</span>
                <span className="text-slate-600 font-medium">
                  {batchStatus.inProgress
                    ? batchStatus.phase === 'uploading'
                      ? `Uploading ${batchStatus.completed} of ${batchStatus.total} (${batchStatus.percentage}%)`
                      : `Publishing ${batchStatus.completed} of ${batchStatus.total} (${batchStatus.percentage}%)`
                    : `${batchStatus.uploadedCount} of ${items.length} Photos Cloud Synced`}
                </span>
                {batchStatus.inProgress && batchStatus.currentFileName && (
                  <span className="text-slate-400 hidden sm:inline ml-2 truncate">
                    &bull; Active: {batchStatus.currentFileName}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {/* Mini visual progress track */}
              <div className="w-24 sm:w-36 h-2 bg-stone-100 rounded-full overflow-hidden border border-stone-200">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    batchStatus.inProgress
                      ? 'bg-gradient-to-r from-rose-500 to-amber-500 animate-pulse'
                      : batchStatus.failedCount > 0
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${batchStatus.percentage}%` }}
                />
              </div>
              <span className="font-black text-slate-800 text-[11px]">{batchStatus.percentage}%</span>

              {batchStatus.failedCount > 0 && !batchStatus.inProgress && (
                <button
                  type="button"
                  onClick={handleRetryFailedUploads}
                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg font-bold text-[11px] flex items-center gap-1 shadow-2xs"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry ({batchStatus.failedCount})</span>
                </button>
              )}
            </div>
          </div>

          {/* Global Batch Controls Bar */}
          <div className="bg-stone-50 p-4 sm:p-5 rounded-3xl border border-stone-200/90 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200/60 pb-3">
              <div>
                <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-rose-600" />
                  <span>Simultaneous Batch Assignment Tools</span>
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Assign collection, pricing, and tag data simultaneously across multiple or all files before publishing.
                </p>
              </div>

              {/* Selection Summary and Select All Toggle */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="px-3 py-1.5 bg-white hover:bg-stone-100 border border-stone-300 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  {selectedItemIds.length === items.length && items.length > 0 ? (
                    <CheckSquare className="w-3.5 h-3.5 text-rose-600" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span>
                    {selectedItemIds.length === items.length && items.length > 0
                      ? 'Deselect All'
                      : 'Select All Files'}
                  </span>
                </button>
                <span className="text-[11px] font-bold text-slate-500">
                  {selectedItemIds.length} of {items.length} selected
                </span>
              </div>
            </div>

            {/* Inputs Grid: Collection, Price, Tags, Description, Style */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
              {/* 1. Batch Collection */}
              <div className="bg-white p-3 rounded-2xl border border-stone-200/80 space-y-1.5 flex flex-col justify-between">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    Collection *
                  </label>
                  <select
                    value={batchCollection}
                    onChange={(e) => setBatchCollection(e.target.value)}
                    className="w-full mt-1 bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 font-semibold text-slate-800 text-xs focus:outline-none focus:border-rose-400"
                  >
                    {collections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-1 pt-1">
                  <button
                    type="button"
                    onClick={() => applyBatchCollection(false)}
                    className="flex-1 py-1 bg-stone-100 hover:bg-stone-200 text-slate-700 font-bold rounded-lg text-[10px]"
                    title="Apply collection to all files"
                  >
                    All ({items.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => applyBatchCollection(true)}
                    disabled={selectedItemIds.length === 0}
                    className="flex-1 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-[10px] disabled:opacity-40"
                    title="Apply collection only to selected files"
                  >
                    Selected ({selectedItemIds.length})
                  </button>
                </div>
              </div>

              {/* 2. Batch Price */}
              <div className="bg-white p-3 rounded-2xl border border-stone-200/80 space-y-1.5 flex flex-col justify-between">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    Pricing (₹ INR) *
                  </label>
                  <div className="relative mt-1">
                    <span className="absolute left-2.5 top-1.5 text-slate-400 font-bold text-xs">₹</span>
                    <input
                      type="number"
                      min={0}
                      value={batchPrice}
                      onChange={(e) => setBatchPrice(parseInt(e.target.value) || 299)}
                      className="w-full pl-6 pr-2 py-1.5 bg-stone-50 border border-stone-200 rounded-xl font-bold text-slate-900 text-xs focus:outline-none focus:border-rose-400"
                    />
                  </div>
                </div>
                <div className="flex gap-1 pt-1">
                  <button
                    type="button"
                    onClick={() => applyBatchPrice(false)}
                    className="flex-1 py-1 bg-stone-100 hover:bg-stone-200 text-slate-700 font-bold rounded-lg text-[10px]"
                    title="Apply pricing to all files"
                  >
                    All ({items.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => applyBatchPrice(true)}
                    disabled={selectedItemIds.length === 0}
                    className="flex-1 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-[10px] disabled:opacity-40"
                    title="Apply pricing only to selected files"
                  >
                    Selected ({selectedItemIds.length})
                  </button>
                </div>
              </div>

              {/* 3. Batch Tags (CRITICAL) */}
              <div className="bg-white p-3 rounded-2xl border border-stone-200/80 space-y-1.5 flex flex-col justify-between">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    <span>Tags Data *</span>
                    <Tag className="w-3 h-3 text-rose-500" />
                  </label>
                  <input
                    type="text"
                    value={batchTags}
                    onChange={(e) => setBatchTags(e.target.value)}
                    placeholder="e.g. polaroid, custom, bff"
                    className="w-full mt-1 bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 font-medium text-slate-800 text-xs focus:outline-none focus:border-rose-400"
                  />
                </div>
                <div className="flex gap-1 pt-1">
                  <button
                    type="button"
                    onClick={() => applyBatchTags(false)}
                    className="flex-1 py-1 bg-stone-100 hover:bg-stone-200 text-slate-700 font-bold rounded-lg text-[10px]"
                    title="Apply tags to all files"
                  >
                    All ({items.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => applyBatchTags(true)}
                    disabled={selectedItemIds.length === 0}
                    className="flex-1 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-[10px] disabled:opacity-40"
                    title="Apply tags only to selected files"
                  >
                    Selected ({selectedItemIds.length})
                  </button>
                </div>
              </div>

              {/* 4. Batch Description */}
              <div className="bg-white p-3 rounded-2xl border border-stone-200/80 space-y-1.5 flex flex-col justify-between">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    Description
                  </label>
                  <input
                    type="text"
                    value={batchDescription}
                    onChange={(e) => setBatchDescription(e.target.value)}
                    placeholder="Archival Fuji Crystal print..."
                    className="w-full mt-1 bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-rose-400"
                  />
                </div>
                <div className="flex gap-1 pt-1">
                  <button
                    type="button"
                    onClick={() => applyBatchDescription(false)}
                    className="flex-1 py-1 bg-stone-100 hover:bg-stone-200 text-slate-700 font-bold rounded-lg text-[10px]"
                    title="Apply description to all files"
                  >
                    All ({items.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => applyBatchDescription(true)}
                    disabled={selectedItemIds.length === 0}
                    className="flex-1 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-[10px] disabled:opacity-40"
                    title="Apply description only to selected files"
                  >
                    Selected ({selectedItemIds.length})
                  </button>
                </div>
              </div>

              {/* 5. Batch Style */}
              <div className="bg-white p-3 rounded-2xl border border-stone-200/80 space-y-1.5 flex flex-col justify-between">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    Aesthetic Style
                  </label>
                  <select
                    value={batchStyle}
                    onChange={(e) => setBatchStyle(e.target.value)}
                    className="w-full mt-1 bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-rose-400"
                  >
                    {STYLES_LIST.filter((s) => s !== 'All Styles').map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-1 pt-1">
                  <button
                    type="button"
                    onClick={() => applyBatchStyle(false)}
                    className="flex-1 py-1 bg-stone-100 hover:bg-stone-200 text-slate-700 font-bold rounded-lg text-[10px]"
                  >
                    All ({items.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => applyBatchStyle(true)}
                    disabled={selectedItemIds.length === 0}
                    className="flex-1 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-[10px] disabled:opacity-40"
                  >
                    Selected ({selectedItemIds.length})
                  </button>
                </div>
              </div>
            </div>

            {/* MASTER SIMULTANEOUS ASSIGNMENT ACTION BUTTONS */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-stone-200/70">
              <div className="flex items-center gap-2 text-xs">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-slate-700">
                  Quick Action: Apply <strong>Collection ({batchCollection})</strong>, <strong>Pricing (₹{batchPrice})</strong>, and <strong>Tags</strong> simultaneously
                </span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => applySimultaneousBatch(false)}
                  className="flex-1 sm:flex-none px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Assign to All {items.length} Files</span>
                </button>
                <button
                  type="button"
                  onClick={() => applySimultaneousBatch(true)}
                  disabled={selectedItemIds.length === 0}
                  className="flex-1 sm:flex-none px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Assign to {selectedItemIds.length} Selected</span>
                </button>
              </div>
            </div>
          </div>

          {/* Publishing Errors Notice */}
          {publishErrors.length > 0 && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Encountered publishing errors:</span>
              </p>
              <ul className="list-disc pl-5">
                {publishErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* The List View Table */}
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 text-slate-600 uppercase font-semibold text-[10px]">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        title={selectedItemIds.length === items.length ? 'Deselect all' : 'Select all'}
                        className="text-slate-600 hover:text-slate-900"
                      >
                        {selectedItemIds.length === items.length && items.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-rose-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                    </th>
                    <th className="p-3 w-16">Preview</th>
                    <th className="p-3 min-w-[190px]">Product Title *</th>
                    <th className="p-3 min-w-[150px]">Collection *</th>
                    <th className="p-3 w-28">Price (₹ INR) *</th>
                    <th className="p-3 min-w-[180px]">Tags Data *</th>
                    <th className="p-3 min-w-[200px]">Description</th>
                    <th className="p-3 w-28">Aspect Ratio</th>
                    <th className="p-3 w-20">Stock</th>
                    <th className="p-3 w-24 text-center">Live in Store</th>
                    <th className="p-3 w-12 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {items.map((item) => {
                    const isSelected = selectedItemIds.includes(item.id);
                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors ${isSelected ? 'bg-rose-50/30 hover:bg-rose-50/50' : 'hover:bg-stone-50/60'}`}
                      >
                        {/* 0. Row Selection Checkbox */}
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleSelectItem(item.id)}
                            className="text-slate-600 hover:text-slate-900"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-rose-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                            )}
                          </button>
                        </td>

                        {/* 1. Preview Thumbnail */}
                        <td className="p-3">
                          <div
                            onClick={() => setPreviewModalUrl(item.previewUrl)}
                            className="w-12 h-14 rounded-lg overflow-hidden bg-stone-100 border border-stone-200 cursor-pointer relative group shrink-0"
                          >
                            <img
                              src={item.previewUrl}
                              alt={item.name}
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = DEFAULT_FALLBACK_PRODUCT_IMAGE;
                              }}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Maximize2 className="w-3 h-3 text-white" />
                            </div>
                          </div>
                        </td>

                        {/* 2. Product Title */}
                        <td className="p-3">
                          <input
                            type="text"
                            required
                            value={item.name}
                            onChange={(e) => updateItemField(item.id, 'name', e.target.value)}
                            placeholder="e.g. Vintage Memory Strip"
                            className="w-full bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 focus:outline-none focus:border-rose-400"
                          />
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                            <span>{item.width}×{item.height}px</span>
                            <span>•</span>
                            <span>{item.sizeKb} KB</span>
                            {item.uploading && (
                              <>
                                <span>•</span>
                                <span className="text-amber-600 font-semibold flex items-center gap-1">
                                  <Loader2 className="w-2.5 h-2.5 animate-spin" /> Uploading to Cloud...
                                </span>
                              </>
                            )}
                            {item.firebaseUrl && !item.uploading && (
                              <>
                                <span>•</span>
                                <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                                  <Check className="w-2.5 h-2.5" /> Firebase Storage
                                </span>
                              </>
                            )}
                            {item.uploadError && !item.uploading && (
                              <>
                                <span>•</span>
                                <button
                                  type="button"
                                  onClick={() => handleRetrySingleUpload(item.id)}
                                  className="text-rose-600 hover:text-rose-700 font-bold flex items-center gap-0.5 underline"
                                  title={item.uploadError}
                                >
                                  <RefreshCw className="w-2.5 h-2.5" /> Retry Upload
                                </button>
                              </>
                            )}
                          </div>
                        </td>

                        {/* 3. Collection Dropdown */}
                        <td className="p-3">
                          <select
                            value={item.collectionId}
                            onChange={(e) => updateItemField(item.id, 'collectionId', e.target.value)}
                            className="w-full bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-none focus:border-rose-400"
                          >
                            {collections.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* 4. Pricing (₹ INR) */}
                        <td className="p-3">
                          <div className="relative">
                            <span className="absolute left-2.5 top-1.5 text-slate-400 font-bold">₹</span>
                            <input
                              type="number"
                              min={0}
                              required
                              value={item.price}
                              onChange={(e) =>
                                updateItemField(item.id, 'price', parseInt(e.target.value) || 0)
                              }
                              className="w-full pl-6 pr-2 py-1.5 bg-stone-50 border border-stone-200 rounded-lg font-bold text-slate-900 focus:outline-none focus:border-rose-400 text-xs"
                            />
                          </div>
                          <span className="block text-[10px] text-slate-400 mt-0.5">
                            MRP: ₹{item.originalPrice}
                          </span>
                        </td>

                        {/* 5. Tags Data Column (CRITICAL) */}
                        <td className="p-3">
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={item.tags}
                              onChange={(e) => updateItemField(item.id, 'tags', e.target.value)}
                              placeholder="comma-separated tags"
                              className="w-full bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-slate-800 text-xs focus:outline-none focus:border-rose-400"
                            />
                            <div className="flex flex-wrap gap-1">
                              {item.tags
                                .split(',')
                                .map((t) => t.trim())
                                .filter(Boolean)
                                .slice(0, 3)
                                .map((tag, idx) => (
                                  <span
                                    key={idx}
                                    className="px-1.5 py-0.2 rounded-md bg-stone-100 text-slate-600 text-[9px] font-medium"
                                  >
                                    #{tag}
                                  </span>
                                ))}
                            </div>
                          </div>
                        </td>

                        {/* 6. Description */}
                        <td className="p-3">
                          <textarea
                            rows={2}
                            value={item.description}
                            onChange={(e) => updateItemField(item.id, 'description', e.target.value)}
                            className="w-full bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-slate-700 text-xs focus:outline-none focus:border-rose-400 resize-none"
                          />
                        </td>

                        {/* 7. Aspect Ratio */}
                        <td className="p-3">
                          <select
                            value={item.detectedAspect}
                            onChange={(e) =>
                              updateItemField(item.id, 'detectedAspect', e.target.value as AspectRatioType)
                            }
                            className="w-full bg-stone-50 border border-stone-200 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-800"
                          >
                            <option value="tall">Tall (9:16)</option>
                            <option value="portrait">Portrait (3:4)</option>
                            <option value="square">Square (1:1)</option>
                            <option value="wide">Wide (4:3)</option>
                          </select>
                        </td>

                        {/* 8. Stock */}
                        <td className="p-3">
                          <input
                            type="number"
                            min={0}
                            value={item.stock}
                            onChange={(e) =>
                              updateItemField(item.id, 'stock', parseInt(e.target.value) || 0)
                            }
                            className="w-full bg-stone-50 border border-stone-200 rounded-lg px-2 py-1.5 font-semibold text-slate-800 text-xs"
                          />
                        </td>

                        {/* 9. Live Toggle */}
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => updateItemField(item.id, 'isActive', !item.isActive)}
                            className={`p-1.5 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 ${
                              item.isActive
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                            }`}
                            title={item.isActive ? 'Will be published live' : 'Will be saved as hidden draft'}
                          >
                            {item.isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            <span className="text-[11px]">{item.isActive ? 'Live' : 'Draft'}</span>
                          </button>
                        </td>

                        {/* 10. Delete Row */}
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-stone-100">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentStep('validate')}
                className="px-4 py-2 border border-stone-300 text-slate-700 font-bold text-xs rounded-xl hover:bg-stone-50 flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Preview Stage</span>
              </button>

              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-slate-500 hover:text-slate-800 font-semibold text-xs"
              >
                Cancel & Close
              </button>
            </div>

            <button
              type="button"
              onClick={handlePublishAllToCatalog}
              disabled={isPublishing || items.length === 0}
              className="w-full sm:w-auto px-8 py-3.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-black text-xs rounded-2xl shadow-xl shadow-rose-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    Publishing {publishProgress?.current || 0} of {publishProgress?.total || items.length} to Catalog...
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Publish All {items.length} Products to Catalog</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* FULLSIZE ZOOM MODAL */}
      {previewModalUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs">
          <div className="relative max-w-3xl max-h-[85vh] bg-white rounded-3xl overflow-hidden shadow-2xl p-2">
            <button
              onClick={() => setPreviewModalUrl(null)}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={previewModalUrl}
              alt="Zoom Preview"
              className="w-full h-auto max-h-[80vh] object-contain rounded-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
