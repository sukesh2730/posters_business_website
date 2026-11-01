import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './services/authContext';
import { CartProvider, useCart } from './services/cartContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/CartDrawer';
import { AuthModal } from './components/AuthModal';
import { QuickViewModal } from './components/QuickViewModal';

import { HomePage } from './pages/HomePage';
import { CatalogPage } from './pages/CatalogPage';
import { CollectionsPage } from './pages/CollectionsPage';
import { CustomizePage } from './pages/CustomizePage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderSuccessPage } from './pages/OrderSuccessPage';
import { AccountPage } from './pages/AccountPage';
import { AdminPage } from './pages/AdminPage';
import { ContactPage } from './pages/ContactPage';
import { FAQPage } from './pages/FAQPage';
import { PolicyPages } from './pages/PolicyPages';

import { getProductsCatalog, getStoreCollections } from './services/orderService';
import { Product, Order, CollectionInfo } from './types';
import { DEFAULT_PRODUCTS, COLLECTIONS } from './data/defaultProducts';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './services/firebase';
import { handleFirestoreError, OperationType } from './services/firestoreErrorHandler';

function MainApp() {
  const { currentUser, isAdmin } = useAuth();
  const { setIsCartOpen } = useCart();

  // Navigation State
  const [currentRoute, setCurrentRoute] = useState<string>('home');
  const [routeParam, setRouteParam] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Products & Collections state
  const [products, setProducts] = useState<Product[]>(DEFAULT_PRODUCTS);
  const [collections, setCollections] = useState<CollectionInfo[]>(COLLECTIONS);
  const [selectedProduct, setSelectedProduct] = useState<Product>(DEFAULT_PRODUCTS[0]);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  // Completed order for success page
  const [lastCompletedOrder, setLastCompletedOrder] = useState<Order | null>(null);

  // Modals
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const refreshCatalogAndCollections = () => {
    getProductsCatalog().then((prods) => {
      if (prods && prods.length > 0) {
        setProducts(prods);
        setSelectedProduct(prods[0]);
      }
    });
    getStoreCollections().then((cols) => {
      if (cols && cols.length > 0) {
        setCollections(cols);
      }
    });
  };

  useEffect(() => {
    refreshCatalogAndCollections();

    // Real-time synchronization when images/products are added or updated
    try {
      const unsubscribe = onSnapshot(
        collection(db, 'products'),
        () => {
          refreshCatalogAndCollections();
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, 'products');
        }
      );
      return () => unsubscribe();
    } catch {
      // Offline fallback
    }
  }, []);

  // Parse route navigation helper
  const handleNavigate = (routeStr: string) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (routeStr.includes('?cat=')) {
      const parts = routeStr.split('?cat=');
      setCurrentRoute(parts[0]);
      setRouteParam(parts[1]);
      return;
    }

    if (routeStr.includes('?section=')) {
      const parts = routeStr.split('?section=');
      setCurrentRoute(parts[0]);
      setRouteParam(parts[1]);
      return;
    }

    // Direct section shortcuts
    if (routeStr === 'polaroids' || routeStr === 'polaroid-prints') {
      setCurrentRoute('catalog');
      setRouteParam('polaroids');
      return;
    }
    if (routeStr === 'posters') {
      setCurrentRoute('catalog');
      setRouteParam('posters');
      return;
    }
    if (routeStr === 'best-sellers') {
      setCurrentRoute('catalog');
      setRouteParam('best-sellers');
      return;
    }
    if (routeStr === 'new-arrivals') {
      setCurrentRoute('catalog');
      setRouteParam('new-arrivals');
      return;
    }
    if (routeStr === 'bundles' || routeStr === 'bundles-sets') {
      setCurrentRoute('catalog');
      setRouteParam('bundles');
      return;
    }
    if (routeStr === 'my-orders') {
      setCurrentRoute('account');
      setRouteParam(undefined);
      return;
    }

    setCurrentRoute(routeStr);
    setRouteParam(undefined);
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setCurrentRoute('customize');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuickView = (product: Product) => {
    setQuickViewProduct(product);
  };

  const handleSelectCollection = (collectionId: string) => {
    setRouteParam(collectionId);
    setCurrentRoute('catalog');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOrderSuccess = (order: Order) => {
    setLastCompletedOrder(order);
    setCurrentRoute('order-success');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#faf8f5]">
      {/* Navigation Bar */}
      <Navbar
        onNavigate={handleNavigate}
        currentRoute={currentRoute}
        routeParam={routeParam}
        onOpenAuth={() => setIsAuthOpen(true)}
        onSearchChange={(q) => {
          setSearchQuery(q);
          setRouteParam(undefined);
        }}
      />

      {/* Main Page Content */}
      <main className="flex-1">
        {currentRoute === 'home' && (
          <HomePage
            products={products}
            collections={collections}
            onNavigate={handleNavigate}
            onSelectProduct={handleSelectProduct}
            onQuickView={handleQuickView}
            onSelectCollection={handleSelectCollection}
          />
        )}

        {currentRoute === 'collections' && (
          <CollectionsPage
            products={products}
            collections={collections}
            onSelectCollection={handleSelectCollection}
          />
        )}

        {currentRoute === 'catalog' && (
          <CatalogPage
            products={products}
            collections={collections}
            initialCategory={routeParam || 'all'}
            initialSearch={searchQuery}
            onSelectProduct={handleSelectProduct}
            onQuickView={handleQuickView}
          />
        )}

        {currentRoute === 'customize' && (
          <CustomizePage
            product={selectedProduct}
            onBack={() => handleNavigate('catalog')}
            onOpenCart={() => setIsCartOpen(true)}
          />
        )}

        {currentRoute === 'checkout' && (
          <CheckoutPage
            onBackToCart={() => setIsCartOpen(true)}
            onOrderSuccess={handleOrderSuccess}
            onOpenAuth={() => setIsAuthOpen(true)}
          />
        )}

        {currentRoute === 'order-success' && lastCompletedOrder && (
          <OrderSuccessPage
            order={lastCompletedOrder}
            onNavigateHome={() => handleNavigate('home')}
            onNavigateOrders={() => handleNavigate('account')}
          />
        )}

        {currentRoute === 'account' && (
          <AccountPage
            onExplore={() => handleNavigate('catalog')}
            onOpenAuth={() => setIsAuthOpen(true)}
          />
        )}

        {currentRoute === 'admin' && (
          <AdminPage 
            onBackToStore={() => {
              refreshCatalogAndCollections();
              handleNavigate('home');
            }} 
            onCatalogUpdated={refreshCatalogAndCollections}
          />
        )}

        {currentRoute === 'contact' && <ContactPage />}

        {currentRoute === 'faq' && <FAQPage />}

        {currentRoute === 'privacy-policy' && <PolicyPages initialPolicy="privacy" />}
        {currentRoute === 'shipping-policy' && <PolicyPages initialPolicy="shipping" />}
        {currentRoute === 'cancellation-refund' && <PolicyPages initialPolicy="refund" />}
        {currentRoute === 'terms' && <PolicyPages initialPolicy="terms" />}
      </main>

      {/* Sliding Cart Drawer */}
      <CartDrawer
        onProceedToCheckout={() => handleNavigate('checkout')}
        onExploreProducts={() => handleNavigate('home')}
      />

      {/* Auth Modal */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

      {/* Quick View / Product Detail Modal */}
      <QuickViewModal
        product={quickViewProduct}
        allProducts={products}
        onClose={() => setQuickViewProduct(null)}
        onCustomize={handleSelectProduct}
        onSelectProduct={(p) => {
          setQuickViewProduct(p);
        }}
      />

      {/* Global Footer */}
      <Footer onNavigate={handleNavigate} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <MainApp />
      </CartProvider>
    </AuthProvider>
  );
}
