import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
    Clock,
    AlertCircle,
    ChevronUp,
    ChevronDown,
    Info,
    User,
    Package,
    Settings,
    Database,
    Trash2,
    Edit2,
    Plus,
    Search,
    Calendar,
    RefreshCw,
    LayoutGrid,
    FileText
} from 'lucide-react';
import clsx from 'clsx';

interface AuditLog {
    id: string;
    created_at: string;
    user_name: string;
    action_type: string;
    entity_type: string;
    entity_id: string;
    site: string;
    reason?: string;
    details: any;
}

export function AuditLogView() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});

    // Filters state
    const [nameFilter, setNameFilter] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [actionFilter, setActionFilter] = useState<string>('ALL');
    const [siteFilter, setSiteFilter] = useState<string>('ALL');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const resetFilters = () => {
        setNameFilter('');
        setDateFilter('');
        setActionFilter('ALL');
        setSiteFilter('ALL');
    };

    const fetchLogs = async () => {
        try {
            setLoading(true);
            setError(null);

            let query = supabase
                .from('audit_logs')
                .select('*')
                .order('created_at', { ascending: false });

            if (nameFilter.trim()) {
                query = query.ilike('user_name', `%${nameFilter.trim()}%`);
            }

            if (actionFilter !== 'ALL') {
                query = query.eq('action_type', actionFilter);
            }

            if (siteFilter !== 'ALL') {
                query = query.eq('site', siteFilter.toLowerCase());
            }

            if (dateFilter) {
                const start = new Date(`${dateFilter}T00:00:00`);
                const end = new Date(`${dateFilter}T23:59:59.999`);
                query = query.gte('created_at', start.toISOString())
                    .lte('created_at', end.toISOString());
            }

            const { data, error: fetchError } = await query.limit(200);

            if (fetchError) throw fetchError;
            if (data) setLogs(data);
        } catch (err: any) {
            console.error('Erreur chargement audit:', err);
            if (err.code === '42P01') {
                setError("La table d'audit n'existe pas. Veuillez exécuter le script audit_setup.sql");
            } else {
                setError("Impossible de charger l'audit : " + (err.message || 'Erreur inconnue'));
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchLogs();
        }, 400);
        return () => clearTimeout(timer);
    }, [nameFilter, actionFilter, dateFilter, siteFilter]);

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedLogs(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const getActionIcon = (type: string) => {
        switch (type) {
            case 'DELETE': return <Trash2 className="w-5 h-5" />;
            case 'UPDATE': return <Edit2 className="w-5 h-5" />;
            case 'CREATE': return <Plus className="w-5 h-5" />;
            default: return <Info className="w-5 h-5" />;
        }
    };

    const getEntityIcon = (type: string) => {
        switch (type) {
            case 'STOCK_MOVEMENT': return <Clock className="w-4 h-4" />;
            case 'NEEDS_REQUEST': return <FileText className="w-4 h-4" />;
            case 'PRODUCT': return <Package className="w-4 h-4" />;
            case 'USER': return <User className="w-4 h-4" />;
            case 'CATEGORY': return <LayoutGrid className="w-4 h-4" />;
            default: return <Package className="w-4 h-4" />;
        }
    };

    const getLogSummary = (log: AuditLog) => {
        const d = log.details || {};
        const action = log.action_type;
        const entity = log.entity_type;

        switch (entity) {
            case 'PRODUCT':
                if (action === 'CREATE') return `Création du produit "${d.name || 'Inconnu'}"`;
                if (action === 'UPDATE') return `Mise à jour du produit "${d.name || 'Inconnu'}"`;
                if (action === 'DELETE') return `Suppression du produit "${d.name || 'Inconnu'}"`;
                break;
            case 'STOCK_MOVEMENT':
                if (action === 'CREATE' || action === 'UPDATE') {
                    const type = d.type || (log.action_type === 'UPDATE' ? 'MODIF' : '');
                    if (type === 'IN') return `Entrée en stock de ${d.quantity} ${d.product_name || 'unités'}`;
                    if (type === 'OUT') return `Sortie de stock de ${d.quantity} ${d.product_name || 'unités'}`;
                    return `Correction de quantité pour ${d.product_name || 'un produit'}`;
                }
                break;
            case 'NEEDS_REQUEST':
                if (action === 'CREATE') return `Génération d'un bon de sortie (${d.items_count || 0} articles)`;
                if (action === 'DELETE') return `Annulation d'un bon de sortie (#${log.entity_id.slice(0, 8)})`;
                break;
            case 'CATEGORY':
                if (action === 'CREATE') return `Nouvelle catégorie : ${d.name}`;
                if (action === 'DELETE') return `Suppression de la catégorie ${d.name}`;
                break;
            case 'USER':
                if (action === 'CREATE') return `Création de l'utilisateur ${d.full_name || d.username}`;
                if (action === 'UPDATE') return `Modification de l'utilisateur ${d.full_name || d.username}`;
                if (action === 'DELETE') return `Suppression de l'utilisateur ${d.full_name || d.username}`;
                if (action === 'LOGIN') return `Connexion au système`;
                break;
        }

        return `${action} sur ${entity}`;
    };

    const renderDetails = (log: AuditLog) => {
        const d = log.details || {};
        const reason = log.reason || d.motive;

        return (
            <div className="mt-6 pt-6 border-t border-gray-100 space-y-5 animate-in fade-in slide-in-from-top-4 duration-500">
                {/* Motivation - Highlighted */}
                <div className="bg-amber-50/80 p-5 rounded-3xl border border-amber-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-2 text-amber-600 font-black text-[10px] uppercase tracking-[0.2em]">
                        <AlertCircle className="w-4 h-4" />
                        Motif de l'opération
                    </div>
                    <p className="text-sm font-black text-amber-900 leading-relaxed italic">
                        "{reason || "Aucun motif spécifié par l'opérateur"}"
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Object Info */}
                    <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-2 mb-4 text-gray-400 font-black text-[9px] uppercase tracking-widest">
                            <Package className="w-4 h-4" />
                            Objet de l'action
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center bg-gray-50/50 p-2.5 rounded-xl">
                                <span className="text-[10px] font-bold text-gray-400 uppercase">Élément</span>
                                <span className="text-[11px] font-black text-gray-900 uppercase">{d.name || d.username || log.entity_type}</span>
                            </div>
                            <div className="flex justify-between items-center bg-gray-50/50 p-2.5 rounded-xl">
                                <span className="text-[10px] font-bold text-gray-400 uppercase">Identifiant</span>
                                <span className="text-[10px] font-mono text-brand-600 font-bold">#{log.entity_id.slice(0, 12)}...</span>
                            </div>
                            {d.category && (
                                <div className="flex justify-between items-center bg-gray-50/50 p-2.5 rounded-xl">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Catégorie</span>
                                    <span className="text-[11px] font-black text-gray-900">{d.category}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Meta Info */}
                    <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-2 mb-4 text-gray-400 font-black text-[9px] uppercase tracking-widest">
                            <Clock className="w-4 h-4" />
                            Horodatage & Lieu
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center bg-gray-50/50 p-2.5 rounded-xl">
                                <span className="text-[10px] font-bold text-gray-400 uppercase">Précis</span>
                                <span className="text-[11px] font-black text-gray-900">
                                    {new Date(log.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                </span>
                            </div>
                            <div className="flex justify-between items-center bg-gray-50/50 p-2.5 rounded-xl">
                                <span className="text-[10px] font-bold text-gray-400 uppercase">Heure</span>
                                <span className="text-[11px] font-black text-gray-900">
                                    {new Date(log.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                            </div>
                            <div className="flex justify-between items-center bg-gray-50/50 p-2.5 rounded-xl">
                                <span className="text-[10px] font-bold text-gray-400 uppercase">Site</span>
                                <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest italic">{log.site || "Global"}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Specific views for delete actions */}
                {log.action_type === 'DELETE' && (
                    <div className="bg-red-50/50 p-6 rounded-[2rem] border border-red-100">
                        <div className="flex items-center gap-2 mb-4 text-red-600 font-black text-[10px] uppercase tracking-widest">
                            <AlertCircle className="w-4 h-4" />
                            Détails de la suppression
                        </div>
                        {log.entity_type === 'PRODUCT' ? (
                            <div className="flex justify-between items-center p-4 bg-white rounded-2xl shadow-sm border border-red-50">
                                <div>
                                    <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Stock au moment du retrait</p>
                                    <p className="text-3xl font-black text-red-600 tabular-nums">{d.stock || 0}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Produit concerné</p>
                                    <p className="text-sm font-black text-gray-900">{d.name || 'N/A'}</p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm font-bold text-gray-600 italic">Suppression d'un élément de type {log.entity_type}</p>
                        )}
                    </div>
                )}

                {/* Raw JSON */}
                <details className="group/raw">
                    <summary className="cursor-pointer list-none">
                        <div className="flex items-center gap-2 text-[9px] font-black text-gray-300 hover:text-gray-500 uppercase tracking-widest transition-colors py-2">
                            <span>Voir les données techniques (JSON)</span>
                            <ChevronUp className="w-3 h-3 group-open/raw:rotate-180 transition-transform" />
                        </div>
                    </summary>
                    <div className="bg-gray-100/50 rounded-[2rem] p-6 border border-gray-200 overflow-hidden mt-2">
                        <pre className="text-[10px] font-mono text-gray-600 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-48 no-scrollbar scroll-smooth">
                            {JSON.stringify(d, null, 4)}
                        </pre>
                    </div>
                </details>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Filter Bar */}
            <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Opérateur</label>
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 group-focus-within:text-brand-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Nom..."
                                value={nameFilter}
                                onChange={(e) => setNameFilter(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-transparent rounded-xl text-xs font-bold focus:bg-white focus:border-brand-200 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Date</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
                            <input
                                type="date"
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-transparent rounded-xl text-xs font-bold focus:bg-white focus:border-brand-200 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Site</label>
                        <div className="flex bg-gray-50 p-1 rounded-xl border border-transparent focus-within:border-brand-100">
                            {['ALL', 'ABIDJAN', 'BASSAM'].map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setSiteFilter(s)}
                                    className={clsx(
                                        "flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                                        siteFilter === s ? "bg-white text-brand-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                                    )}
                                >
                                    {s === 'ALL' ? 'Tous' : s}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-end">
                        <button
                            onClick={resetFilters}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-brand-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-transparent"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Reset
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-gray-50">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mr-2">Action:</span>
                    <button
                        onClick={() => setActionFilter('ALL')}
                        className={clsx(
                            "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border",
                            actionFilter === 'ALL' ? "bg-brand-900 text-white shadow-lg shadow-brand-100" : "bg-white text-gray-400 border-gray-100 hover:border-brand-200"
                        )}
                    >
                        Tout
                    </button>
                    {[
                        { id: 'CREATE', label: 'Ajout', icon: <Plus className="w-3 h-3" /> },
                        { id: 'UPDATE', label: 'Modif', icon: <Edit2 className="w-3 h-3" /> },
                        { id: 'DELETE', label: 'Suppr', icon: <Trash2 className="w-3 h-3" /> },
                        { id: 'LOGIN', label: 'Connex', icon: <User className="w-3 h-3" /> },
                    ].map((type) => (
                        <button
                            key={type.id}
                            onClick={() => setActionFilter(type.id)}
                            className={clsx(
                                "flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border",
                                actionFilter === type.id ? "bg-brand-600 text-white shadow-lg" : "bg-white text-gray-400 border-gray-100 hover:border-brand-200"
                            )}
                        >
                            {type.icon} {type.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center p-20">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-brand-100 border-t-brand-600 rounded-full animate-spin"></div>
                        <Database className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-brand-600 animate-pulse" />
                    </div>
                </div>
            ) : error ? (
                <div className="bg-red-50 border-2 border-dashed border-red-200 rounded-[3rem] p-12 text-center">
                    <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-6" />
                    <h3 className="text-2xl font-black text-red-900 mb-3 tracking-tight uppercase">Base de données incomplète</h3>
                    <p className="text-red-700 font-medium mb-6 max-w-md mx-auto">{error}</p>
                </div>
            ) : logs.length === 0 ? (
                <div className="bg-gray-50/50 border-2 border-dashed border-gray-100 rounded-[3rem] p-20 text-center">
                    <Search className="w-10 h-10 text-gray-200 mx-auto mb-6 opacity-30" />
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-sm italic">Aucun log trouvé</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {logs.map((log) => {
                        const isExpanded = expandedLogs[log.id];
                        const isDelete = log.action_type === 'DELETE';
                        return (
                            <div
                                key={log.id}
                                onClick={(e) => toggleExpand(log.id, e)}
                                className={clsx(
                                    "bg-white rounded-[2.5rem] border transition-all duration-500 cursor-pointer overflow-hidden shadow-sm",
                                    isExpanded ? "ring-4 ring-brand-100 border-brand-200 p-8" : "border-gray-100 hover:shadow-xl p-6"
                                )}
                            >
                                <div className="flex flex-col sm:flex-row gap-6 items-start">
                                    <div className={clsx(
                                        "shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm",
                                        isDelete ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-600"
                                    )}>
                                        {getActionIcon(log.action_type)}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                            <h4 className="text-base font-black text-gray-900 uppercase">{log.user_name}</h4>
                                            <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                                {log.site || 'Global'}
                                            </span>
                                        </div>
                                        <p className="text-sm font-bold text-gray-600 mb-2 truncate">{getLogSummary(log)}</p>
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest text-brand-500">
                                                {getEntityIcon(log.entity_type)} {log.action_type}
                                            </div>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                                                • {log.entity_type}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-row sm:flex-col items-center sm:items-end gap-3 self-stretch sm:self-auto w-full sm:w-auto">
                                        <div className="text-right">
                                            <p className="text-xs font-black text-gray-900">
                                                {new Date(log.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">
                                                {new Date(log.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                                            </p>
                                        </div>
                                        <button className="w-8 h-8 rounded-full border flex items-center justify-center text-gray-400 shadow-sm ml-auto">
                                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                {isExpanded && renderDetails(log)}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
