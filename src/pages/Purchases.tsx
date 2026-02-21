import { useState, useEffect } from 'react';
import { Plus, Trash2, Clock, X, Filter, Search, RefreshCw, ShoppingCart, ArrowDownLeft, MapPin, Send, Package, Minus } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import type { Product, Site } from '../types';
import { useAuth } from '../hooks/useAuth';
import { logAudit } from '../lib/audit';
import clsx from 'clsx';

export default function Purchases() {
    const { profile } = useAuth();
    const [selectedSite, setSelectedSite] = useState<Site>('abidjan');
    const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
    const [products, setProducts] = useState<Product[]>([]);
    const [items, setItems] = useState<{ productId: string, quantity: number, site: Site }[]>([]);
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState<any[]>([]);

    // UI States
    const [selectedMovement, setSelectedMovement] = useState<any | null>(null);
    const [showFilters, setShowFilters] = useState(false);

    // Filter States
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        productId: '',
        site: '',
        search: ''
    });

    // Browse States
    const [viewMode, setViewMode] = useState<'categories' | 'products'>('categories');
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const categories = Array.from(new Set(products.map(p => p.category))).sort();

    useEffect(() => {
        if (profile) {
            setSelectedSite(profile.site);
        }
    }, [profile]);

    useEffect(() => {
        if (profile) fetchProducts();
        if (activeTab === 'history') {
            fetchHistory();
        }
    }, [activeTab, profile, filters, selectedSite]);

    const fetchProducts = async () => {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('site', selectedSite)
                .neq('category', 'ARCHIVED')
                .order('name', { ascending: true });
            if (error) throw error;
            setProducts(data || []);
        } catch (error: any) {
            console.error('Error fetching products:', error);
            toast.error("Erreur lors du chargement des produits");
        }
    };

    const fetchHistory = async () => {
        try {
            setLoading(true);
            let query = supabase
                .from('stock_movements')
                .select(`
                    *,
                    product:products(name, category),
                    performer:profiles!stock_movements_performed_by_fkey(full_name, username)
                `)
                .eq('type', 'IN')
                .order('created_at', { ascending: false });

            // Site Filter
            query = query.eq('site', selectedSite);

            if (profile?.role !== 'admin') {
                query = query.eq('performed_by', profile?.id);
            }

            if (filters.startDate) {
                query = query.gte('created_at', filters.startDate);
            }
            if (filters.endDate) {
                query = query.lte('created_at', filters.endDate + 'T23:59:59');
            }
            if (filters.productId) {
                query = query.eq('product_id', filters.productId);
            }
            if (filters.search) {
                // 1. Search matching products first (name or category)
                const { data: matchingProducts, error: pError } = await supabase
                    .from('products')
                    .select('id')
                    .or(`name.ilike.%${filters.search}%,category.ilike.%${filters.search}%`);

                if (pError) {
                    console.error('Error searching products:', pError);
                    throw pError;
                }

                const productIds = matchingProducts?.map(p => p.id) || [];

                // 2. Search by reference OR matching product IDs
                if (productIds.length > 0) {
                    query = query.or(`reference.ilike.%${filters.search}%,product_id.in.(${productIds.join(',')})`);
                } else {
                    query = query.ilike('reference', `%${filters.search}%`);
                }
            }

            const { data, error } = await query.limit(50);
            if (error) {
                console.error('Error fetching history:', error);
                throw error;
            }
            setHistory(data || []);
        } catch (error: any) {
            console.error('Fetch history failed:', error);
            toast.error("Erreur de chargement de l'historique");
        } finally {
            setLoading(false);
        }
    };

    const updateTicket = (productId: string, newQuantity: number) => {
        if (newQuantity <= 0) {
            setItems(items.filter(i => i.productId !== productId));
        } else {
            const existing = items.find(i => i.productId === productId);
            if (existing) {
                setItems(items.map(i => i.productId === productId ? { ...i, quantity: newQuantity } : i));
            } else {
                setItems([...items, { productId, quantity: newQuantity, site: selectedSite }]);
            }
        }
    };

    const handleSubmit = async () => {
        if (items.length === 0 || items.some(i => !i.productId || i.quantity <= 0)) {
            toast.error("Veuillez remplir tous les champs correctement");
            return;
        }

        setLoading(true);
        try {
            const reference = `PUR-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

            for (const item of items) {
                const { data: product, error: pError } = await supabase
                    .from('products')
                    .select('*')
                    .eq('id', item.productId)
                    .single();

                if (pError) throw pError;

                const stockField = item.site === 'abidjan' ? 'stock_abidjan' : 'stock_bassam';
                const currentStock = product[stockField] || 0;

                const { error: mError } = await supabase
                    .from('stock_movements')
                    .insert({
                        product_id: item.productId,
                        type: 'IN',
                        quantity: item.quantity,
                        site: item.site,
                        performed_by: profile?.id,
                        reference: reference
                    });

                if (mError) throw mError;

                const { error: uError } = await supabase
                    .from('products')
                    .update({ [stockField]: currentStock + item.quantity })
                    .eq('id', item.productId);

                if (uError) throw uError;
            }

            await logAudit({
                action_type: 'CREATE',
                entity_type: 'STOCK_MOVEMENT',
                entity_id: reference,
                site: items[0]?.site || selectedSite,
                details: { items_count: items.length, reference }
            }, profile);

            toast.success("Achats enregistrés avec succès !");
            setItems([]);
            setActiveTab('history');
        } catch (error: any) {
            toast.error("Erreur lors de l'enregistrement : " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const resetFilters = () => {
        setFilters({
            startDate: '',
            endDate: '',
            productId: '',
            site: '',
            search: ''
        });
    };

    return (
        <div className="min-h-screen bg-gray-50/50 pb-20 font-['Outfit']">
            {/* Sticky Header — Re-styled to match Needs Header */}
            <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-gray-100 shadow-sm animate-in slide-in-from-top duration-500">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 sm:h-24 gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-brand-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-brand-100 ring-4 ring-brand-50">
                                <ShoppingCart className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-gray-900 tracking-tight leading-none">Achats & Entrées</h1>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-1.5">Approvisionnement</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center">
                            {profile?.role === 'admin' ? (
                                <div className="flex bg-gray-100/50 p-1 rounded-xl border border-gray-100">
                                    {['abidjan', 'bassam'].map((site) => (
                                        <button
                                            key={site}
                                            onClick={() => setSelectedSite(site as Site)}
                                            className={clsx(
                                                "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                                selectedSite === site
                                                    ? "bg-white text-brand-600 shadow-sm"
                                                    : "text-gray-400 hover:text-gray-600"
                                            )}
                                        >
                                            {site}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-white border border-gray-100 rounded-xl py-2 px-4 shadow-sm flex items-center gap-2">
                                    <MapPin className="w-3.5 h-3.5 text-brand-500" />
                                    <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest">{profile?.site}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Tab Navigation & Search */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 gap-4">
                        <div className="flex p-1 bg-gray-100/50 rounded-xl border border-gray-100 w-full md:w-auto">
                            <button
                                onClick={() => setActiveTab('new')}
                                className={clsx(
                                    "flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                    activeTab === 'new' ? "bg-white text-brand-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                                )}
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Nouveau</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={clsx(
                                    "flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                    activeTab === 'history' ? "bg-white text-brand-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                                )}
                            >
                                <Clock className="w-3.5 h-3.5" />
                                <span>Historique</span>
                            </button>
                        </div>

                        {activeTab === 'history' && (
                            <div className="flex items-center gap-2 w-full md:max-w-md">
                                <div className="relative flex-1 group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-focus-within:text-brand-500 transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Rechercher par référence..."
                                        value={filters.search}
                                        onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                        className="w-full bg-gray-50 border-transparent focus:bg-white focus:border-brand-200 rounded-xl py-2 pl-9 pr-4 text-[11px] font-black outline-none transition-all"
                                    />
                                </div>
                                <button
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={clsx(
                                        "p-2 rounded-xl border transition-all",
                                        showFilters ? "bg-brand-50 border-brand-200 text-brand-600 shadow-sm shadow-brand-100" : "bg-white border-gray-200 text-gray-400 hover:text-brand-600"
                                    )}
                                >
                                    <Filter className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
                {/* Advanced Filters Panel */}
                {activeTab === 'history' && showFilters && (
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 mb-8 mt-4 animate-in slide-in-from-top-4 duration-500">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Période (Début)</label>
                                <input
                                    type="date"
                                    value={filters.startDate}
                                    onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                    className="w-full px-3 py-2 bg-gray-50 border border-transparent rounded-lg text-[11px] font-black outline-none focus:bg-white focus:border-brand-200 transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Période (Fin)</label>
                                <input
                                    type="date"
                                    value={filters.endDate}
                                    onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                                    className="w-full px-3 py-2 bg-gray-50 border border-transparent rounded-lg text-[11px] font-black outline-none focus:bg-white focus:border-brand-200 transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Produit spécifique</label>
                                <div className="flex gap-2">
                                    <select
                                        value={filters.productId}
                                        onChange={(e) => setFilters(prev => ({ ...prev, productId: e.target.value }))}
                                        className="flex-1 px-3 py-2 bg-gray-50 border border-transparent rounded-lg text-[11px] font-black outline-none focus:bg-white focus:border-brand-200 transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">Tous les produits</option>
                                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                    <button
                                        onClick={resetFilters}
                                        className="p-2 bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'new' ? (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="flex-1 w-full pb-32 lg:pb-8 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            {/* Search and Category Navigation */}
                            <div className="bg-white p-2 rounded-2xl border border-gray-100 flex items-center gap-2 shadow-sm sticky top-0 md:top-2 z-10 transition-all">
                                {viewMode === 'products' ? (
                                    <button
                                        onClick={() => { setViewMode('categories'); setActiveCategory(null); setSearchTerm(''); }}
                                        className="p-3 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all"
                                    >
                                        <svg className="w-5 h-5 lg:w-4 lg:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                    </button>
                                ) : (
                                    <div className="pl-4">
                                        <Search className="w-5 h-5 text-gray-300" />
                                    </div>
                                )}
                                <div className="flex-1 relative">
                                    <input
                                        type="text"
                                        placeholder={viewMode === 'categories' ? "Rechercher un produit ou une catégorie..." : `Rechercher dans ${activeCategory || 'les produits'}...`}
                                        value={searchTerm}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            // if (e.target.value && viewMode === 'categories') {
                                            //     setViewMode('products');
                                            //     setActiveCategory(null);
                                            // }
                                        }}
                                        className="w-full px-2 py-3 bg-transparent text-[11px] lg:text-sm font-black outline-none placeholder:text-gray-300 placeholder:font-bold uppercase tracking-wide"
                                    />
                                </div>
                                {searchTerm && (
                                    <button
                                        onClick={() => {
                                            setSearchTerm('');
                                            if (!activeCategory) setViewMode('categories');
                                        }}
                                        className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {viewMode === 'categories' ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {categories
                                        .filter(category => category.toLowerCase().includes(searchTerm.toLowerCase()))
                                        .map(category => {
                                            const categoryProducts = products.filter(p => p.category === category);
                                            const count = categoryProducts.length;
                                            return (
                                                <div
                                                    key={category}
                                                    onClick={() => {
                                                        setActiveCategory(category);
                                                        setViewMode('products');
                                                        setSearchTerm('');
                                                    }}
                                                    className="bg-white rounded-2xl p-5 border border-gray-100 hover:border-brand-300 hover:shadow-xl transition-all cursor-pointer group flex flex-col items-center justify-center text-center aspect-square md:aspect-auto md:h-32 shadow-sm"
                                                >
                                                    <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                                        <Package className="w-6 h-6" />
                                                    </div>
                                                    <h3 className="font-black text-gray-900 text-[11px] uppercase tracking-widest leading-tight">{category}</h3>
                                                    <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase">{count} produits</p>
                                                </div>
                                            );
                                        })}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {products.filter(p => {
                                        if (searchTerm) {
                                            return p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.category.toLowerCase().includes(searchTerm.toLowerCase());
                                        }
                                        if (activeCategory) {
                                            return p.category === activeCategory;
                                        }
                                        return true;
                                    }).map(product => {
                                        const stockField = selectedSite === 'abidjan' ? 'stock_abidjan' : 'stock_bassam';
                                        const stock = (product as any)[stockField] || 0;
                                        const itemInCart = items.find(i => i.productId === product.id);
                                        const inCart = !!itemInCart;
                                        const quantity = itemInCart?.quantity || 0;

                                        return (
                                            <div
                                                key={product.id}
                                                onClick={() => {
                                                    if (!inCart) updateTicket(product.id, 1);
                                                }}
                                                className={clsx(
                                                    "bg-white rounded-2xl p-4 flex flex-col transition-all duration-300 select-none cursor-pointer",
                                                    inCart
                                                        ? "border-2 border-brand-500 shadow-md transform -translate-y-1"
                                                        : "border border-gray-100 hover:border-brand-200 hover:shadow-lg opacity-90 hover:opacity-100"
                                                )}
                                            >
                                                <div className="flex justify-between items-start mb-3 gap-2">
                                                    <h3 className="font-black text-gray-900 text-[10px] lg:text-xs uppercase leading-tight tracking-tight line-clamp-2">{product.name}</h3>
                                                    <span className="px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest whitespace-nowrap bg-red-50 text-red-600 border border-red-100">
                                                        {stock} En stock
                                                    </span>
                                                </div>

                                                <div className="mt-auto pt-4 flex items-center justify-between">
                                                    <div className="text-[8px] lg:text-[9px] font-black text-gray-300 uppercase tracking-widest truncate max-w-[80px]">
                                                        {product.category}
                                                    </div>

                                                    {!inCart ? (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); updateTicket(product.id, 1); }}
                                                            className="w-8 h-8 lg:w-9 lg:h-9 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-brand-50 hover:text-brand-600 transition-colors shadow-sm"
                                                        >
                                                            <Plus className="w-4 h-4" />
                                                        </button>
                                                    ) : (
                                                        <div
                                                            className="flex items-center gap-1 bg-brand-50 rounded-xl p-1 shadow-inner"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); updateTicket(product.id, quantity - 1); }}
                                                                className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-brand-600 shadow-sm active:scale-95 transition-all"
                                                            >
                                                                <Minus className="w-3.5 h-3.5" />
                                                            </button>
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                value={quantity || ''}
                                                                onChange={(e) => {
                                                                    let val = parseInt(e.target.value);
                                                                    if (isNaN(val)) val = 0;
                                                                    updateTicket(product.id, val);
                                                                }}
                                                                className="w-7 h-7 bg-transparent border-none text-center font-black text-sm text-brand-900 tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0 m-0"
                                                            />
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); updateTicket(product.id, quantity + 1); }}
                                                                className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-brand-600 shadow-sm active:scale-95 transition-all"
                                                            >
                                                                <Plus className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Submit Section */}
                            {items.length > 0 && (
                                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-[90] animate-in slide-in-from-bottom-10 duration-700">
                                    <button
                                        onClick={handleSubmit}
                                        disabled={loading}
                                        className="w-full bg-gray-900 text-white rounded-[2rem] py-5 px-8 font-black text-xs uppercase tracking-[0.3em] shadow-2xl shadow-gray-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-4 group overflow-hidden relative"
                                    >
                                        <div className="absolute inset-0 bg-brand-600 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                                        <div className="relative flex items-center gap-4">
                                            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                            <span>Valider {items.length} achat{items.length > 1 ? 's' : ''} ({items.reduce((acc, curr) => acc + curr.quantity, 0)} au total)</span>
                                        </div>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {loading && history.length === 0 ? (
                            <div className="col-span-full py-20 text-center">
                                <RefreshCw className="w-10 h-10 animate-spin text-brand-600 mx-auto opacity-20" />
                            </div>
                        ) : history.length === 0 ? (
                            <div className="col-span-full py-32 text-center bg-gray-50/50 rounded-[3rem] border-2 border-dashed border-gray-100 italic font-medium text-gray-400">
                                Aucun historique trouvé pour les critères sélectionnés.
                            </div>
                        ) : (
                            history.map((m) => (
                                <div
                                    key={m.id}
                                    onClick={() => setSelectedMovement(m)}
                                    className="bg-white rounded-[2.5rem] p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-brand-500/5 transition-all duration-500 flex flex-col group cursor-pointer relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ArrowDownLeft className="w-4 h-4 text-brand-600" />
                                    </div>

                                    <div className="flex items-start gap-4 mb-6">
                                        <div className="w-14 h-14 bg-gray-50 rounded-2xl flex-shrink-0 flex items-center justify-center text-xl shadow-inner border border-gray-100 group-hover:bg-brand-50 group-hover:border-brand-100 transition-colors">
                                            📦
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-[13px] font-black text-gray-900 group-hover:text-brand-600 transition-colors truncate uppercase tracking-tight">
                                                {m.product?.name}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-black text-brand-500 uppercase tracking-widest bg-brand-50 px-2 py-0.5 rounded-md">Entrée</span>
                                                <span className="text-[9px] font-bold text-gray-400 font-mono">#{m.reference?.slice(-6) || m.id.slice(0, 6)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-auto space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white shadow-sm flex items-center justify-center text-brand-600 font-black text-[10px] italic">
                                                    {m.performer?.full_name?.[0] || 'U'}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Par</p>
                                                    <p className="text-[10px] font-black text-gray-900 leading-none truncate">{m.performer?.full_name}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Quantité</p>
                                                <p className="text-xl font-black text-brand-600 leading-none tabular-nums">+{m.quantity}</p>
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                                            <span className="text-[9px] font-black text-gray-300 uppercase tracking-[0.2em]">{m.site}</span>
                                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                                {new Date(m.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Details Modal — Re-styled to match Sites Detail Modal */}
            {selectedMovement && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">
                        {/* Compact Header */}
                        <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 bg-gray-50/80">
                            <div className="w-12 h-12 rounded-xl bg-white shadow-sm border border-gray-100 flex items-center justify-center text-2xl overflow-hidden flex-shrink-0">
                                📦
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-lg font-black text-gray-900 tracking-tight truncate">Entrée #{selectedMovement.reference || selectedMovement.id.slice(0, 8)}</h2>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="px-2 py-0.5 bg-brand-100 text-brand-700 rounded-lg text-[9px] font-bold uppercase tracking-wide">Réceptionné</span>
                                    <span className="text-[9px] font-mono text-gray-400 capitalize">{selectedMovement.site}</span>
                                </div>
                            </div>
                            <button onClick={() => setSelectedMovement(null)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Summary Grid */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-brand-50/50 p-4 rounded-2xl border border-brand-100">
                                    <p className="text-[9px] font-black text-brand-400 uppercase tracking-widest mb-1">Réceptionné par</p>
                                    <p className="text-xs font-black text-brand-900">{selectedMovement.performer?.full_name || 'Système'}</p>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Date de réception</p>
                                    <p className="text-xs font-black text-gray-900">{new Date(selectedMovement.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>

                            {/* Product Info */}
                            <div className="space-y-3">
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Détail du produit</h3>
                                <div className="p-6 bg-white rounded-2xl border border-gray-100 hover:border-brand-200 transition-all flex items-center justify-between">
                                    <div className="space-y-1">
                                        <p className="text-sm font-black text-gray-900 uppercase tracking-tight leading-tight">{selectedMovement.product?.name}</p>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{selectedMovement.product?.category}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-3xl font-black text-brand-600 tabular-nums">+{selectedMovement.quantity}</p>
                                        <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Unités entrées</p>
                                    </div>
                                </div>
                            </div>

                            {/* Optional Reference Box */}
                            {selectedMovement.reference && (
                                <div className="bg-gray-50 p-4 rounded-2xl border border-dashed border-gray-200">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Référence du lot</p>
                                    <p className="text-xs font-mono font-black text-gray-600">{selectedMovement.reference}</p>
                                </div>
                            )}
                        </div>

                        {/* Close Footer */}
                        <div className="p-4 border-t border-gray-100">
                            <button
                                onClick={() => setSelectedMovement(null)}
                                className="w-full py-3 bg-gray-50 hover:bg-gray-100 text-gray-900 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all border border-gray-100"
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
