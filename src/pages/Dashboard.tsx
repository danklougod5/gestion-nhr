import { useState, useEffect } from 'react';
import { Package, TrendingUp, AlertTriangle, CheckCircle, Clock, ChevronRight, ArrowDownRight, ArrowUpRight, BarChart3, Star, Layers, Zap, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import type { Site } from '../types';
import clsx from 'clsx';

export default function Dashboard() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const [selectedSite, setSelectedSite] = useState<Site>('abidjan');
    const [topMovingProducts, setTopMovingProducts] = useState<any[]>([]);
    const [mostUsedProducts, setMostUsedProducts] = useState<any[]>([]);
    const [stats, setStats] = useState([
        { name: 'Total Produits', value: '0', path: '/sites', icon: Package, color: 'text-brand-600', bg: 'bg-brand-50', trend: 'Catalogue Actif' },
        { name: 'Bons en attente', value: '0', path: '/needs', icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50', trend: 'Flux de sortie' },
        { name: 'Alertes Stock', value: '0', path: '/sites', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', trend: 'Stock optimal' },
        { name: 'Livraisons du jour', value: '0', path: '/purchases', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', trend: 'Entrées stock' },
    ]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (profile) {
            setSelectedSite(profile.site);
        }
    }, [profile]);

    useEffect(() => {
        fetchStats();
    }, [profile, selectedSite]);

    const fetchStats = async () => {
        try {
            setLoading(true);

            // 0. Time boundaries
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            // 1. Fetch Products
            let prodQuery = supabase
                .from('products')
                .select('*')
                .neq('category', 'ARCHIVED');

            if (selectedSite !== 'both') {
                prodQuery = prodQuery.or(`site.eq.${selectedSite},site.eq.both`);
            }

            const { data: products, error: prodError } = await prodQuery;
            if (prodError) throw prodError;

            // 2. Fetch Movements for Top Products (Last 30 days)
            // Fix: Use created_at instead of date
            const { data: movements, error: moveError } = await supabase
                .from('stock_movements')
                .select('product_id, quantity, type, created_at')
                .eq('site', selectedSite)
                .gte('created_at', thirtyDaysAgo.toISOString());

            if (moveError) throw moveError;

            // 3. Fetch Counters for today
            // Bons du jour
            const { count: pendingCount } = await supabase
                .from('needs_requests')
                .select('*', { count: 'exact', head: true })
                .eq('site', selectedSite)
                .gte('created_at', today.toISOString());

            // Livraisons du jour (IN)
            const { count: deliveryCount } = await supabase
                .from('stock_movements')
                .select('*', { count: 'exact', head: true })
                .eq('type', 'IN')
                .eq('site', selectedSite)
                .gte('created_at', today.toISOString());

            if (products) {
                const activeProducts = products.filter(p => !p.name.startsWith('ARCHIVED -'));
                const total = activeProducts.length;
                let alerts = 0;

                activeProducts.forEach(p => {
                    const stock = selectedSite === 'bassam' ? p.stock_bassam :
                        selectedSite === 'abidjan' ? p.stock_abidjan :
                            (p.stock_abidjan + p.stock_bassam);

                    if (stock <= p.min_threshold) {
                        alerts++;
                    }
                });

                // Calculate Top Moving Products (OUT movements)
                const movementStats = movements || [];
                const productAggregates: Record<string, { totalOut: number, count: number }> = {};

                movementStats.forEach(m => {
                    if (m.type === 'OUT') {
                        if (!productAggregates[m.product_id]) {
                            productAggregates[m.product_id] = { totalOut: 0, count: 0 };
                        }
                        productAggregates[m.product_id].totalOut += Math.abs(m.quantity);
                        productAggregates[m.product_id].count += 1;
                    }
                });

                const topMoving = Object.entries(productAggregates)
                    .map(([id, stats]) => {
                        const product = activeProducts.find(p => p.id === id);
                        return {
                            id,
                            name: product?.name || 'Produit inconnu',
                            category: product?.category || 'N/A',
                            totalValue: stats.totalOut,
                            count: stats.count
                        };
                    })
                    .filter(p => p.name !== 'Produit inconnu')
                    .sort((a, b) => b.totalValue - a.totalValue)
                    .slice(0, 5);

                const topUsed = [...Object.entries(productAggregates)]
                    .map(([id, stats]) => {
                        const product = activeProducts.find(p => p.id === id);
                        return {
                            id,
                            name: product?.name || 'Produit inconnu',
                            category: product?.category || 'N/A',
                            totalValue: stats.totalOut,
                            count: stats.count
                        };
                    })
                    .filter(p => p.name !== 'Produit inconnu')
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 5);

                setTopMovingProducts(topMoving);
                setMostUsedProducts(topUsed);

                // Update Stats with Real Data
                setStats([
                    { name: 'Total Produits', value: total.toString(), path: '/sites', icon: Package, color: 'text-brand-600', bg: 'bg-brand-50', trend: 'Catalogue Actif' },
                    { name: 'Bons du Jour', value: (pendingCount || 0).toString(), path: '/needs', icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50', trend: 'Flux de sortie' },
                    { name: 'Alertes Stock', value: alerts.toString(), path: '/sites', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', trend: alerts > 0 ? `${alerts} à réapprov.` : 'Stock optimal' },
                    { name: 'Livraisons Jour', value: (deliveryCount || 0).toString(), path: '/purchases', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', trend: 'Entrées stock' },
                ]);
            }
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="space-y-6 sm:space-y-10 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight flex items-baseline gap-2 sm:gap-3">
                        Bonjour, <span className="brand-text-gradient">{profile?.full_name?.split(' ')[0]}</span>
                        <span className="text-xl sm:text-2xl animate-bounce">👋</span>
                    </h1>
                    <p className="text-gray-400 font-medium text-base sm:text-lg mt-1 sm:mt-2">Suivi analytique du stock pour <span className="text-gray-600 font-bold uppercase">{selectedSite}</span></p>
                </div>

                <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                    <button
                        onClick={fetchStats}
                        disabled={loading}
                        className="p-2 sm:p-2.5 bg-white/50 backdrop-blur-md rounded-xl sm:rounded-[1.25rem] border border-gray-100 text-gray-400 hover:text-brand-600 hover:bg-white transition-all shadow-sm group"
                        title="Rafraîchir les données"
                    >
                        <RefreshCw className={clsx("w-4 h-4 sm:w-5 h-5", loading && "animate-spin")} />
                    </button>

                    {profile?.role === 'admin' && (
                        <div className="flex bg-white/50 backdrop-blur-md p-1 sm:p-1.5 rounded-[1.25rem] sm:rounded-[1.5rem] shadow-sm border border-gray-100 w-full sm:w-auto">
                            {['abidjan', 'bassam'].map((site) => (
                                <button
                                    key={site}
                                    onClick={() => setSelectedSite(site as Site)}
                                    className={clsx(
                                        "flex-1 sm:flex-initial px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-[0.1em] sm:tracking-[0.15em] transition-all duration-500",
                                        selectedSite === site
                                            ? "bg-brand-600 text-white shadow-xl shadow-brand-100 scale-105"
                                            : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                                    )}
                                >
                                    {site}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-48 bg-white/50 animate-pulse rounded-[2.5rem] border border-gray-100" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8">
                    {stats.map((item, idx) => (
                        <div
                            key={item.name}
                            onClick={() => navigate((item as any).path || '/')}
                            className={clsx(
                                "premium-card group relative overflow-hidden flex flex-col justify-between min-h-[180px] sm:min-h-[220px] !p-6 sm:!p-8 cursor-pointer hover:shadow-2xl hover:shadow-brand-100 transition-all",
                                idx === 0 && "lg:scale-105 ring-4 ring-brand-50 lg:z-10 bg-white"
                            )}
                        >
                            <div className="absolute -top-6 -right-6 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-700 group-hover:scale-150 rotate-12">
                                <item.icon className="w-24 h-24 sm:w-32 sm:h-32" />
                            </div>

                            <div className="flex justify-between items-start">
                                <div className={clsx(
                                    "w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all duration-500 shadow-sm group-hover:shadow-md group-hover:-translate-y-1",
                                    item.bg
                                )}>
                                    <item.icon className={clsx("w-6 h-6 sm:w-7 h-7", item.color)} />
                                </div>
                                <span className={clsx(
                                    "text-[8px] sm:text-[10px] font-black px-2 sm:px-3 py-1 rounded-full uppercase tracking-tighter",
                                    item.bg, item.color
                                )}>
                                    {item.trend}
                                </span>
                            </div>

                            <div className="mt-4 sm:mt-0">
                                <h3 className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-[0.15em] sm:tracking-[0.2em] mb-1">{item.name}</h3>
                                <p className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tighter tabular-nums">
                                    {item.value}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Top Analysis Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                {/* Top Sorties (Quantité) */}
                <div className="premium-card !p-6 sm:!p-8">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-2.5 bg-brand-50 rounded-xl">
                            <ArrowDownRight className="w-5 h-5 text-brand-600" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-gray-900 uppercase">Top Sorties</h3>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Par volume consommé (30j)</p>
                        </div>
                    </div>

                    <div className="space-y-5">
                        {topMovingProducts.length === 0 ? (
                            <p className="text-center py-10 text-xs font-bold text-gray-300 uppercase tracking-widest italic">Aucune donnée</p>
                        ) : topMovingProducts.map((prod, i) => (
                            <div key={prod.id} className="flex items-center gap-4 group cursor-default">
                                <div className="text-xl font-black text-gray-200 group-hover:text-brand-200 transition-colors w-6">0{i + 1}</div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-black text-gray-900 truncate uppercase mt-0.5">{prod.name}</div>
                                    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">{prod.category}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-black text-brand-600 tabular-nums">-{prod.totalValue}</div>
                                    <div className="text-[8px] font-black text-gray-300 uppercase">Unités</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Produits Fréquents */}
                <div className="premium-card !p-6 sm:!p-8">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-2.5 bg-orange-50 rounded-xl">
                            <Zap className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-gray-900 uppercase">Plus Fréquents</h3>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Fréquence d'utilisation (30j)</p>
                        </div>
                    </div>

                    <div className="space-y-5">
                        {mostUsedProducts.length === 0 ? (
                            <p className="text-center py-10 text-xs font-bold text-gray-300 uppercase tracking-widest italic">Aucune donnée</p>
                        ) : mostUsedProducts.map((prod, i) => (
                            <div key={prod.id} className="flex items-center gap-4 group cursor-default">
                                <div className="w-8 h-8 rounded-full border-2 border-orange-50 flex items-center justify-center text-[10px] font-black text-orange-400 group-hover:bg-orange-50 transition-all">{prod.count}x</div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-black text-gray-900 truncate uppercase mt-0.5">{prod.name}</div>
                                    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">{prod.category}</div>
                                </div>
                                <div className="p-2 bg-gray-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                                    <ChevronRight className="w-3 h-3 text-gray-400" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Suggestions pour Dashboard Complet */}
                <div className="premium-card bg-gray-900 border-none !p-6 sm:!p-8 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2.5 bg-white/10 rounded-xl">
                                <BarChart3 className="w-5 h-5 text-brand-400" />
                            </div>
                            <h3 className="text-base font-black text-white uppercase tracking-tight">Suggestions NHR</h3>
                        </div>
                        <div className="space-y-4">
                            {[
                                { title: "Valorisation Stock", desc: "Suivi de la valeur financière totale", icon: Layers },
                                { title: "Top Fournisseurs", desc: "Analyse des livraisons par acteur", icon: Star },
                                { title: "Taux de Rupture", desc: "Produits en manque vs demande", icon: AlertTriangle }
                            ].map((s, idx) => (
                                <div key={idx} className="flex gap-4 p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-help">
                                    <s.icon className="w-4 h-4 text-brand-400 shrink-0" />
                                    <div>
                                        <div className="text-[11px] font-black text-white uppercase">{s.title}</div>
                                        <div className="text-[9px] font-medium text-gray-400 leading-tight mt-0.5">{s.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <button onClick={() => navigate('/sites')} className="w-full py-4 mt-6 bg-brand-600 text-white font-black rounded-xl hover:bg-brand-500 transition-all uppercase text-[10px] tracking-widest">
                        Optimiser le stock
                    </button>
                </div>
            </div>
        </div>
    );
}
