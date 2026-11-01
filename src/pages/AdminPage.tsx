import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  Package, 
  Plus, 
  Edit, 
  Trash2, 
  Check, 
  AlertCircle, 
  Save, 
  Sparkles, 
  Upload, 
  Layers, 
  Loader2,
  X,
  Search,
  Eye,
  EyeOff,
  CheckCircle2,
  Image as ImageIcon,
  FolderPlus,
  RefreshCw,
  Star,
  ExternalLink,
  SlidersHorizontal,
  CheckSquare,
  Square,
  ArrowUpDown,
  Tag,
  Link2,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../services/authContext';
import { 
  getAllOrdersForAdmin, 
  updateOrderStatusByAdmin, 
  getProductsCatalog, 
  saveProductToFirestore, 
  deleteProductFromFirestore,
  seedProductsToFirestore,
  uploadCustomPhoto,
  uploadPhotoToFirebaseStorage,
  getStoreCollections,
  saveCollectionToFirestore,
  deleteCollectionFromFirestore,
  resolveProductImageUrl,
  DEFAULT_FALLBACK_PRODUCT_IMAGE
} from '../services/orderService';
import { Order, Product, OrderStatus, ProductCategory, AspectRatioType, CollectionInfo, BulkBatchStatus } from '../types';
import { COLLECTIONS as DEFAULT_COLS, STYLES_LIST, OCCASIONS_LIST } from '../data/defaultProducts';
import { BulkProductEditor } from '../components/BulkProductEditor';

interface AdminPageProps {
  onBackToStore: () => void;
  onCatalogUpdated?: () => void;
}


