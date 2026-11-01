import React, { useState } from 'react';
import { 
  ShoppingBag, 
  User as UserIcon, 
  Menu, 
  X, 
  Camera, 
  Sparkles, 
  Search, 
  ShieldCheck, 
  LogOut, 
  PackageCheck,
  ChevronDown,
  Layers,
  Compass,
  Flame,
  Award,
  Image as ImageIcon,
  Clock
} from 'lucide-react';
import { useAuth } from '../services/authContext';
import { useCart } from '../services/cartContext';

interface NavbarProps {
  onNavigate: (route: string) => void;
  currentRoute: string;
  routeParam?: string;
  onOpenAuth: () => void;
  onSearchChange?: (query: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onNavigate,
  currentRoute,
  routeParam,
  onOpenAuth,
  onSearchChange,
}) => {
  const { currentUser, userProfile, isAdmin, logout } = useAuth();
  const { totalCount, setIsCartOpen } = useCart();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearchChange) {
      onSearchChange(searchQuery);
    }
    onNavigate('catalog');
  };

  const navLinks = [
    { label: 'Explore Feed', route: 'home' },
    { label: 'Collections', route: 'collections' },
    { label: 'Polaroid Photos', route: 'catalog?cat=polaroids' },
    { label: 'Retro Strips', route: 'catalog?cat=photo-strips' },
    { label: 'Vintage', route: 'catalog?cat=vintage' },
    { label: 'Cute & Pastel', route: 'catalog?cat=pastel' },
    { label: 'Custom Gifts', route: 'catalog?cat=gifts' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-rose-100/60 shadow-xs">
      {/* Top Banner Announcement */}
      <div className="bg-gradient-to-r from-rose-600 via-pink-600 to-amber-600 text-white text-[11px] font-medium py-1.5 px-4 text-center tracking-wide">
        <div className="container mx-auto flex items-center justify-center gap-2">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          <span>
            <strong>Festive Memories Special:</strong> Flat ₹150 OFF on orders ₹799+ with code <strong className="underline underline-offset-2">MEMOLIFE</strong> • 10% OFF with code <strong className="underline underline-offset-2">MEMO10</strong> • Free Doorstep Delivery on ₹499+
          </span>
        </div>
      </div>

      {/* Main Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-4">
          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          {/* Brand Logo */}
          <div 
            onClick={() => onNavigate('home')}
            className="cursor-pointer flex items-center gap-2.5 shrink-0 select-none group"
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-400 flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
              <Camera className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="font-['Playfair_Display',serif] text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                  Memo<span className="text-rose-600">Print</span>
                </span>
                <span className="text-[10px] uppercase font-bold text-amber-600 tracking-wider">
                  India
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium hidden sm:block -mt-1">
                Visual Photo Inspiration
              </p>
            </div>
          </div>

          {/* Search bar on desktop */}
          <form 
            onSubmit={handleSearch}
            className="hidden lg:flex items-center flex-1 max-w-md mx-6"
          >
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search Polaroids, photostrips, vintage aesthetic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-stone-100/80 hover:bg-stone-100 focus:bg-white border border-stone-200 rounded-full text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all"
              />
            </div>
          </form>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center space-x-5 text-xs font-semibold text-slate-700">
            <button
              onClick={() => onNavigate('home')}
              className={`hover:text-rose-600 transition-colors flex items-center gap-1 ${
                currentRoute === 'home' ? 'text-rose-600 font-bold' : ''
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-rose-500" />
              <span>Explore</span>
            </button>

            <button
              onClick={() => onNavigate('collections')}
              className={`hover:text-rose-600 transition-colors flex items-center gap-1 ${
                currentRoute === 'collections' ? 'text-rose-600 font-bold' : ''
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-amber-500" />
              <span>Collections</span>
            </button>

            <button
              onClick={() => onNavigate('catalog')}
              className={`hover:text-rose-600 transition-colors flex items-center gap-1 ${
                currentRoute === 'catalog' ? 'text-rose-600 font-bold' : ''
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-slate-400" />
              <span>Search & Filter</span>
            </button>
          </nav>

          {/* Action Icons */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            {/* Admin Badge shortcut - strictly restricted to authorized administrators */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => onNavigate('admin')}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-900/90 text-purple-100 hover:bg-purple-900 text-[11px] font-bold shadow-xs transition-colors border border-purple-700/50"
                title="Store Administrator Panel"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                <span>Admin</span>
              </button>
            )}

            {/* User Account / Profile */}
            {currentUser ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-1.5 p-1.5 rounded-full hover:bg-slate-100 border border-slate-200/80 transition-colors"
                >
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt="Avatar"
                      className="w-7 h-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center">
                      {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
                    </div>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 mr-1" />
                </button>

                {/* Dropdown Menu */}
                {profileDropdownOpen && (
                  <div 
                    onClick={() => setProfileDropdownOpen(false)}
                    className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in zoom-in-95"
                  >
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {currentUser.displayName || 'Customer'}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {currentUser.email}
                      </p>
                    </div>

                    <button
                      onClick={() => onNavigate('account')}
                      className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-rose-50 hover:text-rose-700 flex items-center gap-2"
                    >
                      <PackageCheck className="w-4 h-4 text-slate-500" />
                      <span>My Orders & Status</span>
                    </button>

                    {isAdmin && (
                      <button
                        onClick={() => onNavigate('admin')}
                        className="w-full px-4 py-2 text-left text-xs text-purple-700 hover:bg-purple-50 flex items-center gap-2 font-semibold"
                      >
                        <ShieldCheck className="w-4 h-4 text-purple-600" />
                        <span>Admin Gallery Manager</span>
                      </button>
                    )}

                    <div className="border-t border-slate-100 mt-1 pt-1">
                      <button
                        onClick={logout}
                        className="w-full px-4 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-slate-200"
              >
                <UserIcon className="w-4 h-4 text-slate-500" />
                <span>Sign In</span>
              </button>
            )}

            {/* Cart Trigger */}
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors flex items-center justify-center shadow-xs"
              title="Shopping Cart"
            >
              <ShoppingBag className="w-5 h-5 text-rose-600" />
              {totalCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-600 text-white font-extrabold text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                  {totalCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 7 Core Store Sections Bar */}
      <div className="bg-stone-50/95 border-t border-stone-200/70 hidden sm:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between overflow-x-auto py-2 gap-1.5 scrollbar-none text-xs">
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {/* 1. Polaroid Prints */}
              <button
                type="button"
                onClick={() => onNavigate('catalog?cat=polaroids')}
                className={`px-3 py-1.5 rounded-full font-semibold transition-all flex items-center gap-1.5 ${
                  currentRoute === 'catalog' && (routeParam === 'polaroids' || routeParam === 'polaroid-prints')
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-700 hover:text-rose-600 hover:bg-white'
                }`}
                title="All your available Polaroid designs"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Polaroid Prints</span>
              </button>

              {/* 2. Posters */}
              <button
                type="button"
                onClick={() => onNavigate('catalog?cat=posters')}
                className={`px-3 py-1.5 rounded-full font-semibold transition-all flex items-center gap-1.5 ${
                  currentRoute === 'catalog' && routeParam === 'posters'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-700 hover:text-rose-600 hover:bg-white'
                }`}
                title="All your available poster designs"
              >
                <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                <span>Posters</span>
              </button>

              {/* 3. Best Sellers */}
              <button
                type="button"
                onClick={() => onNavigate('catalog?cat=best-sellers')}
                className={`px-3 py-1.5 rounded-full font-semibold transition-all flex items-center gap-1.5 ${
                  currentRoute === 'catalog' && routeParam === 'best-sellers'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-700 hover:text-rose-600 hover:bg-white'
                }`}
                title="Your most popular products"
              >
                <Award className="w-3.5 h-3.5 text-amber-500" />
                <span>Best Sellers</span>
                <span className="text-[9px] px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded-full font-bold">Hot</span>
              </button>

              {/* 4. New Arrivals */}
              <button
                type="button"
                onClick={() => onNavigate('catalog?cat=new-arrivals')}
                className={`px-3 py-1.5 rounded-full font-semibold transition-all flex items-center gap-1.5 ${
                  currentRoute === 'catalog' && routeParam === 'new-arrivals'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-700 hover:text-rose-600 hover:bg-white'
                }`}
                title="Recently added designs"
              >
                <Flame className="w-3.5 h-3.5 text-rose-500" />
                <span>New Arrivals</span>
                <span className="text-[9px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-full font-bold">New</span>
              </button>

              {/* 5. Bundles & Sets */}
              <button
                type="button"
                onClick={() => onNavigate('catalog?cat=bundles')}
                className={`px-3 py-1.5 rounded-full font-semibold transition-all flex items-center gap-1.5 ${
                  currentRoute === 'catalog' && (routeParam === 'bundles' || routeParam === 'bundles-sets')
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-700 hover:text-rose-600 hover:bg-white'
                }`}
                title="Product combinations you offer"
              >
                <PackageCheck className="w-3.5 h-3.5 text-purple-500" />
                <span>Bundles & Sets</span>
                <span className="text-[9px] px-1.5 py-0.2 bg-purple-100 text-purple-800 rounded-full font-bold">Save ₹</span>
              </button>
            </div>

            {/* Customer & Admin Access Portals */}
            <div className="flex items-center gap-2 pl-3 border-l border-stone-200/90 shrink-0">
              {/* 6. My Orders */}
              <button
                type="button"
                onClick={() => onNavigate('account')}
                className={`px-3 py-1.5 rounded-full font-semibold transition-all flex items-center gap-1.5 ${
                  currentRoute === 'account'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-white'
                }`}
                title="Customers' order history and status"
              >
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>My Orders</span>
              </button>

              {/* 7. Admin Dashboard (authorized admins only) */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => onNavigate('admin')}
                  className={`px-3 py-1.5 rounded-full font-semibold transition-all flex items-center gap-1.5 ${
                    currentRoute === 'admin'
                      ? 'bg-purple-900 text-white shadow-xs'
                      : 'text-purple-700 hover:text-purple-900 hover:bg-purple-50'
                  }`}
                  title="Your product uploads and order management"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                  <span>Admin Dashboard</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-slate-100 px-4 pt-3 pb-6 space-y-4">
          <form onSubmit={handleSearch} className="mb-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search designs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>
          </form>

          {/* Section Grid for Mobile */}
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">
              Store Sections
            </p>
            <div className="space-y-1.5">
              <button
                onClick={() => {
                  onNavigate('catalog?cat=polaroids');
                  setMobileMenuOpen(false);
                }}
                className="w-full p-2.5 text-left rounded-xl hover:bg-rose-50 flex items-center justify-between bg-stone-50 text-xs"
              >
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-rose-600" />
                  <div>
                    <p className="font-bold text-slate-800">Polaroid Prints</p>
                    <p className="text-[10px] text-slate-500">All your available Polaroid designs</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  onNavigate('catalog?cat=posters');
                  setMobileMenuOpen(false);
                }}
                className="w-full p-2.5 text-left rounded-xl hover:bg-rose-50 flex items-center justify-between bg-stone-50 text-xs"
              >
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="font-bold text-slate-800">Posters</p>
                    <p className="text-[10px] text-slate-500">All your available poster designs</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  onNavigate('catalog?cat=best-sellers');
                  setMobileMenuOpen(false);
                }}
                className="w-full p-2.5 text-left rounded-xl hover:bg-rose-50 flex items-center justify-between bg-stone-50 text-xs"
              >
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-600" />
                  <div>
                    <p className="font-bold text-slate-800">Best Sellers</p>
                    <p className="text-[10px] text-slate-500">Your most popular products</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  onNavigate('catalog?cat=new-arrivals');
                  setMobileMenuOpen(false);
                }}
                className="w-full p-2.5 text-left rounded-xl hover:bg-rose-50 flex items-center justify-between bg-stone-50 text-xs"
              >
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-rose-600" />
                  <div>
                    <p className="font-bold text-slate-800">New Arrivals</p>
                    <p className="text-[10px] text-slate-500">Recently added designs</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  onNavigate('catalog?cat=bundles');
                  setMobileMenuOpen(false);
                }}
                className="w-full p-2.5 text-left rounded-xl hover:bg-rose-50 flex items-center justify-between bg-stone-50 text-xs"
              >
                <div className="flex items-center gap-2">
                  <PackageCheck className="w-4 h-4 text-purple-600" />
                  <div>
                    <p className="font-bold text-slate-800">Bundles & Sets</p>
                    <p className="text-[10px] text-slate-500">Product combinations you offer</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  onNavigate('account');
                  setMobileMenuOpen(false);
                }}
                className="w-full p-2.5 text-left rounded-xl hover:bg-slate-100 flex items-center justify-between bg-stone-100/80 text-xs"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-700" />
                  <div>
                    <p className="font-bold text-slate-900">My Orders</p>
                    <p className="text-[10px] text-slate-500">Customers' order history and status</p>
                  </div>
                </div>
              </button>

              {isAdmin && (
                <button
                  onClick={() => {
                    onNavigate('admin');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full p-2.5 text-left rounded-xl bg-purple-950 text-white flex items-center justify-between text-xs border border-purple-800/60"
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-purple-400" />
                    <div>
                      <p className="font-bold text-white">Admin Dashboard</p>
                      <p className="text-[10px] text-purple-200">Your product uploads and order management</p>
                    </div>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
