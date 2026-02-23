import { useState, useEffect } from 'react';
import { Search, MapPin, Package, AlertCircle, Layers, Plus, X, Save, Trash2, Edit2, Clock, ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronDown, Beef, Coffee, Carrot, LayoutGrid, FileUp } from 'lucide-react';
import type { Product, Site } from '../types';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';
import { logAudit } from '../lib/audit';

export default function Sites() {
    const { profile } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [dbCategories, setDbCategories] = useState<{ id: string, name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSite, setSelectedSite] = useState<Site>('abidjan');
    const [searchTerm, setSearchTerm] = useState('');

    // Category dropdown states
    const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
    const [categorySearchQuery, setCategorySearchQuery] = useState('');

    // CRUD States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentProduct, setCurrentProduct] = useState<Partial<Product> | null>(null);
    const [movements, setMovements] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [siteUsers, setSiteUsers] = useState<any[]>([]);
    const [formData, setFormData] = useState<Partial<Product>>({
        name: '',
        category: '',
        min_threshold: 0,
        stock_abidjan: 0,
        stock_bassam: 0,
        image_url: ''
    });

    const [movementFilter, setMovementFilter] = useState<'all' | 'IN' | 'OUT' | 'UPDATE'>('all');
    const [expandedMovement, setExpandedMovement] = useState<string | null>(null);

    // Navigation States
    const [viewMode, setViewMode] = useState<'categories' | 'products'>('categories');
    const [activeCategory, setActiveCategory] = useState<string | null>(null);

    // Product creation target sites
    const [targetSites, setTargetSites] = useState<'abidjan' | 'bassam' | 'both'>('abidjan');

    // Import states
    const [showImportModal, setShowImportModal] = useState(false);
    const [importTargetSite, setImportTargetSite] = useState<'abidjan' | 'bassam' | 'both'>('abidjan');

    // Advanced Filter State
    const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'out'>('all');

    // Detail History Advanced Filters
    const [historySearch, setHistorySearch] = useState('');
    const [historyDateStart, setHistoryDateStart] = useState('');
    const [historyDateEnd, setHistoryDateEnd] = useState('');
    const [showAdvancedHistory, setShowAdvancedHistory] = useState(false);

    useEffect(() => {
        if (profile) {
            setSelectedSite(profile.site);
        }
    }, [profile]);

    useEffect(() => {
        fetchProducts();
        fetchCategories();
        fetchSiteUsers();
    }, [selectedSite]);

    const fetchSiteUsers = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('site', selectedSite);
            if (error) throw error;
            setSiteUsers(data || []);
        } catch (error) {
            console.error('Error fetching site users:', error);
        }
    };


    const fetchCategories = async () => {
        try {
            const { data, error } = await supabase
                .from('categories')
                .select('*')
                .order('name', { ascending: true });
            if (error) throw error;
            setDbCategories(data || []);
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .or(`site.eq.${selectedSite},site.eq.both`) // Fetch site-specific OR shared products
                .neq('category', 'ARCHIVED')
                .order('name', { ascending: true });

            if (error) throw error;
            if (data) {
                // Double protection: Filtrer aussi côté client pour être sûr
                const activeProducts = data.filter(p => p.category !== 'ARCHIVED' && !p.name.startsWith('ARCHIVED -'));
                setProducts(activeProducts);
            }
        } catch (error: any) {
            console.error('Error fetching products:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (product?: Product) => {
        if (product) {
            setIsEditing(true);
            setCurrentProduct(product);
            setFormData(product);
        } else {
            setIsEditing(false);
            setCurrentProduct(null);
            setFormData({
                name: '',
                category: '',
                min_threshold: 0,
                stock_abidjan: 0,
                stock_bassam: 0,
                image_url: ''
            });
            setTargetSites(selectedSite); // Par défaut, le site actuellement sélectionné
        }
        setIsCategoryDropdownOpen(false);
        setCategorySearchQuery('');
        setIsModalOpen(true);
    };

    const handleOpenDetail = async (product: Product) => {
        setCurrentProduct(product);
        setIsDetailOpen(true);

        // Si l'utilisateur n'est pas admin et n'a pas la permission de voir l'historique
        if (profile?.role !== 'admin' && !profile?.permissions?.view_stock_history) {
            setMovements([]);
            setLoadingHistory(false);
            return;
        }

        try {
            setLoadingHistory(true);
            const { data, error } = await supabase
                .from('stock_movements')
                .select(`
                    *,
                    performer:profiles!stock_movements_performed_by_fkey(full_name)
                `)
                .eq('product_id', product.id)
                .or(`site.eq.${selectedSite},site.eq.all`)
                .order('created_at', { ascending: false })
                .limit(30);
            if (error) throw error;
            setMovements(data || []);
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleDeleteProduct = async (id: string) => {
        const product = products.find(p => p.id === id);
        if (!product) {
            toast.error("Produit introuvable localement");
            return;
        }

        const reason = window.prompt(`Supprimer le produit "${product.name}" de ${selectedSite === 'abidjan' ? 'Abidjan' : 'Bassam'} ?\n\nVEUILLEZ SAISIR LE MOTIF DE SUPPRESSION :`);

        if (reason === null) return;
        if (!reason.trim()) {
            toast.error("Un motif de suppression est obligatoire");
            return;
        }

        try {
            setLoading(true);

            // ARCHIVAGE SOFT (au lieu de suppression définitive) pour conserver l'historique (Bons, Audit)
            const archivedName = `ARCHIVED - ${product.name} - ${new Date().getTime()}`;

            const { error: updateError } = await supabase
                .from('products')
                .update({
                    name: archivedName,
                    category: 'ARCHIVED',
                    stock_abidjan: 0,
                    stock_bassam: 0,
                    // On garde l'image pour l'historique si possible, ou on peut la supprimer si besoin de place
                })
                .eq('id', id);

            if (updateError) throw updateError;

            // On log l'audit même si count === 0 pour tracer la tentative, 
            // mais ici on s'attend à ce que count soit 1 ou plus
            if (profile?.id) {
                try {
                    await logAudit({
                        action_type: 'DELETE', // On garde DELETE pour l'utilisateur, même si c'est un soft delete
                        entity_type: 'PRODUCT',
                        entity_id: id,
                        site: selectedSite,
                        reason: reason.trim(),
                        details: {
                            name: product.name, // Nom original
                            category: product.category,
                            stock: selectedSite === 'abidjan' ? product.stock_abidjan : product.stock_bassam,
                            motive: reason.trim(),
                            method: 'SOFT_DELETE'
                        }
                    }, profile);
                } catch (auditErr) {
                    console.error('Failed to log audit:', auditErr);
                    toast.error("Attention: L'audit n'a pas pu être enregistré");
                }
            }

            toast.success(`Produit supprimé (archivé) de ${selectedSite === 'abidjan' ? 'Abidjan' : 'Bassam'}`);
            setIsModalOpen(false);
            setIsDetailOpen(false);
            fetchProducts();
        } catch (error: any) {
            console.error('Delete product error:', error);
            toast.error('Erreur lors de la suppression : ' + (error.message || 'Inconnue'));
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.category) {
            toast.error("Veuillez sélectionner une catégorie");
            return;
        }
        try {
            setLoading(true);
            if (isEditing && currentProduct?.id) {
                // 1. Update the current product row
                const { error: updateError } = await supabase
                    .from('products')
                    .update({
                        name: formData.name,
                        category: formData.category,
                        min_threshold: formData.min_threshold || 0,
                        stock_abidjan: formData.stock_abidjan || 0,
                        stock_bassam: formData.stock_bassam || 0,
                        image_url: formData.image_url
                    })
                    .eq('id', currentProduct.id);

                if (updateError) throw updateError;

                // 2. Sync metadata to other sites if name/category/threshold/image changed
                if (currentProduct.name) {
                    await supabase
                        .from('products')
                        .update({
                            name: formData.name,
                            category: formData.category,
                            min_threshold: formData.min_threshold || 0,
                            image_url: formData.image_url
                        })
                        .eq('name', currentProduct.name);
                }

                // 3. Log the update
                const prev = selectedSite === 'abidjan' ? (currentProduct.stock_abidjan || 0) : (currentProduct.stock_bassam || 0);
                const next = selectedSite === 'abidjan' ? (formData.stock_abidjan || 0) : (formData.stock_bassam || 0);
                const stockDiff = next - prev;

                await supabase.from('stock_movements').insert([{
                    product_id: currentProduct.id,
                    type: 'UPDATE',
                    quantity: Math.abs(stockDiff),
                    performed_by: profile?.id,
                    notes: stockDiff !== 0
                        ? `Ajustement Admin: ${prev} ➔ ${next} (${stockDiff > 0 ? '+' : ''}${stockDiff})`
                        : "Mise à jour des informations produit",
                    site: selectedSite
                }]);

                // Add Audit Log
                if (profile) {
                    await logAudit({
                        action_type: 'UPDATE',
                        entity_type: 'PRODUCT',
                        entity_id: currentProduct.id,
                        site: selectedSite,
                        details: {
                            name: formData.name,
                            changes: {
                                stock_abidjan: formData.stock_abidjan || 0,
                                stock_bassam: formData.stock_bassam || 0,
                                min_threshold: formData.min_threshold || 0
                            }
                        }
                    }, profile);
                }

                toast.success('Produit mis à jour');
            } else {
                // Consolidated Creation Logic
                const targetSiteValue = targetSites;
                const { data: newP, error } = await supabase
                    .from('products')
                    .insert([{
                        name: formData.name,
                        category: formData.category,
                        min_threshold: formData.min_threshold,
                        stock_abidjan: formData.stock_abidjan || 0,
                        stock_bassam: formData.stock_bassam || 0,
                        image_url: formData.image_url,
                        created_by: profile?.id,
                        unit: 'unit',
                        site: targetSiteValue
                    }])
                    .select().single();

                if (error) throw error;

                // Log initial stock movement(s)
                if (targetSiteValue === 'both') {
                    if ((formData.stock_abidjan || 0) > 0) {
                        await supabase.from('stock_movements').insert([{
                            product_id: newP.id, type: 'IN', quantity: formData.stock_abidjan || 0,
                            site: 'abidjan', performed_by: profile?.id, notes: 'Stock initial Abidjan (Création)'
                        }]);
                    }
                    if ((formData.stock_bassam || 0) > 0) {
                        await supabase.from('stock_movements').insert([{
                            product_id: newP.id, type: 'IN', quantity: formData.stock_bassam || 0,
                            site: 'bassam', performed_by: profile?.id, notes: 'Stock initial Bassam (Création)'
                        }]);
                    }
                } else {
                    const stockValue = targetSiteValue === 'abidjan' ? (formData.stock_abidjan || 0) : (formData.stock_bassam || 0);
                    if (stockValue > 0) {
                        await supabase.from('stock_movements').insert([{
                            product_id: newP.id, type: 'IN', quantity: stockValue,
                            site: targetSiteValue, performed_by: profile?.id, notes: 'Stock initial (Création)'
                        }]);
                    }
                }

                // Add Audit Log
                if (profile) {
                    await logAudit({
                        action_type: 'CREATE',
                        entity_type: 'PRODUCT',
                        entity_id: newP.id,
                        site: targetSiteValue,
                        details: {
                            name: formData.name,
                            category: formData.category,
                            stock_abidjan: formData.stock_abidjan || 0,
                            stock_bassam: formData.stock_bassam || 0
                        }
                    }, profile);
                }

                toast.success(targetSites === 'both' ? 'Produit ajouté aux deux sites !' : 'Produit ajouté !');
            }
            setIsModalOpen(false);
            fetchProducts();
        } catch (error: any) {
            toast.error('Erreur: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const content = event.target?.result as string;
                const lines = content.split(/\r?\n/);
                let currentCategory = '';
                const parsedProducts: { name: string; category: string; stock: number; min_threshold: number }[] = [];

                for (const rawLine of lines) {
                    const line = rawLine.trim();
                    if (!line) continue; // Ignorer les lignes vides

                    if (line.startsWith('#')) {
                        // Ligne de catégorie : # Boissons
                        currentCategory = line.replace(/^#+\s*/, '').trim();
                    } else if (currentCategory) {
                        // Split by '-' or '|' or ',' to try to get optional quantities
                        // Format: Produit - Stock - Seuil  (e.g., Coca Cola - 50 - 10)
                        const parts = line.split(/\s*-\s*|\s*\|\s*|\s*,\s*/);

                        const name = parts[0].trim();
                        let stock = 0;
                        let min_threshold = 10; // Default

                        if (parts.length >= 2) {
                            const parsedStock = parseInt(parts[1], 10);
                            if (!isNaN(parsedStock)) stock = parsedStock;
                        }

                        if (parts.length >= 3) {
                            const parsedThreshold = parseInt(parts[2], 10);
                            if (!isNaN(parsedThreshold)) min_threshold = parsedThreshold;
                        }

                        parsedProducts.push({ name, category: currentCategory, stock, min_threshold });
                    }
                }

                if (parsedProducts.length === 0) {
                    toast.error("Aucun produit trouvé. Vérifie le format du fichier (# Catégorie puis les produits en dessous).");
                    return;
                }

                setLoading(true);

                let addedCount = 0;
                let skippedCount = 0;
                let errorCount = 0;

                // Consolidated Import Logic
                for (const product of parsedProducts) {
                    if (!product.name || !product.category) {
                        errorCount++;
                        continue;
                    }

                    // Check if category exists, if not, create it
                    let categoryId = dbCategories.find(c => c.name.toLowerCase() === product.category.toLowerCase())?.id;
                    if (!categoryId) {
                        const { data: newCat, error: catError } = await supabase
                            .from('categories')
                            .insert([{ name: product.category }])
                            .select().single();

                        if (catError) {
                            errorCount++;
                            continue;
                        }
                        if (newCat) {
                            setDbCategories(prev => [...prev, newCat]);
                            categoryId = newCat.id;
                        }
                    }

                    // For 'both', we check if a shared or site-specific product exists
                    // To avoid duplicates, we look for any product with same name that is not archived
                    const { data: existing } = await supabase
                        .from('products')
                        .select('id, site, stock_abidjan, stock_bassam')
                        .ilike('name', product.name)
                        .neq('category', 'ARCHIVED')
                        .limit(1);

                    if (existing && existing.length > 0) {
                        // Product already exists somewhere. 
                        // If we are importing for 'both' and it's currently only for one site, we could upgrade it.
                        // But for simplicity of "Skip", we just skip.
                        skippedCount++;
                        continue;
                    }

                    const { error } = await supabase
                        .from('products')
                        .insert([{
                            name: product.name,
                            category: product.category,
                            min_threshold: product.min_threshold,
                            stock_abidjan: (importTargetSite === 'abidjan' || importTargetSite === 'both') ? product.stock : 0,
                            stock_bassam: (importTargetSite === 'bassam' || importTargetSite === 'both') ? product.stock : 0,
                            image_url: '',
                            created_by: profile?.id,
                            unit: 'unit',
                            site: importTargetSite
                        }]);

                    if (error) {
                        errorCount++;
                    } else {
                        addedCount++;
                    }
                }

                if (addedCount > 0) {
                    toast.success(`${addedCount} produit(s) importé(s) avec succès !`);
                    fetchProducts();
                    setShowImportModal(false);
                }
                if (skippedCount > 0) {
                    toast(`${skippedCount} produit(s) existant(s) ignoré(s).`, { icon: 'ℹ️' });
                }
                if (errorCount > 0) {
                    toast.error(`${errorCount} opération(s) ont échoué lors de l'import.`);
                }
                if (addedCount === 0 && skippedCount > 0 && errorCount === 0) {
                    setShowImportModal(false);
                }

            } catch (error) {
                toast.error("Une erreur s'est produite lors du traitement du fichier.");
                console.error(error);
            } finally {
                setLoading(false);
                // Reset file input
                e.target.value = '';
            }
        };

        reader.readAsText(file);
    };

    const filteredProducts = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.category.toLowerCase().includes(searchTerm.toLowerCase());
        const stock = selectedSite === 'abidjan' ? product.stock_abidjan : product.stock_bassam;

        let matchesStatus = true;
        if (statusFilter === 'low') {
            matchesStatus = stock > 0 && stock <= product.min_threshold;
        } else if (statusFilter === 'out') {
            matchesStatus = stock <= 0;
        }

        return matchesSearch && matchesStatus;
    });

    return (
        <div className="flex flex-col max-w-7xl mx-auto h-full">
            {/* Fixed Header + Stats Section */}
            {/* Simple Header + Stats Section */}
            <div className="sticky top-0 z-20 bg-[#F8FAFC]/80 backdrop-blur-md pb-4 pt-4">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                    <div className="text-center md:text-left">
                        <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight flex items-center justify-center md:justify-start">
                            <MapPin className="w-5 h-5 mr-2 text-brand-600" />
                            Stock {selectedSite === 'abidjan' ? 'Abidjan' : 'Bassam'}
                        </h1>
                    </div>

                    <div className="flex items-center gap-2">
                        {profile?.role === 'admin' && (
                            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100">
                                {(['abidjan', 'bassam'] as const).map(site => (
                                    <button
                                        key={site}
                                        onClick={() => setSelectedSite(site)}
                                        className={clsx(
                                            "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                                            selectedSite === site ? "bg-brand-600 text-white shadow-sm" : "text-gray-400 hover:text-gray-600"
                                        )}
                                    >
                                        {site}
                                    </button>
                                ))}
                            </div>
                        )}
                        {(profile?.role === 'admin' || profile?.permissions.edit_inventory) && (
                            <button
                                onClick={() => handleOpenModal()}
                                className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-brand-700 transition-all active:scale-95 shadow-lg shadow-brand-100"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Nouveau</span>
                            </button>
                        )}
                        {(profile?.role === 'admin' || profile?.permissions.edit_inventory) && (
                            <button
                                onClick={() => setShowImportModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all active:scale-95 shadow-sm"
                            >
                                <FileUp className="w-4 h-4" />
                                <span className="hidden sm:inline">Importer TXT</span>
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
                        <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center text-brand-600">
                            <Package className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Catalogue</p>
                            <p className="text-lg font-black text-gray-900">{filteredProducts.length}</p>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-600">
                            <AlertCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Alertes</p>
                            <p className="text-lg font-black text-red-600">
                                {filteredProducts.filter(p => (selectedSite === 'abidjan' ? p.stock_abidjan : p.stock_bassam) <= p.min_threshold).length}
                            </p>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3 col-span-2">
                        <div className="flex -space-x-2 mr-1">
                            {siteUsers.slice(0, 3).map((u, i) => (
                                <div key={i} title={u.full_name} className="w-8 h-8 rounded-lg bg-brand-100 border-2 border-white flex items-center justify-center text-[10px] text-brand-600 font-bold shadow-sm">
                                    {u.full_name?.[0] || 'U'}
                                </div>
                            ))}
                            {siteUsers.length > 3 && (
                                <div className="w-8 h-8 rounded-lg bg-gray-50 border-2 border-white flex items-center justify-center text-[10px] text-gray-400 font-bold">
                                    +{siteUsers.length - 3}
                                </div>
                            )}
                        </div>
                        <div>
                            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Équipe {selectedSite}</p>
                            <p className="text-lg font-black text-gray-900">{siteUsers.length} Membres</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Scrollable Content Section */}
            <div className="bg-white rounded-[2rem] sm:rounded-[3rem] shadow-xl border border-gray-100 overflow-hidden flex-1">
                <div className="p-4 sm:p-8 border-b border-gray-50 flex flex-col md:flex-row gap-4 sm:gap-6 items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-4 flex-1 w-full">
                        {viewMode === 'products' && (
                            <button
                                onClick={() => { setViewMode('categories'); setActiveCategory(null); }}
                                className="p-2 sm:p-3 bg-gray-50 hover:bg-brand-50 rounded-xl sm:rounded-2xl text-gray-400 hover:text-brand-600 transition-all border border-gray-100 group"
                            >
                                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 group-hover:-translate-x-1 transition-transform" />
                            </button>
                        )}
                        <div className="flex-1 min-w-[300px] flex items-center gap-3">
                            <div className="relative flex-1 group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-brand-600 transition-colors w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder={viewMode === 'categories' ? "Rechercher une catégorie..." : `Rechercher dans ${activeCategory}...`}
                                    className="w-full pl-10 pr-4 py-2 bg-white border border-gray-100 rounded-xl focus:border-brand-200 focus:ring-4 focus:ring-brand-50 outline-none transition-all font-bold text-xs text-gray-900 shadow-sm"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            {viewMode === 'products' && (
                                <div className="hidden sm:flex bg-gray-100/50 p-1 rounded-xl border border-gray-200">
                                    {[
                                        { id: 'all', label: 'Tous', color: 'bg-white text-gray-600' },
                                        { id: 'low', label: 'Stock Bas', color: 'bg-orange-500 text-white' },
                                        { id: 'out', label: 'Rupture', color: 'bg-red-500 text-white' }
                                    ].map(f => (
                                        <button
                                            key={f.id}
                                            onClick={() => setStatusFilter(f.id as any)}
                                            className={clsx(
                                                "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                                                statusFilter === f.id ? f.color + " shadow-sm" : "text-gray-400 hover:text-gray-600"
                                            )}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                    <div className="flex items-center gap-2 pl-2 ml-1 border-l border-gray-200">
                                        <span className="text-[10px] font-black text-brand-600 bg-brand-50 px-2 py-1 rounded-lg uppercase tracking-tighter">
                                            {filteredProducts.filter(p => p.category === activeCategory).length} items
                                        </span>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {viewMode === 'products' && (
                            <div className="sm:hidden flex bg-white p-1 rounded-xl border border-gray-100 shadow-sm">
                                <button onClick={() => setStatusFilter('all')} className={clsx("p-1.5 rounded-lg", statusFilter === 'all' ? "bg-brand-50 text-brand-600" : "text-gray-300")}>
                                    <Package className="w-4 h-4" />
                                </button>
                                <button onClick={() => setStatusFilter('low')} className={clsx("p-1.5 rounded-lg", statusFilter === 'low' ? "bg-orange-50 text-orange-600" : "text-gray-300")}>
                                    <AlertCircle className="w-4 h-4" />
                                </button>
                                <button onClick={() => setStatusFilter('out')} className={clsx("p-1.5 rounded-lg", statusFilter === 'out' ? "bg-red-50 text-red-600" : "text-gray-300")}>
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                        <div className="flex items-center gap-2 px-3 py-2 bg-brand-50 rounded-xl border border-brand-100/50">
                            <Layers className="w-3 h-3 text-brand-500" />
                            <span className="text-[9px] font-black uppercase text-brand-600 tracking-widest">{dbCategories.length} types</span>
                        </div>
                    </div>
                </div>

                {/* Mobile Status Filter (visible only on mobile and when in product view) */}
                {viewMode === 'products' && (
                    <div className="flex sm:hidden gap-2 px-2 overflow-x-auto pb-2 scrollbar-hide">
                        {[
                            { id: 'all', label: 'Tous' },
                            { id: 'low', label: 'Stock Bas' },
                            { id: 'out', label: 'Rupture' }
                        ].map(f => (
                            <button
                                key={f.id}
                                onClick={() => setStatusFilter(f.id as any)}
                                className={clsx(
                                    "px-4 py-2 rounded-full text-[10px] font-bold whitespace-nowrap transition-all border",
                                    statusFilter === f.id
                                        ? "bg-brand-600 text-white border-brand-600"
                                        : "bg-white text-gray-500 border-gray-100"
                                )}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                )}

                <div className="p-10">
                    {loading ? (
                        <div className="py-32 text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-600 mx-auto mb-6"></div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Synchronisation locale...</p>
                        </div>
                    ) : filteredProducts.length === 0 && searchTerm ? (
                        <div className="py-32 text-center border-4 border-dashed border-gray-50 rounded-[4rem]">
                            <Package className="w-16 h-16 text-gray-100 mx-auto mb-4" />
                            <p className="text-xl font-black text-gray-300 italic tracking-tight">Aucun résultat pour "{searchTerm}"</p>
                        </div>
                    ) : (viewMode === 'categories') ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {dbCategories
                                .filter(cat => cat.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                .map(cat => {
                                    const count = products.filter(p => p.category === cat.name).length;
                                    const lowCount = products.filter(p => p.category === cat.name && (selectedSite === 'abidjan' ? p.stock_abidjan : p.stock_bassam) <= p.min_threshold).length;

                                    return (
                                        <button
                                            key={cat.id}
                                            onClick={() => { setActiveCategory(cat.name); setViewMode('products'); setSearchTerm(''); }}
                                            className="group relative bg-white p-5 rounded-2xl border border-gray-100 hover:border-brand-200 hover:shadow-xl hover:shadow-brand-100/50 transition-all flex flex-col items-center text-center overflow-hidden active:scale-95"
                                        >
                                            <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-brand-50 group-hover:scale-110 transition-all duration-300">
                                                {cat.name.toLowerCase().includes('viande') ? (
                                                    <Beef className="w-6 h-6 text-rose-500" />
                                                ) : cat.name.toLowerCase().includes('boisson') ? (
                                                    <Coffee className="w-6 h-6 text-amber-600" />
                                                ) : cat.name.toLowerCase().includes('légume') ? (
                                                    <Carrot className="w-6 h-6 text-orange-500" />
                                                ) : (
                                                    <LayoutGrid className="w-6 h-6 text-brand-600" />
                                                )}
                                            </div>

                                            <h3 className="text-[10px] font-black text-gray-900 uppercase tracking-widest mb-2 line-clamp-1">{cat.name}</h3>

                                            <div className="mt-auto flex items-center gap-2">
                                                <span className="px-2 py-0.5 bg-gray-50 text-[8px] font-bold text-gray-500 rounded-md border border-gray-100">{count} items</span>
                                                {lowCount > 0 && (
                                                    <span className="px-1.5 py-0.5 bg-red-50 text-[8px] font-bold text-red-600 rounded-md border border-red-100 animate-pulse">! {lowCount}</span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                        </div>
                    ) : (
                        <div className="space-y-10">
                            {/* Search Results Header */}
                            {searchTerm && (
                                <div className="flex items-center gap-2 mb-6">
                                    <Search className="w-4 h-4 text-brand-600" />
                                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">
                                        Résultats de recherche ({filteredProducts.length})
                                    </h3>
                                </div>
                            )}

                            {filteredProducts.filter(p => (searchTerm || p.category === activeCategory)).length === 0 ? (
                                <div className="py-20 text-center border-2 border-dashed border-gray-100 rounded-[2rem] flex flex-col items-center">
                                    <Package className="w-12 h-12 text-gray-100 mb-4" />
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                        {statusFilter === 'low' ? "Aucune alerte de stock bas" :
                                            statusFilter === 'out' ? "Aucune rupture de stock" :
                                                "Aucun produit trouvé"}
                                    </p>
                                    <button
                                        onClick={() => { setStatusFilter('all'); setSearchTerm(''); }}
                                        className="mt-4 text-[9px] font-black text-brand-600 uppercase tracking-widest hover:underline"
                                    >
                                        Effacer les filtres
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                    {filteredProducts
                                        .filter(p => (searchTerm || p.category === activeCategory))
                                        .map(product => {
                                            const stock = selectedSite === 'abidjan' ? product.stock_abidjan : product.stock_bassam;
                                            const isLow = stock <= product.min_threshold;
                                            return (
                                                <div
                                                    key={product.id}
                                                    onClick={() => handleOpenDetail(product)}
                                                    className={clsx(
                                                        "group relative bg-white rounded-2xl border border-gray-100 hover:border-brand-200 hover:shadow-xl hover:shadow-brand-100/50 transition-all p-4 flex flex-col cursor-pointer overflow-hidden",
                                                        isLow && "bg-red-50/30 border-red-100"
                                                    )}
                                                >

                                                    {/* Header info */}
                                                    <div className="flex justify-between items-start mb-3">
                                                        <span className={clsx(
                                                            "px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-wider",
                                                            isLow ? "bg-red-100 text-red-600" : "bg-brand-100 text-brand-600"
                                                        )}>
                                                            {isLow ? "Alerte" : "Normal"}
                                                        </span>
                                                        <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                            {(profile?.role === 'admin' || profile?.permissions.edit_inventory) && (
                                                                <>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleOpenModal(product); }}
                                                                        className="p-1.5 bg-white sm:bg-transparent hover:bg-white rounded-lg text-gray-400 hover:text-blue-500 transition-colors shadow-sm"
                                                                        title="Modifier"
                                                                    >
                                                                        <Edit2 className="w-3 h-3" />
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product.id); }}
                                                                        className="p-1.5 bg-white sm:bg-transparent hover:bg-white rounded-lg text-gray-400 hover:text-red-500 transition-colors shadow-sm"
                                                                        title="Supprimer"
                                                                    >
                                                                        <Trash2 className="w-3 h-3" />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Image/Icon */}
                                                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-3">
                                                        <div className="w-full h-full rounded-2xl bg-white shadow-inner border border-gray-50 flex items-center justify-center text-3xl overflow-hidden">
                                                            {product.image_url ? (
                                                                <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                                                            ) : '📦'}
                                                        </div>
                                                        {isLow && (
                                                            <div className="absolute -bottom-1 -right-1 bg-red-500 text-white p-1 rounded-lg shadow-lg">
                                                                <AlertCircle className="w-3 h-3" />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Title */}
                                                    <div className="text-center mb-4">
                                                        <h3 className="text-xs font-black text-gray-900 leading-tight line-clamp-2 min-h-[2.5rem] group-hover:text-brand-600 transition-colors">
                                                            {product.name}
                                                        </h3>
                                                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1">REF: {product.id.slice(0, 8)}</p>
                                                    </div>

                                                    {/* Stats */}
                                                    <div className="mt-auto grid grid-cols-2 gap-2">
                                                        <div className={clsx(
                                                            "py-2 rounded-xl flex flex-col items-center justify-center border",
                                                            isLow ? 'bg-white border-red-100' : 'bg-gray-50 border-gray-100'
                                                        )}>
                                                            <span className="text-[7px] font-bold text-gray-400 uppercase">Stock</span>
                                                            <span className={clsx("text-base font-black", isLow ? 'text-red-600' : 'text-gray-900')}>{stock}</span>
                                                        </div>
                                                        <div className="py-2 bg-gray-50 rounded-xl flex flex-col items-center justify-center border border-gray-100">
                                                            <span className="text-[7px] font-bold text-gray-400 uppercase">Seuil</span>
                                                            <span className="text-base font-black text-gray-900">{product.min_threshold}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Product Add/Edit Modal — Clean & Simple */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-xl max-h-[92vh] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in duration-200">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h2 className="text-lg font-black text-gray-900 tracking-tight">
                                    {isEditing ? 'Modifier le Produit' : 'Nouveau Produit'}
                                </h2>
                                <p className="text-[10px] font-bold text-brand-600 uppercase tracking-widest">
                                    {isEditing ? 'Mise à jour des informations' : 'Ajout à l\'inventaire'}
                                </p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-xl text-gray-400 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
                            {/* Site selection (only for new products) */}
                            {!isEditing && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Destination</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { id: 'abidjan', label: 'Abidjan' },
                                            { id: 'bassam', label: 'Bassam' },
                                            { id: 'both', label: 'Tous les sites' }
                                        ].map(site => (
                                            <button
                                                key={site.id}
                                                type="button"
                                                onClick={() => setTargetSites(site.id as any)}
                                                className={clsx(
                                                    "py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all border-2",
                                                    targetSites === site.id
                                                        ? "bg-brand-600 text-white border-brand-600 shadow-md"
                                                        : "bg-white text-gray-400 border-gray-100 hover:border-gray-200"
                                                )}
                                            >
                                                {site.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Désignation</label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 outline-none transition-all font-bold text-sm text-gray-900"
                                            placeholder="Nom du produit"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5 relative z-50">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Catégorie</label>
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 outline-none transition-all font-bold text-sm text-left flex items-center justify-between"
                                            >
                                                <span className={formData.category ? "text-gray-900" : "text-gray-400"}>
                                                    {formData.category || "Choisir..."}
                                                </span>
                                                <ChevronDown className="w-4 h-4 text-gray-400" />
                                            </button>

                                            {isCategoryDropdownOpen && (
                                                <>
                                                    <div
                                                        className="fixed inset-0 z-40"
                                                        onClick={() => setIsCategoryDropdownOpen(false)}
                                                    />
                                                    <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 z-50 flex flex-col max-h-[250px] overflow-hidden animate-in slide-in-from-top-2">
                                                        <div className="p-2 border-b border-gray-50 flex-shrink-0 relative">
                                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                                            <input
                                                                type="text"
                                                                autoFocus
                                                                value={categorySearchQuery}
                                                                onChange={(e) => setCategorySearchQuery(e.target.value)}
                                                                placeholder="Rechercher une catégorie..."
                                                                className="w-full bg-gray-50 border-none rounded-lg py-2 pl-9 pr-3 text-[11px] font-black text-gray-900 focus:ring-0 outline-none"
                                                            />
                                                        </div>
                                                        <div className="overflow-y-auto w-full p-2 flex-1 scrollbar-hide">
                                                            {dbCategories.filter(cat => cat.name.toLowerCase().includes(categorySearchQuery.toLowerCase())).length > 0 ? (
                                                                dbCategories
                                                                    .filter(cat => cat.name.toLowerCase().includes(categorySearchQuery.toLowerCase()))
                                                                    .map(cat => (
                                                                        <button
                                                                            type="button"
                                                                            key={cat.id}
                                                                            onClick={() => {
                                                                                setFormData({ ...formData, category: cat.name });
                                                                                setIsCategoryDropdownOpen(false);
                                                                                setCategorySearchQuery('');
                                                                            }}
                                                                            className={clsx(
                                                                                "w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-colors uppercase tracking-widest",
                                                                                formData.category === cat.name ? "bg-brand-50 text-brand-600" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                                                            )}
                                                                        >
                                                                            {cat.name}
                                                                        </button>
                                                                    ))
                                                            ) : (
                                                                <p className="text-center text-[10px] text-gray-400 py-3 font-bold uppercase tracking-widest">
                                                                    Aucune catégorie trouvée
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Stock & Threshold Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    {(targetSites === 'abidjan' || targetSites === 'both' || (isEditing && currentProduct?.site === 'abidjan')) && (
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Stock Abidjan</label>
                                            <input
                                                type="number"
                                                value={formData.stock_abidjan === 0 ? '' : formData.stock_abidjan}
                                                onChange={(e) => setFormData({ ...formData, stock_abidjan: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                                                className="w-full px-4 py-3 bg-brand-50/30 border border-brand-100 rounded-xl focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 outline-none transition-all font-bold text-sm text-brand-700"
                                            />
                                        </div>
                                    )}
                                    {(targetSites === 'bassam' || targetSites === 'both' || (isEditing && currentProduct?.site === 'bassam')) && (
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Stock Bassam</label>
                                            <input
                                                type="number"
                                                value={formData.stock_bassam === 0 ? '' : formData.stock_bassam}
                                                onChange={(e) => setFormData({ ...formData, stock_bassam: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                                                className="w-full px-4 py-3 bg-orange-50/30 border border-orange-100 rounded-xl focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all font-bold text-sm text-orange-700"
                                            />
                                        </div>
                                    )}
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Seuil Alerte</label>
                                        <input
                                            type="number"
                                            value={formData.min_threshold === 0 ? '' : formData.min_threshold}
                                            onChange={(e) => setFormData({ ...formData, min_threshold: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 outline-none transition-all font-bold text-sm text-red-600"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">URL Image (Optionnel)</label>
                                    <input
                                        type="text"
                                        value={formData.image_url}
                                        onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 outline-none transition-all font-bold text-sm text-gray-900"
                                        placeholder="https://images.unsplash.com/..."
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                {isEditing && (
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteProduct(currentProduct!.id!)}
                                        className="px-5 py-4 bg-red-50 text-red-600 rounded-xl font-bold text-sm uppercase tracking-widest shadow-sm hover:bg-red-100 hover:shadow-red-50 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                                        title="Supprimer le produit"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 py-4 bg-gray-900 text-white rounded-xl font-bold text-sm uppercase tracking-widest shadow-lg hover:bg-gray-800 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
                                >
                                    <Save className="w-4 h-4" />
                                    {isEditing ? 'Mettre à jour' : 'Ajouter le produit'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Detail Modal — Clean & Simple */}
            {isDetailOpen && currentProduct && (() => {
                const stockAbidjan = currentProduct.stock_abidjan ?? 0;
                const stockBassam = currentProduct.stock_bassam ?? 0;
                const threshold = currentProduct.min_threshold ?? 0;
                const stockTotal = stockAbidjan + stockBassam;
                const isLowAbidjan = stockAbidjan <= threshold;
                const isLowBassam = stockBassam <= threshold;

                return (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-sm" onClick={() => setIsDetailOpen(false)}>
                        <div
                            className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-3xl max-h-[92vh] shadow-2xl overflow-hidden flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header — Compact with product identity */}
                            <div className="flex items-center gap-4 px-5 sm:px-8 py-4 sm:py-5 border-b border-gray-100 bg-gray-50/80">
                                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white shadow-sm border border-gray-100 flex items-center justify-center text-3xl overflow-hidden flex-shrink-0">
                                    {currentProduct.image_url ? (
                                        <img src={currentProduct.image_url} alt="" className="w-full h-full object-cover" />
                                    ) : '📦'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight truncate">{currentProduct.name}</h2>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <span className="px-2.5 py-0.5 bg-brand-100 text-brand-700 rounded-lg text-[10px] font-bold uppercase tracking-wide">
                                            {currentProduct.category}
                                        </span>
                                        <span className="text-[10px] font-mono text-gray-400">
                                            #{currentProduct.id?.slice(0, 8).toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsDetailOpen(false)}
                                    className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto">
                                {/* Stock Overview — 3 cards in a row */}
                                <div className="px-5 sm:px-8 py-5 sm:py-6 border-b border-gray-100">
                                    <div className="grid grid-cols-3 gap-3 sm:gap-4">
                                        {/* Abidjan */}
                                        <div className={clsx(
                                            "rounded-xl sm:rounded-2xl p-3 sm:p-4 border-2 text-center transition-all",
                                            isLowAbidjan ? "bg-red-50 border-red-200" : "bg-brand-50/50 border-brand-100"
                                        )}>
                                            <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Abidjan</p>
                                            <p className={clsx("text-2xl sm:text-3xl font-black tabular-nums", isLowAbidjan ? "text-red-600" : "text-gray-900")}>
                                                {stockAbidjan}
                                            </p>
                                            {isLowAbidjan && <p className="text-[8px] font-bold text-red-500 mt-1">⚠ Stock bas</p>}
                                        </div>

                                        {/* Bassam */}
                                        <div className={clsx(
                                            "rounded-xl sm:rounded-2xl p-3 sm:p-4 border-2 text-center transition-all",
                                            isLowBassam ? "bg-red-50 border-red-200" : "bg-orange-50/50 border-orange-100"
                                        )}>
                                            <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Bassam</p>
                                            <p className={clsx("text-2xl sm:text-3xl font-black tabular-nums", isLowBassam ? "text-red-600" : "text-gray-900")}>
                                                {stockBassam}
                                            </p>
                                            {isLowBassam && <p className="text-[8px] font-bold text-red-500 mt-1">⚠ Stock bas</p>}
                                        </div>

                                        {/* Seuil */}
                                        <div className="rounded-xl sm:rounded-2xl p-3 sm:p-4 border-2 border-gray-100 bg-gray-50 text-center">
                                            <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Seuil min.</p>
                                            <p className="text-2xl sm:text-3xl font-black tabular-nums text-gray-900">{threshold}</p>
                                            <p className="text-[8px] font-bold text-gray-400 mt-1">Total: {stockTotal}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Product Info Row */}
                                <div className="px-5 sm:px-8 py-4 border-b border-gray-100 flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2 text-gray-500">
                                        <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-[9px]">
                                            {(currentProduct.creator?.full_name || 'S')[0]}
                                        </div>
                                        <span className="font-medium">Créé par <strong className="text-gray-700">{currentProduct.creator?.full_name || 'Système'}</strong></span>
                                    </div>
                                    <span className="text-gray-400 font-medium">
                                        Site actuel: <strong className="text-gray-700 capitalize">{selectedSite}</strong>
                                    </span>
                                </div>

                                {/* History Section */}
                                <div className="px-5 sm:px-8 pt-5 sm:pt-6 pb-2">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-brand-500" />
                                            Historique des mouvements
                                        </h3>
                                        <span className="text-[10px] font-medium text-gray-400">30 derniers</span>
                                    </div>

                                    {/* Filter bar */}
                                    <div className="flex items-center justify-between mb-4 gap-2">
                                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 flex-1">
                                            {[
                                                { id: 'all', label: 'Tous', color: 'gray' },
                                                { id: 'IN', label: 'Entrées', color: 'green' },
                                                { id: 'OUT', label: 'Sorties', color: 'red' },
                                                { id: 'UPDATE', label: 'Modifs', color: 'blue' }
                                            ].map(f => (
                                                <button
                                                    key={f.id}
                                                    onClick={() => setMovementFilter(f.id as any)}
                                                    className={clsx(
                                                        "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all whitespace-nowrap",
                                                        movementFilter === f.id
                                                            ? "bg-brand-600 text-white shadow-sm"
                                                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                                    )}
                                                >
                                                    {f.label}
                                                </button>
                                            ))}
                                        </div>
                                        <button
                                            onClick={() => setShowAdvancedHistory(!showAdvancedHistory)}
                                            className={clsx(
                                                "p-2 rounded-lg border transition-all flex items-center gap-1.5",
                                                showAdvancedHistory ? "bg-brand-50 border-brand-200 text-brand-600" : "bg-white border-gray-100 text-gray-400 hover:text-gray-600"
                                            )}
                                        >
                                            <Search className="w-3.5 h-3.5" />
                                            <span className="text-[10px] font-bold uppercase">Filtres</span>
                                        </button>
                                    </div>

                                    {/* Advanced Search Panel */}
                                    {showAdvancedHistory && (
                                        <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Recherche (Nom, ID, Note)</label>
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-300" />
                                                    <input
                                                        type="text"
                                                        value={historySearch}
                                                        onChange={(e) => setHistorySearch(e.target.value)}
                                                        placeholder="Ex: John Doe..."
                                                        className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-[11px] font-medium outline-none focus:border-brand-300 transition-colors"
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Depuis</label>
                                                    <input
                                                        type="date"
                                                        value={historyDateStart}
                                                        onChange={(e) => setHistoryDateStart(e.target.value)}
                                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-[11px] font-medium outline-none focus:border-brand-300 transition-colors"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Jusqu'à</label>
                                                    <input
                                                        type="date"
                                                        value={historyDateEnd}
                                                        onChange={(e) => setHistoryDateEnd(e.target.value)}
                                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-[11px] font-medium outline-none focus:border-brand-300 transition-colors"
                                                    />
                                                </div>
                                            </div>
                                            {(historySearch || historyDateStart || historyDateEnd) && (
                                                <button
                                                    onClick={() => { setHistorySearch(''); setHistoryDateStart(''); setHistoryDateEnd(''); }}
                                                    className="w-full py-1.5 text-[9px] font-black text-brand-600 uppercase hover:bg-brand-50 rounded-lg transition-colors border border-brand-100"
                                                >
                                                    Réinitialiser les filtres
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* History List */}
                                <div className="px-5 sm:px-8 pb-6 space-y-2">
                                    {loadingHistory ? (
                                        <div className="space-y-2">
                                            {[1, 2, 3].map(i => (
                                                <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse"></div>
                                            ))}
                                        </div>
                                    ) : (profile?.role !== 'admin' && !profile?.permissions?.view_stock_history) ? (
                                        <div className="py-10 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                            <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                            <p className="text-xs font-bold text-gray-400">Accès restreint à l'historique</p>
                                        </div>
                                    ) : (() => {
                                        const filteredMovements = movements.filter(m => {
                                            const matchesType = movementFilter === 'all' || m.type === movementFilter;

                                            const term = historySearch.toLowerCase();
                                            const matchesSearch = !historySearch ||
                                                (m.performer?.full_name?.toLowerCase().includes(term)) ||
                                                (m.notes?.toLowerCase().includes(term)) ||
                                                (m.site?.toLowerCase().includes(term));

                                            const moveDate = new Date(m.created_at).toISOString().split('T')[0];
                                            const matchesStart = !historyDateStart || moveDate >= historyDateStart;
                                            const matchesEnd = !historyDateEnd || moveDate <= historyDateEnd;

                                            return matchesType && matchesSearch && matchesStart && matchesEnd;
                                        });

                                        if (filteredMovements.length === 0) {
                                            return (
                                                <div className="py-10 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                                    <Search className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                                                    <p className="text-xs font-bold text-gray-400">Aucun résultat pour ces filtres</p>
                                                </div>
                                            );
                                        }

                                        return filteredMovements.map((move) => {
                                            const isExpanded = expandedMovement === move.id;
                                            return (
                                                <div
                                                    key={move.id}
                                                    onClick={() => setExpandedMovement(isExpanded ? null : move.id)}
                                                    className={clsx(
                                                        "rounded-xl border cursor-pointer transition-all",
                                                        isExpanded ? "border-brand-200 bg-brand-50/30 shadow-sm" : "border-gray-100 hover:border-gray-200 hover:bg-gray-50/50"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3 px-4 py-3">
                                                        {/* Type icon */}
                                                        <div className={clsx(
                                                            "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                                                            move.type === 'IN' ? 'bg-green-100 text-green-600' :
                                                                move.type === 'OUT' ? 'bg-red-100 text-red-600' :
                                                                    'bg-blue-100 text-blue-600'
                                                        )}>
                                                            {move.type === 'IN' ? <ArrowUpRight className="w-4 h-4" /> :
                                                                move.type === 'OUT' ? <ArrowDownRight className="w-4 h-4" /> :
                                                                    <Edit2 className="w-4 h-4" />}
                                                        </div>

                                                        {/* Info */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-xs font-bold text-gray-900">
                                                                    {move.type === 'IN' ? 'Entrée' : move.type === 'OUT' ? 'Sortie' : move.type === 'UPDATE' ? 'Modification' : 'Suppression'}
                                                                </p>
                                                                <span className={clsx(
                                                                    "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase",
                                                                    move.site === 'abidjan' ? "bg-brand-100 text-brand-600" : "bg-orange-100 text-orange-600"
                                                                )}>
                                                                    {move.site}
                                                                </span>
                                                            </div>
                                                            <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                                                                {new Date(move.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                {' · '}
                                                                {move.performer?.full_name?.split(' ')[0] || 'Système'}
                                                            </p>
                                                        </div>

                                                        {/* Quantity */}
                                                        {move.quantity > 0 && (
                                                            <p className={clsx(
                                                                "text-lg font-black tabular-nums flex-shrink-0",
                                                                move.type === 'IN' || (move.type === 'UPDATE' && move.notes?.includes('+')) ? 'text-green-600' :
                                                                    move.type === 'OUT' || (move.type === 'UPDATE' && move.notes?.includes('-')) ? 'text-red-600' :
                                                                        'text-blue-600'
                                                            )}>
                                                                {move.type === 'OUT' || (move.type === 'UPDATE' && move.notes?.includes('-')) ? '-' : '+'}{move.quantity}
                                                            </p>
                                                        )}
                                                    </div>

                                                    {/* Expanded details */}
                                                    {isExpanded && (
                                                        <div className="px-4 pb-3 pt-1 border-t border-gray-100 mt-1">
                                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                                                                <div className="bg-white rounded-lg p-2 border border-gray-100">
                                                                    <p className="text-[8px] font-bold text-gray-400 uppercase mb-0.5">Heure</p>
                                                                    <p className="text-[11px] font-bold text-gray-800">{new Date(move.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                                                                </div>
                                                                <div className="bg-white rounded-lg p-2 border border-gray-100">
                                                                    <p className="text-[8px] font-bold text-gray-400 uppercase mb-0.5">ID</p>
                                                                    <p className="text-[10px] font-mono text-gray-500">#{move.id.slice(0, 8)}</p>
                                                                </div>
                                                                <div className="bg-white rounded-lg p-2 border border-gray-100">
                                                                    <p className="text-[8px] font-bold text-gray-400 uppercase mb-0.5">Opérateur</p>
                                                                    <p className="text-[11px] font-bold text-gray-800 truncate">{move.performer?.full_name || 'Système'}</p>
                                                                </div>
                                                                <div className="bg-white rounded-lg p-2 border border-gray-100">
                                                                    <p className="text-[8px] font-bold text-gray-400 uppercase mb-0.5">Site</p>
                                                                    <p className="text-[11px] font-bold text-gray-800 capitalize">{move.site}</p>
                                                                </div>
                                                            </div>
                                                            {move.notes && (
                                                                <div className="mt-2 bg-white rounded-lg p-2.5 border border-gray-100">
                                                                    <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">Notes</p>
                                                                    <p className="text-[11px] text-gray-600 leading-relaxed">{move.notes}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Modal d'Importation TXT */}
            {showImportModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl border border-white/20 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h2 className="text-xl font-black text-gray-900 tracking-tight">📋 Importer des produits</h2>
                                <p className="text-[10px] font-bold text-brand-600 uppercase tracking-widest mt-0.5">Depuis un fichier texte (.txt)</p>
                            </div>
                            <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-gray-200 rounded-xl text-gray-400 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            {/* Exemple de format */}
                            <div className="bg-gray-900 rounded-2xl p-5 text-left space-y-1">
                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3">Format du fichier (Nom - Quantité - Seuil)</p>
                                <p className="text-green-400 font-mono text-xs"># Boissons</p>
                                <p className="text-gray-300 font-mono text-xs pl-2">Coca Cola 33cl <span className="text-gray-500">- 50 - 10</span></p>
                                <p className="text-gray-300 font-mono text-xs pl-2">Fanta 33cl <span className="text-gray-500">- 30</span></p>
                                <p className="text-gray-300 font-mono text-xs pl-2">Sprite</p>
                                <p className="text-gray-600 font-mono text-xs mt-1"> </p>
                                <p className="text-green-400 font-mono text-xs"># Viandes</p>
                                <p className="text-gray-300 font-mono text-xs pl-2">Poulet Fermier <span className="text-gray-500">- 20 - 5</span></p>
                            </div>
                            <div className="text-[10px] text-gray-500 text-center space-y-1 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                                <p>✏️ <strong className="text-brand-600"># Catégorie</strong> puis les produits en dessous.</p>
                                <p>Séparer la quantité et le seuil d'alerte avec un tiret <strong className="text-gray-900">(-)</strong></p>
                                <p className="italic text-[9px] mt-1">(La quantité et le seuil sont optionnels)</p>
                            </div>

                            {/* Sélecteur de Site */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] block text-center">Destination</label>
                                <div className="grid grid-cols-3 gap-2 p-1.5 bg-gray-100 rounded-2xl">
                                    {[
                                        { id: 'abidjan', label: 'Abidjan' },
                                        { id: 'bassam', label: 'Bassam' },
                                        { id: 'both', label: 'Les Deux' }
                                    ].map((site) => (
                                        <button
                                            key={site.id}
                                            onClick={() => setImportTargetSite(site.id as any)}
                                            className={clsx(
                                                "py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                                importTargetSite === site.id
                                                    ? "bg-white text-brand-600 shadow-sm border border-brand-100"
                                                    : "text-gray-400 hover:text-gray-600"
                                            )}
                                        >
                                            {site.label}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[9px] text-gray-400 text-center font-medium italic">
                                    {importTargetSite === 'both'
                                        ? "Les produits seront ajoutés sur Abidjan et Bassam."
                                        : `Les produits seront ajoutés sur ${importTargetSite} uniquement.`}
                                </p>
                            </div>

                            {/* Zone de téléchargement */}
                            <div className="relative group">
                                <input
                                    type="file"
                                    accept=".txt,.text"
                                    onChange={handleFileUpload}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                                <div className="border-4 border-dashed border-gray-100 group-hover:border-brand-200 group-hover:bg-brand-50/30 rounded-[2rem] p-8 flex flex-col items-center justify-center transition-all">
                                    <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600 mb-3 group-hover:scale-110 group-hover:rotate-3 transition-transform">
                                        <FileUp className="w-7 h-7" />
                                    </div>
                                    <p className="text-xs font-black text-gray-900 uppercase tracking-widest">Choisir le fichier .txt</p>
                                    <p className="text-[10px] text-gray-400 mt-2 font-bold">📱 Compatible avec les Notes du téléphone</p>
                                </div>
                            </div>

                            <button
                                onClick={() => setShowImportModal(false)}
                                className="w-full py-3 text-[11px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors"
                            >
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
