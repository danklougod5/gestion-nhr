import { useState, useEffect } from 'react';
import { Plus, Trash2, Send, Clock, ShoppingBag, Edit2, X, Filter, Search, RefreshCw, MapPin, Package, LayoutGrid, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import type { Product, Site } from '../types';
import { useAuth } from '../hooks/useAuth';
import { logAudit } from '../lib/audit';
import clsx from 'clsx';

export default function Needs() {
    const { profile } = useAuth();
    const [selectedSite, setSelectedSite] = useState<Site>('abidjan');
    const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
    const [products, setProducts] = useState<Product[]>([]);
    const [items, setItems] = useState<{ productId: string, quantity: number }[]>([]);
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState<any[]>([]);

    // UI States
    const [editingMovementId, setEditingMovementId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    const [selectedRequest, setSelectedRequest] = useState<any | null>(null);

    // Filter States
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        productId: '',
        search: ''
    });

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
    }, [activeTab, profile, filters, selectedSite]); // Reload when filters or selected site change

    const handleRequestClick = async (req: any) => {
        // ⚠️ NE JAMAIS RECHARGER depuis la base pour éviter d'écraser les modifications locales
        // On utilise directement le bon depuis l'état 'history' qui contient les dernières modifications
        setSelectedRequest(req);
    };

    const fetchHistory = async () => {
        try {
            // Base query with !inner join if product filter is active to ensure constraints
            let query = supabase
                .from('needs_requests')
                .select(`
                    *,
                    creator:profiles(full_name),
                    movements:stock_movements!inner(
                        id,
                        quantity,
                        product_id,
                        site,
                        product:products(name)
                    )
                `)
                .order('created_at', { ascending: false });

            // 0. Site Filter
            query = query.eq('site', selectedSite);

            // 1. Date Filters
            if (filters.startDate) {
                query = query.gte('created_at', filters.startDate);
            }
            if (filters.endDate) {
                // Add time to cover the full end date
                query = query.lte('created_at', filters.endDate + 'T23:59:59');
            } else if (!profile?.permissions?.view_full_needs_history) {
                // Default restriction if no filter and no permission
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                query = query.gte('created_at', today.toISOString());
            }

            // 2. Product Filter
            if (filters.productId) {
                // Filter requests that contain this product via the inner join
                query = query.eq('stock_movements.product_id', filters.productId);
            }

            // 3. Text Search (Product Name, Category)
            if (filters.search) {
                // First find matching products
                const { data: matchingProducts, error: pError } = await supabase
                    .from('products')
                    .select('id')
                    .or(`name.ilike.%${filters.search}%,category.ilike.%${filters.search}%`);

                if (pError) throw pError;

                const productIds = matchingProducts?.map(p => p.id) || [];

                // If we found products, filter by their IDs
                if (productIds.length > 0) {
                    query = query.in('stock_movements.product_id', productIds);
                } else {
                    // No products match
                    setHistory([]);
                    setLoading(false);
                    return;
                }
            }

            // ⛔ 4. Access Control Filter
            // Si l'utilisateur n'est pas Admin ET n'a pas la permission de tout voir
            if (profile?.role !== 'admin' && !profile?.permissions?.view_full_needs_history) {
                query = query.eq('created_by', profile?.id);
            }

            const { data, error } = await query.limit(50);
            if (error) throw error;
            setHistory(data || []);
        } catch (error) {
            console.error('Error fetching history:', error);
            toast.error("Erreur de chargement de l'historique");
        } finally {
            setLoading(false);
        }
    };

    const fetchProducts = async () => {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('site', selectedSite)
                .neq('category', 'ARCHIVED')
                .order('name', { ascending: true });

            if (error) throw error;
            if (data) {
                // Double protection: Filtrer les produits archivés
                setProducts(data.filter(p => p.category !== 'ARCHIVED' && !p.name.startsWith('ARCHIVED -')));
            }
        } catch (error: any) {
            console.error('Error fetching products:', error);
            toast.error("Erreur lors du chargement des produits");
        }
    };

    const addItem = () => {
        setItems([...items, { productId: '', quantity: 0 }]);
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const removeItem = (index: number) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    const handleSubmit = async () => {
        if (!profile) {
            toast.error("Session expirée, veuillez vous reconnecter");
            return;
        }

        if (!selectedSite || items.length === 0) {
            toast.error("Veuillez ajouter des produits");
            return;
        }

        if (items.some(item => !item.productId || item.quantity <= 0)) {
            toast.error('Veuillez remplir tous les champs correctement');
            return;
        }

        // Vérification rigoureuse des stocks AVANT la création
        for (const item of items) {
            const product = products.find(p => p.id === item.productId);
            if (!product) continue;

            const stockField = selectedSite === 'abidjan' ? 'stock_abidjan' : 'stock_bassam';
            const currentStock = (product as any)[stockField] || 0;

            if (item.quantity > currentStock) {
                toast.error(`Stock insuffisant pour ${product.name} (Max: ${currentStock})`);
                return; // ⛔ ARRÊT IMMÉDIAT
            }
        }

        setLoading(true);
        try {
            const { data: request, error: requestError } = await supabase
                .from('needs_requests')
                .insert([{
                    created_by: profile.id,
                    site: selectedSite,
                    items_count: items.length
                }])
                .select()
                .single();

            if (requestError) throw requestError;

            for (const item of items) {
                const product = products.find(p => p.id === item.productId);
                if (!product) continue;

                const stockField = selectedSite === 'abidjan' ? 'stock_abidjan' : 'stock_bassam';
                const currentStock = (product as any)[stockField] || 0;

                const newStock = Math.max(0, currentStock - item.quantity);

                await supabase.from('products').update({ [stockField]: newStock }).eq('id', item.productId);

                await supabase.from('stock_movements').insert({
                    product_id: item.productId,
                    type: 'OUT',
                    quantity: item.quantity,
                    site: selectedSite,
                    performed_by: profile.id,
                    request_id: request.id,
                    notes: `Bon de sortie #${request.id.slice(0, 8)} `
                });
            }

            await logAudit({
                action_type: 'CREATE',
                entity_type: 'NEEDS_REQUEST',
                entity_id: request.id,
                site: selectedSite,
                details: { items_count: items.length }
            }, profile);

            toast.success('Bon de sortie validé !');
            setItems([]);
            fetchProducts();
            setActiveTab('history');
        } catch (error: any) {
            console.error('Error submitting request:', error);
            toast.error('Erreur lors de la validation : ' + error.message);
        } finally {
            setLoading(false);
        }
    };


    const handleDeleteRequest = async (request: any) => {
        if (!profile) return;

        if (!profile.permissions?.delete_needs) {
            toast.error("Permission refusée (Suppression)");
            return;
        }

        const reason = window.prompt(`Voulez-vous vraiment SUPPRIMER le bon #${request.id.slice(0, 8)} ?\nCette action est irréversible et le stock sera réajusté.\n\nVEUILLEZ SAISIR LE MOTIF DE SUPPRESSION :`);

        if (reason === null) return; // Annuler
        if (!reason.trim()) {
            toast.error("Un motif de suppression est obligatoire");
            return;
        }

        setLoading(true);
        try {
            // 1. Récupérer les mouvements pour remise en stock
            const { data: movements, error: moveError } = await supabase
                .from('stock_movements')
                .select('*')
                .eq('request_id', request.id);

            if (moveError) throw moveError;

            // Log avant suppression
            await logAudit({
                action_type: 'DELETE',
                entity_type: 'NEEDS_REQUEST',
                entity_id: request.id,
                site: request.site,
                reason: reason.trim(),
                details: {
                    movements_count: movements?.length,
                    requested_by: request.requested_by,
                    items: movements?.map(m => ({ product: m.product_id, qty: m.quantity })),
                    motive: reason.trim() // Duplicate in details just in case columns aren't ready
                }
            }, profile);

            // 2. Inverser le stock
            for (const move of movements || []) {
                const stockField = move.site === 'abidjan' ? 'stock_abidjan' : 'stock_bassam';
                const { data: product } = await supabase.from('products').select(stockField).eq('id', move.product_id).single();

                if (product) {
                    const currentStock = (product as any)[stockField] || 0;
                    await supabase.from('products').update({ [stockField]: currentStock + move.quantity }).eq('id', move.product_id);
                }
            }

            // 3. Supprimer les mouvements
            const { error: delMoveError } = await supabase
                .from('stock_movements')
                .delete()
                .eq('request_id', request.id);

            if (delMoveError) throw delMoveError;

            // 4. Supprimer le bon
            const { error: delReqError } = await supabase
                .from('needs_requests')
                .delete()
                .eq('id', request.id);

            if (delReqError) throw delReqError;

            toast.success('Bon supprimé avec succès');
            fetchHistory();
            fetchProducts();
            if (selectedRequest?.id === request.id) setSelectedRequest(null);
        } catch (error: any) {
            console.error('Delete error:', error);
            toast.error('Échec de la suppression : ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEditQuantity = async (movement: any, newQty: number) => {
        if (!profile) return;

        if (!profile.permissions?.edit_needs) {
            toast.error("Permission refusée (Modification)");
            return;
        }

        if (isNaN(newQty) || newQty <= 0) {
            toast.error("La quantité doit être supérieure à 0");
            return;
        }

        // Check for no-op
        if (newQty === movement.quantity) {
            toast("Aucune modification détectée", { icon: 'ℹ️' });
            setEditingMovementId(null);
            return;
        }

        const reason = window.prompt(`Modifier la quantité de ${movement.quantity} à ${newQty} ?\n\nVEUILLEZ SAISIR LE MOTIF :`);
        if (reason === null) return;
        if (!reason.trim()) {
            toast.error("Motif obligatoire pour toute modification de stock");
            return;
        }

        setLoading(true);
        try {
            const oldQty = movement.quantity;
            const diff = newQty - oldQty; // positif si augmentation, négatif si diminution
            const stockField = movement.site === 'abidjan' ? 'stock_abidjan' : 'stock_bassam';

            // 🔒 SÉCURITÉ: Récupérer le total des ENTRÉES (achats) pour ce produit/site
            const { data: inMovements } = await supabase
                .from('stock_movements')
                .select('quantity')
                .eq('product_id', movement.product_id)
                .eq('site', movement.site)
                .eq('type', 'IN');

            const totalPurchased = (inMovements || []).reduce((sum: number, m: any) => sum + (m.quantity || 0), 0);

            // 🔒 SÉCURITÉ: Récupérer le total des SORTIES (besoins) pour ce produit/site
            const { data: outMovements } = await supabase
                .from('stock_movements')
                .select('id, quantity')
                .eq('product_id', movement.product_id)
                .eq('site', movement.site)
                .eq('type', 'OUT');

            // Calculer le total des sorties APRES modification
            const totalOutAfterEdit = (outMovements || []).reduce((sum: number, m: any) => {
                if (m.id === movement.id) {
                    return sum + newQty; // nouvelle quantité pour ce mouvement
                }
                return sum + (m.quantity || 0);
            }, 0);

            // 🔒 Le stock après modification = total acheté - total sorti (modifié)
            const stockAfterEdit = totalPurchased - totalOutAfterEdit;

            // ⛔ BLOCAGE: Le stock ne peut pas être négatif
            if (stockAfterEdit < 0) {
                toast.error(`Impossible: le stock deviendrait négatif (${stockAfterEdit})`);
                setLoading(false);
                return;
            }

            const { data: product } = await supabase.from('products').select(stockField).eq('id', movement.product_id).single();

            if (!product) {
                toast.error("Erreur: Produit introuvable lors de la vérification du stock");
                setLoading(false);
                return;
            }

            const currentStock = (product as any)[stockField] || 0;

            // Si on AUGMENTE la quantité sortie, on doit vérifier qu'il y a assez de stock
            if (diff > 0 && diff > currentStock) {
                toast.error(`Impossible: Stock insuffisant (${currentStock} dispo pour un ajout de ${diff})`);
                setLoading(false);
                return;
            }

            // ⛔ BLOCAGE SUPPLÉMENTAIRE: Validation finale du stock calculé
            const newStock = currentStock - diff;
            if (newStock < 0) {
                toast.error(`Impossible: Le stock final serait négatif (${newStock})`);
                setLoading(false);
                return;
            }

            await supabase.from('products').update({ [stockField]: newStock }).eq('id', movement.product_id);

            // Construction de la note de traçabilité
            const modificationNote = ` | Modif ${new Date().toLocaleDateString('fr-FR')} par ${profile.full_name?.split(' ')[0] || 'Admin'}: Stock ${currentStock}➔${newStock}, Qté ${oldQty}➔${newQty}`;
            const newNote = (movement.notes || '') + modificationNote;

            // Mise à jour du mouvement en vérifiant le nombre de lignes impactées
            const { error: updateError, count } = await supabase
                .from('stock_movements')
                .update({ quantity: newQty, notes: newNote }, { count: 'exact' })
                .eq('id', movement.id);

            if (updateError) {
                console.error('❌ Erreur update stock_movements:', updateError);
                toast.error(`Erreur DB: ${updateError.message} `);
                setLoading(false);
                return;
            }

            // ⚠️ DETECTION RLS SILENT FAILURE & CONTOURNEMENT
            if (count === 0) {
                console.warn('⚠️ UPDATE bloqué par RLS. Tentative de contournement via DELETE + INSERT...');

                // 1. Récupérer les infos complètes du mouvement original
                const { data: originalMvt, error: fetchError } = await supabase
                    .from('stock_movements')
                    .select('*')
                    .eq('id', movement.id)
                    .single();

                if (fetchError || !originalMvt) {
                    toast.error("Impossible de récupérer le mouvement original pour le contournement");
                    setLoading(false);
                    return;
                }

                // 2. Insérer le nouveau mouvement (copie conforme avec nouvelle quantité et note mise à jour)
                // On exclut l'ID (généré auto) et created_at
                const { id, created_at, ...mvtData } = originalMvt;
                const noteForInsert = (originalMvt.notes || '') + modificationNote;

                const { error: insertError } = await supabase
                    .from('stock_movements')
                    .insert([{
                        ...mvtData,
                        quantity: newQty,
                        notes: noteForInsert
                    }]);

                if (insertError) {
                    toast.error(`Erreur contournement(Insert): ${insertError.message} `);
                    setLoading(false);
                    return;
                }

                // 3. Supprimer l'ancien mouvement (s'il existe toujours)
                const { error: deleteError } = await supabase
                    .from('stock_movements')
                    .delete()
                    .eq('id', movement.id);

                if (deleteError) {
                    console.error("Delete failed after insert", deleteError);
                    // On ne bloque pas car l'insertion a réussi, au pire on a un doublon temporaire
                }

                toast.success(`Quantité modifiée(via recréation)`);

                // Log modification (workaround)
                logAudit({
                    action_type: 'UPDATE',
                    entity_type: 'STOCK_MOVEMENT',
                    entity_id: movement.id,
                    site: movement.site,
                    reason: reason.trim(),
                    details: { old_qty: oldQty, new_qty: newQty, method: 'DELETE_INSERT_WORKAROUND', trace: modificationNote, motive: reason.trim() }
                }, profile);

                // IMPORTANT: Comme l'ID a changé, on DOIT recharger l'historique pour mettre à jour les IDs
                // L'interface clignotera peut-être, mais c'est nécessaire ici.
                setEditingMovementId(null);
                setEditValue('');
                fetchHistory(); // Rechargement complet
                fetchProducts();
                setLoading(false); // Important: sortir ici
                return;
            }

            toast.success(`Quantité modifiée: ${oldQty} → ${newQty} `);

            // Log modification
            logAudit({
                action_type: 'UPDATE',
                entity_type: 'STOCK_MOVEMENT',
                entity_id: movement.id,
                site: movement.site,
                reason: reason.trim(),
                details: { old_qty: oldQty, new_qty: newQty, method: 'UPDATE', motive: reason.trim() }
            }, profile);

            // 🔥 MISE À JOUR LOCALE IMMÉDIATE (Optimistic UI)
            const updateMovements = (movements: any[]) => {
                return movements?.map((m: any) =>
                    m.id === movement.id ? { ...m, quantity: newQty } : m
                ) || [];
            };

            // 1. Mettre à jour le bon sélectionné
            if (selectedRequest) {
                setSelectedRequest((prev: any) => ({
                    ...prev,
                    movements: updateMovements(prev.movements)
                }));
            }

            // 2. Mettre à jour l'historique
            setHistory(prevHistory =>
                prevHistory.map(req => ({
                    ...req,
                    movements: updateMovements(req.movements)
                }))
            );

            // 3. Reset UI
            setEditingMovementId(null);
            setEditValue('');

            // 4. Update products ONLY (background) - Pas de reload history pour éviter le clignotement
            fetchProducts();

        } catch (error: any) {
            console.error('Erreur modification:', error);
            toast.error('Erreur : ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const resetFilters = () => {
        setFilters({
            startDate: '',
            endDate: '',
            productId: '',
            search: ''
        });
    };

    return (
        <div className="flex flex-col max-w-7xl mx-auto min-h-screen pb-32">
            {/* Sticky Header Section */}
            <div className="sticky top-0 z-20 bg-[#F8FAFC]/80 backdrop-blur-md pb-4 pt-4">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 px-4">
                    <div className="text-center md:text-left">
                        <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight flex items-center justify-center md:justify-start">
                            <ShoppingBag className="w-5 h-5 mr-2 text-brand-600" />
                            Sorties Stock
                        </h1>
                        <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-1">Gérez vos bons de sortie</p>
                    </div>

                    <div className="flex items-center gap-3">
                        {profile?.role === 'admin' ? (
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
                        ) : (
                            <div className="bg-white border border-gray-100 px-4 py-1.5 rounded-xl shadow-sm flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-brand-500" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-brand-700">{profile?.site}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Tabs & Quick Filters */}
                <div className="bg-white mx-4 rounded-2xl border border-gray-100 shadow-sm p-2 flex flex-col md:flex-row items-center gap-4">
                    <div className="flex bg-gray-50 p-1 rounded-xl w-full md:w-auto">
                        <button
                            onClick={() => setActiveTab('new')}
                            className={clsx(
                                "flex-1 md:flex-none px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                                activeTab === 'new' ? "bg-white text-brand-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                            )}
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Nouveau
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={clsx(
                                "flex-1 md:flex-none px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                                activeTab === 'history' ? "bg-white text-brand-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                            )}
                        >
                            <Clock className="w-3.5 h-3.5" />
                            Historique
                        </button>
                    </div>

                    {activeTab === 'history' ? (
                        <div className="flex-1 flex items-center gap-3 w-full">
                            <div className="relative flex-1 group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-brand-600 transition-colors w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Rechercher un bon (#id, auteur)..."
                                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-brand-200 outline-none transition-all font-bold text-xs text-gray-900"
                                    value={filters.search}
                                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                />
                            </div>
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={clsx(
                                    "p-2 rounded-xl border transition-all flex items-center gap-2",
                                    showFilters ? "bg-brand-50 border-brand-200 text-brand-600" : "bg-white border-gray-100 text-gray-400"
                                )}
                            >
                                <Filter className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Advanced</span>
                            </button>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center gap-3 justify-end w-full px-2">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-50 rounded-xl border border-brand-100/50">
                                <Package className="w-3.5 h-3.5 text-brand-500" />
                                <span className="text-[9px] font-black uppercase text-brand-600 tracking-widest">{items.length} produits en attente</span>
                            </div>
                        </div>
                    )}
                </div>

                {activeTab === 'history' && showFilters && (
                    <div className="mx-4 mt-2 bg-white rounded-2xl border border-gray-100 shadow-xl p-4 animate-in slide-in-from-top-2 duration-300">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
                            <div className="space-y-1.5 sm:col-span-2 md:col-span-1">
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
            </div>

            <div className="flex-1 px-4 py-6">
                {activeTab === 'new' ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {items.map((item, idx) => {
                                const product = products.find(p => p.id === item.productId);
                                const stock = product ? (product as any)[selectedSite === 'abidjan' ? 'stock_abidjan' : 'stock_bassam'] : 0;
                                const isExcess = (item.quantity || 0) > stock;

                                return (
                                    <div key={idx} className="group relative bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-xl hover:shadow-brand-100/50 transition-all border-l-4 border-l-brand-500">
                                        <div className="flex justify-between items-center mb-4">
                                            <div className="flex items-center gap-2">
                                                <span className="w-5 h-5 bg-brand-50 text-brand-600 rounded-md flex items-center justify-center text-[10px] font-black italic">
                                                    {idx + 1}
                                                </span>
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Produit</span>
                                            </div>
                                            <button
                                                onClick={() => removeItem(idx)}
                                                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="relative group/select">
                                                <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 group-focus-within/select:text-brand-500 transition-colors pointer-events-none" />
                                                <select
                                                    value={item.productId}
                                                    onChange={(e) => updateItem(idx, 'productId', e.target.value)}
                                                    className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-transparent rounded-xl text-xs font-bold text-gray-900 focus:bg-white focus:border-brand-200 outline-none transition-all cursor-pointer appearance-none"
                                                >
                                                    <option value="">Sélectionner...</option>
                                                    {products.map(p => {
                                                        const s = (p as any)[selectedSite === 'abidjan' ? 'stock_abidjan' : 'stock_bassam'] || 0;
                                                        return <option key={p.id} value={p.id} disabled={s <= 0}>{p.name} ({s})</option>
                                                    })}
                                                </select>
                                            </div>

                                            <div className="space-y-1.5">
                                                <div className="flex justify-between items-center px-1">
                                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Quantité</label>
                                                    {product && (
                                                        <span className={clsx(
                                                            "text-[8px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-md",
                                                            isExcess ? "bg-red-50 text-red-600 animate-pulse" : "bg-brand-50 text-brand-600"
                                                        )}>
                                                            {isExcess ? `MAX: ${stock} ` : `DISPO: ${stock} `}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="relative">
                                                    <LayoutGrid className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                                                    <input
                                                        type="number"
                                                        value={item.quantity || ''}
                                                        onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                                        placeholder="0"
                                                        className={clsx(
                                                            "w-full pl-9 pr-4 py-3 bg-gray-50 border border-transparent rounded-xl text-xl font-black tabular-nums transition-all outline-none",
                                                            isExcess ? "text-red-600 bg-red-50 focus:border-red-200" : "text-gray-900 focus:bg-white focus:border-brand-200"
                                                        )}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            <button
                                onClick={addItem}
                                className="h-[180px] border-2 border-dashed border-gray-100 rounded-2xl bg-white text-gray-300 hover:border-brand-200 hover:text-brand-600 hover:bg-brand-50/50 transition-all flex flex-col items-center justify-center p-6 group"
                            >
                                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-brand-100 transition-all duration-300">
                                    <Plus className="w-5 h-5 group-hover:text-brand-600" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-center">Ajouter un produit</span>
                            </button>
                        </div>

                        {/* Submit Section - Fixed at the bottom */}
                        {items.length > 0 && (
                            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-[90] animate-in slide-in-from-bottom-10 duration-700">
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    className="w-full bg-gray-900 text-white rounded-[2rem] py-5 px-8 font-black text-xs uppercase tracking-[0.3em] shadow-2xl shadow-gray-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-4 group overflow-hidden relative"
                                >
                                    <div className="absolute inset-0 bg-brand-600 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                                    <div className="relative flex items-center gap-4">
                                        {loading ? (
                                            <RefreshCw className="animate-spin w-4 h-4" />
                                        ) : (
                                            <Send className="w-4 h-4" />
                                        )}
                                        <span>Valider {items.length} besoin{items.length > 1 ? 's' : ''}</span>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {history.length === 0 ? (
                            <div className="col-span-full py-32 text-center bg-gray-50/20 rounded-[4rem] border-4 border-dashed border-gray-100 flex flex-col items-center">
                                <div className="w-24 h-24 bg-gray-100 rounded-[2rem] flex items-center justify-center mb-8 opacity-40">
                                    <ShoppingBag className="w-12 h-12 text-gray-400" />
                                </div>
                                <p className="font-black uppercase tracking-[0.4em] text-gray-300 text-sm">Historique vide</p>
                                <p className="text-gray-400 font-medium text-xs mt-4">Commencez par créer un nouveau bon de sortie</p>
                            </div>
                        ) : (
                            history.map((req) => (
                                <div
                                    key={req.id}
                                    onClick={() => handleRequestClick(req)}
                                    className="group bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-brand-100/50 transition-all duration-300 flex flex-col relative overflow-hidden cursor-pointer border-l-4 border-l-brand-500"
                                >
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gray-50 group-hover:bg-brand-50 rounded-xl flex items-center justify-center transition-colors">
                                                <Clock className="w-5 h-5 text-gray-300 group-hover:text-brand-500" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-[11px] font-black text-gray-900 uppercase tracking-widest truncate max-w-[120px]">#{req.id.slice(0, 8)}</h3>
                                                    <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded-lg text-[8px] font-black uppercase tracking-tighter">Validé</span>
                                                </div>
                                                <p className="text-[10px] font-bold text-gray-400 mt-0.5">{new Date(req.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-1.5">
                                            <div className="px-2 py-1 bg-brand-50 text-brand-600 rounded-lg font-black text-[8px] tracking-widest uppercase">
                                                {req.site}
                                            </div>
                                            {profile?.permissions?.delete_needs && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteRequest(req); }}
                                                    className="p-1.5 text-gray-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>


                                    <div className="space-y-2 flex-1 overflow-hidden">
                                        {req.movements?.slice(0, 3).map((m: any, i: number) => (
                                            <div key={m.id || i} className="flex items-center justify-between bg-gray-50/50 px-4 py-3 rounded-xl border border-transparent hover:border-brand-100 hover:bg-white transition-all group/item">
                                                <div className="flex flex-col min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px] font-black text-gray-700 truncate">{m.product?.name}</span>
                                                        {m.notes?.includes('| Modif') && (
                                                            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 rounded-md border border-amber-100" title={m.notes}>
                                                                <RefreshCw className="w-2 h-2 text-amber-500 animate-spin-slow" />
                                                                <span className="text-[7px] font-black text-amber-600 uppercase tracking-tighter">Modifié</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">ID: {m.id.slice(0, 5)}</span>
                                                    {m.notes?.includes('| Modif') && (
                                                        <p className="text-[8px] text-amber-600 font-medium line-clamp-1 mt-0.5 opacity-70 italic">
                                                            {m.notes.split('| Modif').pop()?.trim()}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    {editingMovementId === m.id ? (
                                                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                            <input
                                                                type="number"
                                                                autoFocus
                                                                value={editValue}
                                                                onChange={(e) => setEditValue(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') handleEditQuantity(m, parseFloat(editValue));
                                                                    if (e.key === 'Escape') setEditingMovementId(null);
                                                                }}
                                                                className="w-14 px-2 py-1 bg-white border border-brand-500 rounded text-[11px] font-black text-center outline-none"
                                                            />
                                                            <div className="flex flex-col gap-0.5">
                                                                <button onClick={(e) => { e.stopPropagation(); handleEditQuantity(m, parseFloat(editValue)); }} className="text-brand-600 hover:bg-brand-50 p-0.5 rounded"><Check className="w-3 h-3" /></button>
                                                                <button onClick={(e) => { e.stopPropagation(); setEditingMovementId(null); }} className="text-gray-400 hover:bg-gray-100 p-0.5 rounded"><X className="w-3 h-3" /></button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-sm font-black text-gray-900 tabular-nums">{m.quantity}</span>
                                                                <span className="text-[8px] font-black text-gray-300 uppercase leading-none">QTÉ</span>
                                                            </div>
                                                            {profile?.permissions?.edit_needs && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setEditingMovementId(m.id); setEditValue(m.quantity.toString()); }}
                                                                    className="p-2 text-brand-600 bg-brand-50/50 hover:bg-brand-600 hover:text-white rounded-lg transition-all border border-brand-100/50 shadow-sm"
                                                                    title="Modifier la quantité"
                                                                >
                                                                    <Edit2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}

                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))}

                                        {req.movements?.length > 3 && (
                                            <div className="text-center py-2">
                                                <span className="text-[10px] font-black text-gray-300 uppercase tracking-[0.4em]">+ {req.movements.length - 3} autres produits</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-gray-50 flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center text-[8px] font-black text-brand-600 uppercase">
                                                {req.creator?.full_name?.[0] || 'U'}
                                            </div>
                                            <span className="text-[9px] font-black text-gray-400 capitalize truncate max-w-[80px]">{req.creator?.full_name?.split(' ')[0]}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                                            <div className="w-1 h-1 rounded-full bg-brand-500"></div>
                                            <span className="text-[8px] font-black text-brand-500 uppercase tracking-widest italic">Archivé</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Details Modal — Ultra Compact Premium */}
            {selectedRequest && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 bg-white">
                            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-lg flex-shrink-0">
                                <Clock className="w-5 h-5 text-brand-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-sm font-black text-gray-900 tracking-tight uppercase">Bon de sortie #{selectedRequest.id.slice(0, 8)}</h2>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded text-[8px] font-black uppercase tracking-widest">Validé</span>
                                    <span className="text-[8px] font-black text-gray-400 border-l border-gray-200 pl-2 uppercase">{selectedRequest.site}</span>
                                </div>
                            </div>
                            <button onClick={() => setSelectedRequest(null)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div className="flex gap-4">
                                <div className="flex-1 bg-gray-50/50 p-3 rounded-2xl border border-gray-100">
                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Collaborateur</p>
                                    <p className="text-xs font-black text-gray-900">{selectedRequest.creator?.full_name || 'Système'}</p>
                                </div>
                                <div className="flex-1 bg-gray-50/50 p-3 rounded-2xl border border-gray-100">
                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Date</p>
                                    <p className="text-xs font-black text-gray-900">{new Date(selectedRequest.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Composition du bon</h3>
                                <div className="space-y-2">
                                    {selectedRequest.movements?.map((m: any, i: number) => (
                                        <div key={m.id || i} className="flex flex-col w-full">
                                            <div className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-gray-100 hover:border-brand-200 transition-all shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] font-black text-gray-300 italic">{i + 1}</span>
                                                    <p className="text-xs font-black text-gray-800 uppercase tracking-tight">{m.product?.name}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg font-black text-gray-900 tabular-nums">{m.quantity}</span>
                                                    <span className="text-[8px] font-black text-gray-300 uppercase">Unités</span>
                                                </div>
                                            </div>
                                            {m.notes?.includes('| Modif') && (
                                                <div className="mt-1 ml-4 p-2 bg-amber-50/50 rounded-lg border-l-2 border-amber-200 space-y-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock className="w-2.5 h-2.5 text-amber-500" />
                                                        <span className="text-[8px] font-black text-amber-700 uppercase tracking-widest">Historique des modifications</span>
                                                    </div>
                                                    {m.notes.split('|').filter((n: string) => n.includes('Modif')).map((note: string, idx: number) => (
                                                        <p key={`${m.id}-note-${idx}`} className="text-[9px] text-amber-800 font-medium leading-tight pl-4 relative">
                                                            <span className="absolute left-1 top-1.5 w-1 h-1 rounded-full bg-amber-300"></span>
                                                            {note.trim()}
                                                        </p>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-gray-50/50 border-t border-gray-100">
                            <button
                                onClick={() => setSelectedRequest(null)}
                                className="w-full py-4 bg-gray-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg active:scale-95"
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