export const AdminPage: React.FC<AdminPageProps> = ({ onBackToStore, onCatalogUpdated }) => {
  const { 
    currentUser, 
    isAdmin, 
    isOwnerEmail, 
    isEmailVerified, 
    signInWithGoogle, 
    sendVerificationEmail, 
    reloadUser 
  } = useAuth();
  
  const isAuthorized = isAdmin;
  const [verificationSent, setVerificationSent] = useState(false);
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Tab State: 'gallery-management' is the dedicated visual inventory view
  const [activeTab, setActiveTab] = useState<'gallery-management' | 'upload-studio' | 'collections' | 'orders'>('gallery-management');
  
  // Real-Time Bulk Upload Batch Status across all tabs
  const [bulkBatchStatus, setBulkBatchStatus] = useState<BulkBatchStatus | null>(null);

  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [collections, setCollections] = useState<CollectionInfo[]>(DEFAULT_COLS);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Gallery Management Search, Filter & Sort State
  const [gallerySearch, setGallerySearch] = useState('');
  const [galleryCollectionFilter, setGalleryCollectionFilter] = useState('all');
  const [galleryVisibilityFilter, setGalleryVisibilityFilter] = useState<'all' | 'published' | 'hidden'>('all');
  const [gallerySort, setGallerySort] = useState<'newest' | 'price-asc' | 'price-desc' | 'name'>('newest');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);


  // Edit / Create Product Modal State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isEditingNew, setIsEditingNew] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [uploadingModalImage, setUploadingModalImage] = useState(false);
  const [showModalUrlInput, setShowModalUrlInput] = useState(false);

  // Delete Confirmation Modal State
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Quick Replace image direct trigger
  const [replacingProductId, setReplacingProductId] = useState<string | null>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  // Create Collection Modal State
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDesc, setNewCollectionDesc] = useState('');
  const [newCollectionCover, setNewCollectionCover] = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => {
    if (isAuthorized) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [isAuthorized]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedOrders, fetchedProducts, fetchedCollections] = await Promise.all([
        getAllOrdersForAdmin().catch(() => []),
        getProductsCatalog().catch(() => []),
        getStoreCollections().catch(() => DEFAULT_COLS),
      ]);
      setOrders(fetchedOrders);
      setProducts(fetchedProducts);
      setCollections(fetchedCollections);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Error loading admin data:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3500);
  };

  const handleSendVerification = async () => {
    setIsSendingVerification(true);
    setVerificationError(null);
    try {
      await sendVerificationEmail();
      setVerificationSent(true);
    } catch (err: any) {
      setVerificationError(err.message || 'Failed to send verification email.');
    } finally {
      setIsSendingVerification(false);
    }
  };

  const handleCheckVerification = async () => {
    setIsCheckingStatus(true);
    setVerificationError(null);
    try {
      await reloadUser();
    } catch (err: any) {
      setVerificationError(err.message || 'Failed to refresh verification status.');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // If user signed in with admin email but email is not verified yet
  if (currentUser && isOwnerEmail && !isEmailVerified) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-amber-500 text-white flex items-center justify-center mx-auto shadow-xl">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold uppercase tracking-wider">
            Verification Required
          </span>
          <h2 className="text-2xl font-black text-slate-900 font-['Playfair_Display',serif]">
            Email Verification Needed
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Signed in as <strong>{currentUser.email}</strong>. For production security, store administration operations require email verification.
          </p>
          {verificationSent ? (
            <p className="text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-xl font-medium">
              A verification email has been sent to {currentUser.email}. Please click the link in your inbox, then click &ldquo;Check Verification Status&rdquo; below.
            </p>
          ) : null}
          {verificationError ? (
            <p className="text-[12px] text-rose-700 bg-rose-50 border border-rose-200 p-2 rounded-xl">
              {verificationError}
            </p>
          ) : null}
        </div>

        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={handleSendVerification}
            disabled={isSendingVerification}
            className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSendingVerification ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4 text-rose-400" />}
            <span>{verificationSent ? 'Resend Verification Email' : 'Send Verification Email'}</span>
          </button>

          <button
            type="button"
            onClick={handleCheckVerification}
            disabled={isCheckingStatus}
            className="w-full py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            {isCheckingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 text-slate-600" />}
            <span>Check Verification Status</span>
          </button>

          <button
            type="button"
            onClick={onBackToStore}
            className="text-xs text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
          >
            Return to Customer Storefront
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-slate-900 text-rose-400 flex items-center justify-center mx-auto shadow-xl">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold uppercase tracking-wider">
            Store Owner Portal
          </span>
          <h2 className="text-2xl font-black text-slate-900 font-['Playfair_Display',serif]">
            Administrator Access Required
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            The Admin Gallery and Visual Inventory Manager is restricted to the store administrator (<strong>sukeshkavin@gmail.com</strong>).
          </p>
          {currentUser ? (
            <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-xl">
              Currently signed in as: <strong>{currentUser.email}</strong> (Unauthorized)
            </p>
          ) : (
            <p className="text-[11px] text-slate-400">
              You are currently browsing as a Guest.
            </p>
          )}
        </div>

        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={signInWithGoogle}
            className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-rose-400" />
            <span>Sign In with Google as Admin</span>
          </button>

          <button
            type="button"
            onClick={onBackToStore}
            className="text-xs text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
          >
            Return to Customer Storefront
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // GALLERY MANAGEMENT CONTROLS
  // ==========================================

  // 1. TOGGLE VISIBILITY (PUBLISH / HIDE)
  const handleToggleVisibility = async (product: Product) => {
    const updatedStatus = !product.isActive;
    try {
      const updated: Product = {
        ...product,
        isActive: updatedStatus,
        updatedAt: new Date().toISOString(),
      };
      await saveProductToFirestore(updated);
      setProducts((prev) => prev.map((p) => (p.id === product.id ? updated : p)));
      showNotification(
        `"${product.name}" is now ${updatedStatus ? 'VISIBLE (Published Live)' : 'HIDDEN from customers'}.`
      );
    } catch (err: any) {
      alert(`Error toggling visibility: ${err.message}`);
    }
  };

  // 2. TOGGLE FEATURED ON HOMEPAGE
  const handleToggleFeatured = async (product: Product) => {
    const updatedFeatured = !product.isFeatured;
    try {
      const updated: Product = {
        ...product,
        isFeatured: updatedFeatured,
        updatedAt: new Date().toISOString(),
      };
      await saveProductToFirestore(updated);
      setProducts((prev) => prev.map((p) => (p.id === product.id ? updated : p)));
      showNotification(
        `"${product.name}" ${updatedFeatured ? 'is now featured on the homepage' : 'removed from homepage feature'}.`
      );
    } catch (err: any) {
      alert(`Error updating featured status: ${err.message}`);
    }
  };

  // 3. EDIT PRODUCT (OPEN MODAL)
  const handleOpenEditModal = (product: Product) => {
    setEditingProduct({ ...product });
    setIsEditingNew(false);
    setShowModalUrlInput(false);
  };

  const handleOpenCreateModal = () => {
    const defaultCol = collections[0]?.id || 'polaroids';
    const newProduct: Product = {
      id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: '',
      slug: '',
      category: defaultCol as ProductCategory,
      collectionId: defaultCol,
      style: 'Modern Minimalist',
      occasion: 'Everyday Decor',
      tags: ['photo', 'print', 'custom'],
      price: 349,
      originalPrice: 499,
      description: 'Custom photo print handcrafted with archival quality materials.',
      details: 'Printed on 300 GSM archival Fuji Crystal photographic paper.',
      rating: 5.0,
      reviewCount: 1,
      badge: 'New Design',
      imageUrl: '',
      aspectRatio: 'portrait',
      sizes: ['Standard (3.5 x 4.2 in)', 'Mini (2.1 x 3.4 in)'],
      paperFinishes: ['Glossy Ultra-HD', 'Matte Silk'],
      minPhotos: 1,
      maxPhotos: 20,
      stock: 100,
      isActive: true,
      isFeatured: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setEditingProduct(newProduct);
    setIsEditingNew(true);
    setShowModalUrlInput(false);
  };

  const handleSaveProductForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (!editingProduct.name.trim()) {
      alert('Please enter a product title.');
      return;
    }
    if (!editingProduct.imageUrl || !editingProduct.imageUrl.trim()) {
      alert('Please upload a product photo from your device or provide an image link.');
      return;
    }

    setIsSavingProduct(true);
    try {
      const slug = editingProduct.slug || editingProduct.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const payload: Product = {
        ...editingProduct,
        slug,
        category: editingProduct.collectionId as ProductCategory,
        updatedAt: new Date().toISOString(),
      };

      await saveProductToFirestore(payload);

      if (isEditingNew) {
        setProducts((prev) => [payload, ...prev]);
        showNotification(`Created new product "${payload.name}" successfully!`);
      } else {
        setProducts((prev) => prev.map((p) => (p.id === payload.id ? payload : p)));
        showNotification(`Updated "${payload.name}" successfully!`);
      }

      onCatalogUpdated?.();
      setEditingProduct(null);
    } catch (err: any) {
      alert(`Error saving product: ${err.message}`);
    } finally {
      setIsSavingProduct(false);
    }
  };

  // 4. DELETE PRODUCT (CONFIRMED)
  const handleConfirmDelete = async () => {
    if (!deleteConfirmProduct) return;
    setIsDeleting(true);
    try {
      await deleteProductFromFirestore(deleteConfirmProduct.id);
      setProducts((prev) => prev.filter((p) => p.id !== deleteConfirmProduct.id));
      setSelectedProductIds((prev) => prev.filter((id) => id !== deleteConfirmProduct.id));
      showNotification(`"${deleteConfirmProduct.name}" has been permanently deleted.`);
      onCatalogUpdated?.();
      setDeleteConfirmProduct(null);
    } catch (err: any) {
      alert(`Error deleting product: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // 5. MOVE PRODUCT TO ANOTHER COLLECTION
  const handleMoveCollection = async (product: Product, newColId: string) => {
    try {
      const updated: Product = { 
        ...product, 
        collectionId: newColId,
        category: newColId as ProductCategory,
        updatedAt: new Date().toISOString(),
      };
      await saveProductToFirestore(updated);
      setProducts((prev) => prev.map((p) => (p.id === product.id ? updated : p)));
      showNotification(`Moved "${product.name}" to ${newColId.replace('-', ' ')}.`);
    } catch (err: any) {
      alert(`Error moving collection: ${err.message}`);
    }
  };

  // 6. QUICK PHOTO REPLACE ON HOVER
  const handleQuickReplaceTrigger = (productId: string) => {
    setReplacingProductId(productId);
    replaceFileInputRef.current?.click();
  };

  const handleReplaceFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !replacingProductId) return;
    const file = e.target.files[0];
    const targetProduct = products.find((p) => p.id === replacingProductId);
    if (!targetProduct) return;

    try {
      showNotification('Uploading replacement photo...');
      const newUrl = await uploadCustomPhoto(file);
      const updated: Product = { 
        ...targetProduct, 
        imageUrl: newUrl, 
        updatedAt: new Date().toISOString() 
      };
      await saveProductToFirestore(updated);
      setProducts((prev) => prev.map((p) => (p.id === targetProduct.id ? updated : p)));
      showNotification(`Replaced photo for "${targetProduct.name}"!`);
    } catch (err: any) {
      alert(`Failed to replace photo: ${err.message}`);
    } finally {
      setReplacingProductId(null);
      if (replaceFileInputRef.current) replaceFileInputRef.current.value = '';
    }
  };

  // 7. BULK ACTIONS ON GALLERY
  const handleToggleSelectProduct = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const handleSelectAllFiltered = () => {
    if (selectedProductIds.length === filteredGalleryProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(filteredGalleryProducts.map((p) => p.id));
    }
  };

  const handleBulkToggleVisibility = async (makeVisible: boolean) => {
    if (selectedProductIds.length === 0) return;
    try {
      const updatedProducts = [...products];
      for (const id of selectedProductIds) {
        const prod = updatedProducts.find((p) => p.id === id);
        if (prod) {
          prod.isActive = makeVisible;
          prod.updatedAt = new Date().toISOString();
          await saveProductToFirestore(prod);
        }
      }
      setProducts([...updatedProducts]);
      showNotification(
        `Updated ${selectedProductIds.length} products to ${makeVisible ? 'VISIBLE' : 'HIDDEN'}.`
      );
      setSelectedProductIds([]);
    } catch (err: any) {
      alert(`Bulk update error: ${err.message}`);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProductIds.length === 0) return;
    if (!confirm(`Are you sure you want to permanently delete ${selectedProductIds.length} selected products?`)) {
      return;
    }
    try {
      for (const id of selectedProductIds) {
        await deleteProductFromFirestore(id);
      }
      setProducts((prev) => prev.filter((p) => !selectedProductIds.includes(p.id)));
      showNotification(`Deleted ${selectedProductIds.length} products.`);
      setSelectedProductIds([]);
    } catch (err: any) {
      alert(`Bulk delete error: ${err.message}`);
    }
  };

  // 8. STAGED UPLOAD ACTIONS

  // 9. CREATE NEW COLLECTION
  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;

    const colId = newCollectionName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const newCol: CollectionInfo = {
      id: colId,
      name: newCollectionName.trim(),
      slug: colId,
      description: newCollectionDesc.trim() || `Curated collection of ${newCollectionName}.`,
      coverImage: newCollectionCover || 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=800',
      designCount: 0,
      featured: true,
    };

    try {
      await saveCollectionToFirestore(newCol);
      setCollections((prev) => [...prev, newCol]);
      showNotification(`Created collection "${newCol.name}"!`);
      setIsCreatingCollection(false);
      setNewCollectionName('');
      setNewCollectionDesc('');
      setNewCollectionCover('');
    } catch (err: any) {
      alert(`Error creating collection: ${err.message}`);
    }
  };

  // Filtered & Sorted Products for Gallery Management
  const filteredGalleryProducts = products
    .filter((p) => {
      if (galleryCollectionFilter !== 'all') {
        if (p.collectionId !== galleryCollectionFilter && p.category !== galleryCollectionFilter) {
          return false;
        }
      }
      if (galleryVisibilityFilter === 'published' && !p.isActive) return false;
      if (galleryVisibilityFilter === 'hidden' && p.isActive) return false;
      if (gallerySearch.trim()) {
        const q = gallerySearch.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags?.some((t) => t.toLowerCase().includes(q)) ||
          p.collectionId?.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (gallerySort === 'newest') {
        return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
      }
      if (gallerySort === 'price-asc') {
        return a.price - b.price;
      }
      if (gallerySort === 'price-desc') {
        return b.price - a.price;
      }
      if (gallerySort === 'name') {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });

  const publishedCount = products.filter((p) => p.isActive).length;
  const hiddenCount = products.length - publishedCount;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Hidden File Input for Quick Photo Replace */}
      <input
        ref={replaceFileInputRef}
        type="file"
        accept="image/*"
        onChange={handleReplaceFileSelected}
        className="hidden"
      />

      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Store Photo & Inventory Studio</span>
          </div>
          <h1 className="font-['Playfair_Display',serif] text-2xl sm:text-3xl font-extrabold tracking-tight">
            Admin Gallery & Visual Inventory
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Logged in as administrator: <strong className="text-slate-200">{currentUser?.email}</strong>
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upload-studio')}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-rose-600/30 flex items-center gap-2 transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>Bulk Upload & Editor</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreatingCollection(true)}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <FolderPlus className="w-4 h-4 text-amber-400" />
            <span>New Collection</span>
          </button>

          <button
            onClick={onBackToStore}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition-colors"
          >
            Storefront
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {actionMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800 flex items-center gap-2 shadow-xs animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Products</span>
          <p className="text-2xl font-black text-slate-900 mt-1">{products.length}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Visible in Store</span>
          <p className="text-2xl font-black text-emerald-600 mt-1">{publishedCount}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Hidden / Drafts</span>
          <p className="text-2xl font-black text-amber-600 mt-1">{hiddenCount}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Store Collections</span>
          <p className="text-2xl font-black text-slate-900 mt-1">{collections.length}</p>
        </div>
      </div>

      {/* Persistent Background Batch Upload Progress Indicator (when on other tabs) */}
      {bulkBatchStatus && bulkBatchStatus.inProgress && activeTab !== 'upload-studio' && (
        <div className="bg-gradient-to-r from-rose-50 via-white to-amber-50 border border-rose-200/90 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black text-slate-900">
                  {bulkBatchStatus.phase === 'uploading'
                    ? 'Background Upload Active (Firebase Storage)'
                    : 'Background Catalog Ingestion Active (Cloud Firestore)'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700">
                  {bulkBatchStatus.percentage}% Complete
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-lg">
                {bulkBatchStatus.currentFileName
                  ? `Processing "${bulkBatchStatus.currentFileName}" (${bulkBatchStatus.completed} of ${bulkBatchStatus.total} files completed)`
                  : `${bulkBatchStatus.completed} of ${bulkBatchStatus.total} files processed`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-end">
            <div className="w-32 sm:w-44 h-2.5 bg-stone-200 rounded-full overflow-hidden p-0.5 border border-stone-300/50">
              <div
                className="h-full bg-gradient-to-r from-rose-500 to-amber-500 rounded-full transition-all duration-300"
                style={{ width: `${bulkBatchStatus.percentage}%` }}
              />
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('upload-studio')}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <span>View Batch Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-stone-200 overflow-x-auto gap-2 sm:gap-4 text-xs font-bold pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('gallery-management')}
          className={`pb-3 px-3 border-b-2 flex items-center gap-2 shrink-0 transition-colors ${
            activeTab === 'gallery-management'
              ? 'border-rose-600 text-rose-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>Gallery Management ({products.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('upload-studio')}
          className={`pb-3 px-3 border-b-2 flex items-center gap-2 shrink-0 transition-colors ${
            activeTab === 'upload-studio'
              ? 'border-rose-600 text-rose-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Bulk Upload & Editor</span>
          {bulkBatchStatus && bulkBatchStatus.inProgress && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-700 animate-pulse font-extrabold flex items-center gap-1 shadow-2xs">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              <span>{bulkBatchStatus.percentage}%</span>
            </span>
          )}
          {bulkBatchStatus && !bulkBatchStatus.inProgress && bulkBatchStatus.total > 0 && bulkBatchStatus.phase !== 'published' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-extrabold">
              {bulkBatchStatus.total} ready
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('collections')}
          className={`pb-3 px-3 border-b-2 flex items-center gap-2 shrink-0 transition-colors ${
            activeTab === 'collections'
              ? 'border-rose-600 text-rose-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Collections & Covers ({collections.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`pb-3 px-3 border-b-2 flex items-center gap-2 shrink-0 transition-colors ${
            activeTab === 'orders'
              ? 'border-rose-600 text-rose-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Customer Orders ({orders.length})</span>
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-rose-600 mx-auto" />
          <p className="text-xs text-slate-500 mt-2">Loading products catalog from Cloud Firestore...</p>
        </div>
      ) : (
        <>
          {/* ======================================================== */}
          {/* TAB 1: DEDICATED GALLERY MANAGEMENT VIEW                 */}
          {/* ======================================================== */}
          {activeTab === 'gallery-management' && (
            <div className="space-y-6">
              {/* Header Info & View Intro */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-stone-200/80 shadow-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">Visual Product Inventory</h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-stone-100 text-slate-700">
                      {filteredGalleryProducts.length} items
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Manage visual inventory with dedicated <strong>Edit</strong>, <strong>Delete</strong>, and <strong>Toggle Visibility</strong> controls on every product card.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleOpenCreateModal}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Product</span>
                  </button>

                  {products.length === 0 && (
                    <button
                      type="button"
                      onClick={async () => {
                        const count = await seedProductsToFirestore();
                        showNotification(`Seeded ${count} default products into Firestore!`);
                        loadData();
                      }}
                      className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Seed Defaults</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Multi-File Drag & Drop Banner */}
              <div
                onClick={() => setActiveTab('upload-studio')}
                className="border-2 border-dashed border-rose-200 hover:border-rose-400 bg-rose-50/40 hover:bg-rose-50/80 rounded-3xl p-5 text-center cursor-pointer transition-all duration-200 flex flex-col sm:flex-row items-center justify-between gap-4 group shadow-xs"
              >
                <div className="flex items-center gap-3 text-left">
                  <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-inner">
                    <Upload className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-rose-600 transition-colors">
                      {bulkBatchStatus && bulkBatchStatus.inProgress
                        ? `Batch Upload In Progress: ${bulkBatchStatus.percentage}% Complete`
                        : bulkBatchStatus && bulkBatchStatus.total > 0 && bulkBatchStatus.phase !== 'published'
                        ? `Active Staged Batch (${bulkBatchStatus.total} Photos Ready)`
                        : 'Multi-File Drag & Drop Upload Zone & Bulk Editor'}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {bulkBatchStatus && bulkBatchStatus.inProgress
                        ? `Processed ${bulkBatchStatus.completed} of ${bulkBatchStatus.total} files on Firebase Storage.`
                        : bulkBatchStatus && bulkBatchStatus.total > 0 && bulkBatchStatus.phase !== 'published'
                        ? `${bulkBatchStatus.uploadedCount} photos hosted on Firebase Storage ready for catalog publication.`
                        : 'Upload multiple files simultaneously to Firebase Storage and assign collection, pricing, and tag data before publishing live.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors">
                    {bulkBatchStatus && bulkBatchStatus.inProgress
                      ? `View Progress (${bulkBatchStatus.percentage}%)`
                      : 'Launch Bulk Editor & Drop Zone'}
                  </span>
                </div>
              </div>

              {/* Filters, Search & Sort Bar */}
              <div className="bg-white p-4 rounded-3xl border border-stone-200/90 shadow-xs space-y-3">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 text-xs">
                  {/* Search Bar */}
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search products by title, tag, collection, or description..."
                      value={gallerySearch}
                      onChange={(e) => setGallerySearch(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-rose-400 text-slate-800"
                    />
                    {gallerySearch && (
                      <button
                        onClick={() => setGallerySearch('')}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Filter Dropdowns */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Collection Filter */}
                    <div className="flex items-center gap-1 bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Collection:</span>
                      <select
                        value={galleryCollectionFilter}
                        onChange={(e) => setGalleryCollectionFilter(e.target.value)}
                        className="bg-transparent font-bold text-slate-800 focus:outline-none text-xs cursor-pointer"
                      >
                        <option value="all">All Collections ({products.length})</option>
                        {collections.map((c) => {
                          const count = products.filter(
                            (p) => p.collectionId === c.id || p.category === c.id
                          ).length;
                          return (
                            <option key={c.id} value={c.id}>
                              {c.name} ({count})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Visibility Filter */}
                    <div className="flex items-center gap-1 bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Visibility:</span>
                      <select
                        value={galleryVisibilityFilter}
                        onChange={(e) => setGalleryVisibilityFilter(e.target.value as any)}
                        className="bg-transparent font-bold text-slate-800 focus:outline-none text-xs cursor-pointer"
                      >
                        <option value="all">All ({products.length})</option>
                        <option value="published">Visible Live ({publishedCount})</option>
                        <option value="hidden">Hidden / Drafts ({hiddenCount})</option>
                      </select>
                    </div>

                    {/* Sort Order */}
                    <div className="flex items-center gap-1 bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1">
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      <select
                        value={gallerySort}
                        onChange={(e) => setGallerySort(e.target.value as any)}
                        className="bg-transparent font-bold text-slate-800 focus:outline-none text-xs cursor-pointer"
                      >
                        <option value="newest">Newest First</option>
                        <option value="price-asc">Price: Low to High</option>
                        <option value="price-desc">Price: High to Low</option>
                        <option value="name">Title: A-Z</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Bulk Selection Bar */}
                <div className="flex flex-wrap items-center justify-between pt-2 border-t border-stone-100 gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      className="flex items-center gap-1.5 font-bold text-slate-700 hover:text-slate-900"
                    >
                      {selectedProductIds.length > 0 && selectedProductIds.length === filteredGalleryProducts.length ? (
                        <CheckSquare className="w-4 h-4 text-rose-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                      <span>
                        {selectedProductIds.length === 0
                          ? 'Select All'
                          : `Selected ${selectedProductIds.length} of ${filteredGalleryProducts.length}`}
                      </span>
                    </button>

                    {selectedProductIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedProductIds([])}
                        className="text-slate-400 hover:text-slate-600 text-[11px]"
                      >
                        Clear selection
                      </button>
                    )}
                  </div>

                  {selectedProductIds.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleBulkToggleVisibility(true)}
                        className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg font-bold text-xs flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Make Visible</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleBulkToggleVisibility(false)}
                        className="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg font-bold text-xs flex items-center gap-1"
                      >
                        <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                        <span>Hide Selected</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleBulkDelete}
                        className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold text-xs flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>Delete Selected</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Products Management Grid */}
              {filteredGalleryProducts.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-3xl border border-stone-200 space-y-3">
                  <ImageIcon className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-sm font-bold text-slate-800">No products match your criteria</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Try adjusting your search query, changing the collection filter, or adding a new product.
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenCreateModal}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl inline-flex items-center gap-1.5 shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add First Product</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                  {filteredGalleryProducts.map((prod) => {
                    const isSelected = selectedProductIds.includes(prod.id);

                    return (
                      <div
                        key={prod.id}
                        className={`bg-white rounded-3xl border overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between ${
                          isSelected
                            ? 'ring-2 ring-rose-500 border-rose-400 bg-rose-50/10'
                            : prod.isActive
                            ? 'border-stone-200'
                            : 'border-dashed border-amber-300 bg-amber-50/20'
                        }`}
                      >
                        {/* Photo Image Card Container */}
                        <div className="relative aspect-[4/3] bg-stone-100 overflow-hidden group">
                          <img
                            src={resolveProductImageUrl(prod)}
                            alt={prod.name}
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = DEFAULT_FALLBACK_PRODUCT_IMAGE;
                            }}
                            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${
                              !prod.isActive ? 'opacity-80 grayscale-[30%]' : ''
                            }`}
                          />

                          {/* Top Controls Overlay */}
                          <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between z-10">
                            {/* Checkbox */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleSelectProduct(prod.id);
                              }}
                              className="w-7 h-7 rounded-lg bg-black/40 hover:bg-black/60 backdrop-blur-xs flex items-center justify-center text-white transition-colors"
                              title={isSelected ? 'Deselect item' : 'Select item'}
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-emerald-300 fill-emerald-500" />
                              ) : (
                                <Square className="w-4 h-4 text-white/80" />
                              )}
                            </button>

                            {/* Visibility Badge */}
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1 ${
                                  prod.isActive
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-amber-600 text-white'
                                }`}
                              >
                                {prod.isActive ? (
                                  <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-200 animate-pulse"></span>
                                    <span>VISIBLE</span>
                                  </>
                                ) : (
                                  <>
                                    <EyeOff className="w-3 h-3 text-white" />
                                    <span>HIDDEN</span>
                                  </>
                                )}
                              </span>

                              {/* Featured Star Button */}
                              <button
                                type="button"
                                onClick={() => handleToggleFeatured(prod)}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center backdrop-blur-xs transition-colors ${
                                  prod.isFeatured
                                    ? 'bg-amber-400 text-amber-950 font-bold shadow-xs'
                                    : 'bg-black/40 hover:bg-black/60 text-white/80'
                                }`}
                                title={prod.isFeatured ? 'Featured on Homepage (Click to remove)' : 'Feature on Homepage'}
                              >
                                <Star className={`w-3.5 h-3.5 ${prod.isFeatured ? 'fill-amber-950' : ''}`} />
                              </button>
                            </div>
                          </div>

                          {/* Price & Aspect Ratio Pill */}
                          <div className="absolute bottom-2.5 inset-x-2.5 flex items-center justify-between z-10 pointer-events-none">
                            <span className="bg-black/70 backdrop-blur-xs text-white text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                              {prod.aspectRatio || 'portrait'}
                            </span>
                            <span className="bg-white/95 text-slate-900 font-extrabold text-xs px-2 py-0.5 rounded-md shadow-xs">
                              ₹{prod.price}
                            </span>
                          </div>

                          {/* Hover Overlay: Quick Photo Replace */}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-20">
                            <button
                              type="button"
                              onClick={() => handleQuickReplaceTrigger(prod.id)}
                              className="px-3.5 py-2 bg-white text-slate-900 text-xs font-bold rounded-xl shadow-lg hover:bg-stone-50 flex items-center gap-1.5"
                            >
                              <Upload className="w-3.5 h-3.5 text-rose-600" />
                              <span>Replace Photo</span>
                            </button>
                          </div>
                        </div>

                        {/* Product Information */}
                        <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <h3
                                className="font-extrabold text-slate-900 text-sm line-clamp-1 flex-1"
                                title={prod.name}
                              >
                                {prod.name}
                              </h3>
                              {prod.badge && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                                  {prod.badge}
                                </span>
                              )}
                            </div>

                            {/* Collection Switcher Dropdown */}
                            <div className="mt-2.5">
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                Collection
                              </label>
                              <select
                                value={prod.collectionId || prod.category}
                                onChange={(e) => handleMoveCollection(prod, e.target.value)}
                                className="w-full bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 cursor-pointer focus:outline-none focus:border-rose-400"
                              >
                                {collections.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                              {prod.description}
                            </p>
                          </div>

                          {/* ======================================================== */}
                          {/* DEDICATED CONTROLS: EDIT, DELETE, TOGGLE VISIBILITY     */}
                          {/* ======================================================== */}
                          <div className="pt-3 border-t border-stone-100 space-y-2">
                            {/* Primary Controls Row */}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {/* 1. EDIT BUTTON */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(prod)}
                                className="py-2 px-3 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all"
                                title="Edit product details, price, images, and settings"
                              >
                                <Edit className="w-3.5 h-3.5 text-rose-300" />
                                <span>Edit</span>
                              </button>

                              {/* 2. TOGGLE VISIBILITY BUTTON */}
                              <button
                                type="button"
                                onClick={() => handleToggleVisibility(prod)}
                                className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 text-xs border ${
                                  prod.isActive
                                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                                }`}
                                title={prod.isActive ? 'Hide from customer storefront' : 'Make visible to customers'}
                              >
                                {prod.isActive ? (
                                  <>
                                    <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Hide</span>
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Make Visible</span>
                                  </>
                                )}
                              </button>
                            </div>

                            {/* Secondary Row: Delete & Direct Status */}
                            <div className="flex items-center justify-between text-[11px] pt-1">
                              <span className="text-slate-400 font-medium">
                                Stock: <strong className="text-slate-700">{prod.stock}</strong>
                              </span>

                              {/* 3. DELETE BUTTON */}
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmProduct(prod)}
                                className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2 py-1 rounded-lg font-bold flex items-center gap-1 transition-colors"
                                title="Permanently delete this product"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: BULK UPLOAD & LIST EDITOR (FIREBASE STORAGE)      */}
          {/* ======================================================== */}
          <div className={activeTab === 'upload-studio' ? 'block' : 'hidden'}>
            <BulkProductEditor
              collections={collections}
              onPublishSuccess={(count) => {
                showNotification(`Successfully published ${count} new products to the catalog!`);
                loadData();
                onCatalogUpdated?.();
                setActiveTab('gallery-management');
              }}
              onCancel={() => setActiveTab('gallery-management')}
              onBatchStatusChange={setBulkBatchStatus}
            />
          </div>

          {/* ======================================================== */}
          {/* TAB 3: COLLECTIONS & COVER MANAGER                       */}
          {/* ======================================================== */}
          {activeTab === 'collections' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Organize store collections, customize cover images, and define new aesthetic categories.
                </p>
                <button
                  type="button"
                  onClick={() => setIsCreatingCollection(true)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Collection</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {collections.map((col) => {
                  const matchingPhotos = products.filter(
                    (p) => p.collectionId === col.id || p.category === col.id
                  );

                  return (
                    <div
                      key={col.id}
                      className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-xs space-y-3 flex flex-col justify-between p-4"
                    >
                      <div className="space-y-3">
                        <div className="relative aspect-[16/10] rounded-2xl overflow-hidden bg-stone-100">
                          <img src={col.coverImage} alt={col.name} className="w-full h-full object-cover" />
                          <span className="absolute top-3 right-3 bg-white/95 px-2.5 py-1 rounded-full text-xs font-black text-slate-900 shadow-sm">
                            {matchingPhotos.length} Photos
                          </span>
                        </div>

                        <div>
                          <h3 className="font-bold text-sm text-slate-900">{col.name}</h3>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{col.description}</p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setGalleryCollectionFilter(col.id);
                            setActiveTab('gallery-management');
                          }}
                          className="font-bold text-rose-600 hover:underline"
                        >
                          View Collection Photos
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            const newCover = prompt('Enter new image URL for collection cover:', col.coverImage);
                            if (newCover && newCover !== col.coverImage) {
                              const updated = { ...col, coverImage: newCover };
                              await saveCollectionToFirestore(updated);
                              setCollections((prev) => prev.map((c) => (c.id === col.id ? updated : c)));
                              showNotification(`Updated cover for ${col.name}!`);
                            }
                          }}
                          className="text-slate-500 hover:text-slate-800 font-semibold"
                        >
                          Change Cover
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: CUSTOMER ORDERS                                   */}
          {/* ======================================================== */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              {orders.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-3xl border border-stone-200">
                  <p className="text-xs text-slate-500">No customer orders recorded yet.</p>
                </div>
              ) : (
                <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-stone-50 border-b border-stone-200 text-slate-600 uppercase font-semibold text-[10px]">
                        <tr>
                          <th className="p-4">Order ID & Date</th>
                          <th className="p-4">Customer Details</th>
                          <th className="p-4">Items</th>
                          <th className="p-4">Total</th>
                          <th className="p-4">Order Status</th>
                          <th className="p-4">Payment Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {orders.map((ord) => (
                          <tr key={ord.id} className="hover:bg-stone-50/50">
                            <td className="p-4">
                              <p className="font-mono font-bold text-slate-900">{ord.orderNumber}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {new Date(ord.createdAt).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </td>

                            <td className="p-4">
                              <p className="font-semibold text-slate-800">{ord.customerName}</p>
                              <p className="text-[11px] text-slate-500">{ord.customerPhone}</p>
                              <p className="text-[10px] text-slate-400 truncate max-w-xs">
                                {ord.shippingAddress?.city}, {ord.shippingAddress?.state}
                              </p>
                            </td>

                            <td className="p-4">
                              <p className="font-medium text-slate-800">{ord.items.length} item(s)</p>
                              <div className="flex gap-1 mt-1">
                                {ord.items.slice(0, 3).map((it, i) => (
                                  <img
                                    key={i}
                                    src={it.photoUrls[0] || 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=60'}
                                    alt="thumb"
                                    className="w-7 h-7 rounded object-cover border border-slate-200"
                                    title={it.productName}
                                  />
                                ))}
                              </div>
                            </td>

                            <td className="p-4 font-black text-slate-900">
                              ₹{ord.total}
                            </td>

                            <td className="p-4">
                              <select
                                value={ord.orderStatus}
                                onChange={async (e) => {
                                  const newStatus = e.target.value as OrderStatus;
                                  // CRITICAL: Changing order status (even to delivered) does NOT mark order as paid!
                                  await updateOrderStatusByAdmin(ord.id, newStatus, ord.paymentStatus);
                                  showNotification(`Updated order status to ${newStatus} for ${ord.orderNumber}`);
                                  loadData();
                                }}
                                className="bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none focus:border-rose-400"
                              >
                                <option value="pending_confirmation">Pending Confirmation</option>
                                <option value="confirmed">Confirmed</option>
                                <option value="processing">Processing</option>
                                <option value="printing">Printing / Lab QC</option>
                                <option value="shipped">Shipped</option>
                                <option value="delivered">Delivered</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                            </td>

                            <td className="p-4">
                              {ord.paymentStatus === 'paid' ? (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    <span>Cash Collected (Paid)</span>
                                  </span>
                                  {ord.paidAt && (
                                    <p className="text-[10px] text-slate-400">
                                      {new Date(ord.paidAt).toLocaleDateString('en-IN', {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </p>
                                  )}
                                  {ord.cashCollectedConfirmedBy && (
                                    <p className="text-[9px] text-slate-400 truncate max-w-[120px]" title={ord.cashCollectedConfirmedBy}>
                                      by {ord.cashCollectedConfirmedBy.split('@')[0]}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                    <span>Pending Cash on Delivery</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const confirmAction = window.confirm(
                                        `Confirm authorized cash collection of ₹${ord.total} for order ${ord.orderNumber}?\n\nThis will permanently record that cash was verified and collected.`
                                      );
                                      if (confirmAction) {
                                        await updateOrderStatusByAdmin(ord.id, ord.orderStatus, 'paid');
                                        showNotification(`Cash confirmed & verified for order ${ord.orderNumber}!`);
                                        loadData();
                                      }
                                    }}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg shadow-2xs transition-colors block cursor-pointer"
                                  >
                                    Confirm Cash Collected
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* DELETE CONFIRMATION MODAL                                */}
      {/* ======================================================== */}
      {deleteConfirmProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="font-['Playfair_Display',serif] text-xl font-bold text-slate-900">
                Delete Product?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Are you sure you want to permanently delete <strong className="text-slate-800">"{deleteConfirmProduct.name}"</strong>? This will remove the photo item from your Firestore database and customer storefront.
              </p>
            </div>

            <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 flex items-center gap-3">
              <img
                src={resolveProductImageUrl(deleteConfirmProduct)}
                alt={deleteConfirmProduct.name}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = DEFAULT_FALLBACK_PRODUCT_IMAGE;
                }}
                className="w-12 h-12 rounded-xl object-cover border border-stone-200"
              />
              <div className="flex-1 min-w-0 text-xs">
                <p className="font-bold text-slate-900 truncate">{deleteConfirmProduct.name}</p>
                <p className="text-[11px] text-slate-500">₹{deleteConfirmProduct.price} • {deleteConfirmProduct.collectionId}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmProduct(null)}
                disabled={isDeleting}
                className="w-full py-2.5 bg-stone-100 hover:bg-stone-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/30 transition-all disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Yes, Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* EDIT / CREATE PRODUCT MODAL                              */}
      {/* ======================================================== */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
                  <Edit className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    {isEditingNew ? 'Add New Product to Gallery' : `Edit: ${editingProduct.name}`}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {isEditingNew ? 'Fill details to publish a new design' : 'Update photo, pricing, and visibility'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProductForm} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Product Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vintage Retro Photo Strip (Pack of 4)"
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl border-slate-200 font-medium text-slate-900 focus:outline-none focus:border-rose-400"
                />
              </div>

              {/* Photo Image with Direct Computer Upload & Web URL Option */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-semibold text-slate-700">
                    Product Photo <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowModalUrlInput(!showModalUrlInput)}
                    className="text-[11px] text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1 hover:underline"
                  >
                    <Link2 className="w-3 h-3" />
                    <span>{showModalUrlInput ? 'Hide Web URL link' : 'Or paste web image link'}</span>
                  </button>
                </div>

                {/* Primary: Attached Photo Card */}
                {editingProduct.imageUrl ? (
                  <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 flex items-center gap-3">
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-stone-200 bg-white shadow-2xs shrink-0">
                      <img
                        src={editingProduct.imageUrl}
                        alt="Product preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=300';
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <Check className="w-2.5 h-2.5" /> Photo Attached
                        </span>
                        <span className="text-[10px] text-slate-400 truncate">
                          {editingProduct.imageUrl.startsWith('http') ? 'Cloud / Online Link' : 'Stored File'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1 break-all font-mono">
                        {editingProduct.imageUrl}
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <label className="cursor-pointer px-2.5 py-1 bg-white hover:bg-stone-100 border border-stone-200 rounded-lg text-[11px] font-semibold text-slate-700 flex items-center gap-1 shadow-2xs transition-colors">
                          {uploadingModalImage ? (
                            <Loader2 className="w-3 h-3 animate-spin text-rose-600" />
                          ) : (
                            <Upload className="w-3 h-3 text-rose-600" />
                          )}
                          <span>{uploadingModalImage ? 'Uploading...' : 'Replace Photo'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            disabled={uploadingModalImage}
                            onChange={async (e) => {
                              if (e.target.files?.[0]) {
                                setUploadingModalImage(true);
                                try {
                                  const url = await uploadPhotoToFirebaseStorage(e.target.files[0], 'products');
                                  setEditingProduct({ ...editingProduct, imageUrl: url });
                                  showNotification('New photo uploaded to Firebase Storage!');
                                } catch (err: any) {
                                  alert(err.message);
                                } finally {
                                  setUploadingModalImage(false);
                                }
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setEditingProduct({ ...editingProduct, imageUrl: '' })}
                          className="px-2 py-1 text-slate-400 hover:text-rose-600 text-[11px] font-medium transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <label className="cursor-pointer block p-5 rounded-2xl border-2 border-dashed border-rose-200 hover:border-rose-400 bg-rose-50/40 hover:bg-rose-50/70 transition-all text-center group">
                    <div className="w-10 h-10 rounded-xl bg-white shadow-xs border border-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform">
                      {uploadingModalImage ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Upload className="w-5 h-5" />
                      )}
                    </div>
                    <p className="font-bold text-slate-800 text-xs">
                      {uploadingModalImage ? 'Uploading to Firebase Storage...' : 'Click to select photo from your computer'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      JPG, PNG, or WebP up to 10MB • No URL required!
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingModalImage}
                      onChange={async (e) => {
                        if (e.target.files?.[0]) {
                          setUploadingModalImage(true);
                          try {
                            const url = await uploadPhotoToFirebaseStorage(e.target.files[0], 'products');
                            setEditingProduct({ ...editingProduct, imageUrl: url });
                            showNotification('Photo uploaded to Firebase Storage!');
                          } catch (err: any) {
                            alert(err.message);
                          } finally {
                            setUploadingModalImage(false);
                          }
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                )}

                {/* Optional Web URL text box */}
                {showModalUrlInput && (
                  <div className="pt-1.5 space-y-1 bg-stone-50/80 p-3 rounded-xl border border-stone-200">
                    <label className="block text-[11px] font-medium text-slate-600">
                      Or paste an existing online image URL:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="https://images.unsplash.com/... or cloud link"
                        value={editingProduct.imageUrl}
                        onChange={(e) => setEditingProduct({ ...editingProduct, imageUrl: e.target.value })}
                        className="flex-1 px-3 py-1.5 bg-white border rounded-lg border-slate-200 text-xs font-mono focus:outline-none focus:border-rose-400"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Only use this if your image is already hosted online. Otherwise, use the file upload above.
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Collection *</label>
                  <select
                    value={editingProduct.collectionId || editingProduct.category}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        collectionId: e.target.value,
                        category: e.target.value as ProductCategory,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-xl border-slate-200 font-medium text-slate-800"
                  >
                    {collections.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pinterest Aspect Ratio</label>
                  <select
                    value={editingProduct.aspectRatio || 'portrait'}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        aspectRatio: e.target.value as AspectRatioType,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-xl border-slate-200 font-medium text-slate-800"
                  >
                    <option value="tall">Tall (Photostrip / Bookmark - 9:16)</option>
                    <option value="portrait">Portrait (Standard Poster - 3:4)</option>
                    <option value="square">Square (Polaroid / Mug - 1:1)</option>
                    <option value="wide">Wide (Canvas Landscape - 4:3)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Selling Price (₹ INR) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={editingProduct.price}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border rounded-xl border-slate-200 font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Original Price (₹)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={editingProduct.originalPrice}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        originalPrice: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-xl border-slate-200 text-slate-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Stock Count</label>
                  <input
                    type="number"
                    min={0}
                    value={editingProduct.stock || 100}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border rounded-xl border-slate-200 text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Style Aesthetic</label>
                  <select
                    value={editingProduct.style || 'Modern'}
                    onChange={(e) => setEditingProduct({ ...editingProduct, style: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl border-slate-200 text-slate-800"
                  >
                    {STYLES_LIST.filter(s => s !== 'All Styles').map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Badge Tag</label>
                  <input
                    type="text"
                    value={editingProduct.badge || ''}
                    placeholder="e.g. Bestseller, Trending"
                    onChange={(e) => setEditingProduct({ ...editingProduct, badge: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl border-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editingProduct.description}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl border-slate-200 text-slate-800"
                />
              </div>

              {/* Status Toggles in Modal */}
              <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={editingProduct.isActive}
                    onChange={(e) => setEditingProduct({ ...editingProduct, isActive: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Visible in Store (Published)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={editingProduct.isFeatured || false}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, isFeatured: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
                  />
                  <span>Featured on Homepage</span>
                </label>
              </div>

              <div className="pt-3 border-t border-stone-100 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProduct}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-rose-600/30 transition-all disabled:opacity-50"
                >
                  {isSavingProduct ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Product</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* CREATE COLLECTION MODAL                                  */}
      {/* ======================================================== */}
      {isCreatingCollection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">Create New Collection</h3>
              <button
                onClick={() => setIsCreatingCollection(false)}
                className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCollection} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Collection Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Wedding Memory Prints"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl border-slate-200"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Describe the aesthetic and type of photos in this collection..."
                  value={newCollectionDesc}
                  onChange={(e) => setNewCollectionDesc(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl border-slate-200"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cover Image URL / Upload</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://..."
                    value={newCollectionCover}
                    onChange={(e) => setNewCollectionCover(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-xl border-slate-200 text-xs"
                  />
                  <label className="cursor-pointer px-3 py-2 bg-stone-100 hover:bg-stone-200 text-slate-700 font-bold rounded-xl text-xs shrink-0 flex items-center gap-1">
                    {uploadingCover ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>{uploadingCover ? 'Uploading...' : 'Upload'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingCover}
                      onChange={async (e) => {
                        if (e.target.files?.[0]) {
                          setUploadingCover(true);
                          try {
                            const url = await uploadCustomPhoto(e.target.files[0]);
                            setNewCollectionCover(url);
                          } catch (err: any) {
                            alert(err.message);
                          } finally {
                            setUploadingCover(false);
                          }
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsCreatingCollection(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl"
                >
                  Create & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
