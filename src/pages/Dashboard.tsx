import { useState, useEffect } from 'react';
import { Package, TrendingUp, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { Site } from '../types';
import clsx from 'clsx';

export default function Dashboard() {
    const { profile } = useAuth();
    const [selectedSite, setSelectedSite] = useState<Site>('abidjan');
    const [stats, setStats] = useState([
        { name: 'Total Produits', value: '0', icon: Package, color: 'text-brand-600', bg: 'bg-brand-50', trend: '+12% ce mois' },
        { name: 'Bons en attente', value: '0', icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50', trend: 'Action requise' },
        { name: 'Alertes Stock', value: '0', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', trend: 'Urgences' },
        { name: 'Livraisons du jour', value: '0', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', trend: 'Terminé' },
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
            const { data: products, error } = await supabase
                .from('products')
                .select('*')
                .eq('site', selectedSite)
                .neq('category', 'ARCHIVED');

            if (error) throw error;

            if (products) {
                // Filtrer aussi par nom au cas où l'archivage est partiel
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

                setStats([
                    { name: 'Total Produits', value: total.toString(), icon: Package, color: 'text-brand-600', bg: 'bg-brand-50', trend: 'Catalogue Actif' },
                    { name: 'Bons en attente', value: '0', icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50', trend: 'Flux de sortie' },
                    { name: 'Alertes Stock', value: alerts.toString(), icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', trend: alerts > 0 ? `${alerts} à réapprov.` : 'Stock optimal' },
                    { name: 'Livraisons du jour', value: '0', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', trend: 'Entrées stock' },
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
                    <p className="text-gray-400 font-medium text-base sm:text-lg mt-1 sm:mt-2">Voici l'état actuel du stock à <span className="text-gray-600 font-bold uppercase">{selectedSite}</span></p>
                </div>

                <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
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
                    {/* Bento Grid Stats */}
                    {stats.map((item, idx) => (
                        <div
                            key={item.name}
                            className={clsx(
                                "premium-card group relative overflow-hidden flex flex-col justify-between min-h-[180px] sm:min-h-[220px] !p-6 sm:!p-8",
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

            {/* Bottom Section: Activity & Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                <div className="lg:col-span-2 premium-card !p-6 sm:!p-8">
                    <div className="flex items-center justify-between mb-6 sm:mb-8">
                        <h3 className="text-lg sm:text-xl font-black text-gray-900 flex items-center gap-2 sm:gap-3">
                            <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-brand-600" />
                            Activité Récente
                        </h3>
                        <button className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-brand-600 hover:text-brand-700 transition-colors">Voir tout</button>
                    </div>
                    <div className="space-y-4 sm:space-y-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl hover:bg-gray-50 transition-colors cursor-pointer border border-transparent hover:border-gray-100">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded-lg sm:rounded-xl flex items-center justify-center text-gray-400">
                                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                                </div>
                                <div className="flex-1">
                                    <div className="h-3.5 sm:h-4 w-1/3 bg-gray-100 rounded mb-1.5 sm:mb-2" />
                                    <div className="h-2.5 sm:h-3 w-1/2 bg-gray-50 rounded" />
                                </div>
                                <div className="text-right">
                                    <div className="h-3.5 sm:h-4 w-12 sm:w-16 bg-gray-100 rounded mb-1.5 sm:mb-2 ml-auto" />
                                    <div className="h-2.5 sm:h-3 w-10 sm:w-12 bg-gray-50 rounded ml-auto" />
                                </div>
                            </div>
                        ))}
                        <div className="text-center py-4">
                            <p className="text-sm font-medium text-gray-400 italic">Mise à jour en temps réel activée...</p>
                        </div>
                    </div>
                </div>

                <div className="premium-card bg-brand-600 border-none relative overflow-hidden group !p-8 sm:!p-10 min-h-[250px] sm:min-h-auto flex flex-col justify-between">
                    <div className="absolute top-0 right-0 w-48 h-48 sm:w-64 sm:h-64 bg-white/10 rounded-full -mr-24 -mt-24 sm:-mr-32 sm:-mt-32 blur-2xl sm:blur-3xl group-hover:scale-110 transition-transform duration-700" />
                    <div className="relative z-10 flex flex-col h-full justify-between text-white">
                        <div>
                            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 backdrop-blur-md rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-6">
                                <Package className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                            </div>
                            <h3 className="text-xl sm:text-2xl font-black mb-2 tracking-tight">Nouvelle Commande</h3>
                            <p className="text-brand-100 text-xs sm:text-sm font-medium leading-relaxed">
                                Enregistrez une nouvelle entrée de stock ou créez un bon de sortie rapidement.
                            </p>
                        </div>
                        <button
                            onClick={() => window.location.href = '/needs'}
                            className="w-full py-3 sm:py-4 mt-6 bg-white text-brand-600 font-black rounded-xl sm:rounded-2xl hover:bg-brand-50 transition-all shadow-xl shadow-brand-900/20 active:scale-95 uppercase text-[10px] sm:text-xs tracking-widest"
                        >
                            Commencer
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
