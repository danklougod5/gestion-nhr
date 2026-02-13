// Update Layout navigation
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, PackagePlus, LogOut, Menu, X, ShoppingCart, Settings as SettingsIcon } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import clsx from 'clsx';
import toast from 'react-hot-toast';

export default function Layout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const { profile } = useAuth();

    const navigation = [
        { name: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Mes Besoins', href: '/needs', icon: ClipboardList },
        { name: 'Inventaire', href: '/sites', icon: PackagePlus },
        { name: 'Achats (Entrées)', href: '/purchases', icon: ShoppingCart },
        {
            name: (profile?.role === 'admin' || profile?.permissions?.manage_users) ? 'Paramètres' : 'Mon Profil',
            href: '/settings',
            icon: SettingsIcon
        },
    ];

    const handleLogout = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            toast.success('Déconnecté');
            navigate('/login');
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex font-['Outfit']">
            {/* Mobile sidebar backdrop */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-gray-900/40 backdrop-blur-sm lg:hidden transition-all duration-300"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={clsx(
                "fixed inset-y-0 left-0 z-50 w-80 sm:w-72 bg-[#0F172A] border-r border-white/5 transform transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen",
                isSidebarOpen ? "translate-x-0" : "-translate-x-full shadow-none"
            )}>
                <div className="flex flex-col h-full">
                    {/* Logo Section */}
                    <div className="flex items-center justify-between h-28 px-10">
                        <div className="flex items-center gap-4 group cursor-pointer">
                            <div className="w-12 h-12 bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl shadow-xl shadow-brand-200 flex items-center justify-center group-hover:rotate-12 transition-all duration-500">
                                <PackagePlus className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex flex-col">
                                <h1 className="text-xl font-black text-white tracking-tight leading-none uppercase">NHR</h1>
                                <span className="text-[10px] font-bold text-brand-400 tracking-[0.3em] uppercase opacity-80">Gestion</span>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsSidebarOpen(false)}
                            className="lg:hidden p-2.5 bg-gray-50 text-gray-400 hover:text-gray-900 rounded-xl transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-6 py-4 space-y-2 overflow-y-auto custom-scrollbar-dark">
                        <div className="px-4 mb-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Menu Principal</div>
                        {navigation.map((item) => {
                            const Icon = item.icon;
                            const isActive = location.pathname.startsWith(item.href);
                            return (
                                <Link
                                    key={item.name}
                                    to={item.href}
                                    onClick={() => setIsSidebarOpen(false)}
                                    className={clsx(
                                        "flex items-center px-4 py-4 rounded-[1.25rem] transition-all duration-300 group relative overflow-hidden mb-1",
                                        isActive
                                            ? "bg-brand-500/10 text-white shadow-sm"
                                            : "text-slate-400 hover:bg-white/5 hover:text-white"
                                    )}
                                >
                                    {isActive && (
                                        <div className="absolute left-0 w-1.5 h-6 bg-brand-600 rounded-r-full" />
                                    )}
                                    <Icon className={clsx(
                                        "w-5 h-5 mr-4 transition-all duration-500",
                                        isActive ? "text-brand-600 scale-110" : "group-hover:text-brand-500 group-hover:scale-110"
                                    )} />
                                    <span className={clsx(
                                        "text-sm font-bold tracking-tight transition-all",
                                        isActive ? "translate-x-1" : "group-hover:translate-x-1"
                                    )}>{item.name}</span>

                                    {isActive && (
                                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-500 shadow-[0_0_12px_rgba(14,165,233,0.5)]" />
                                    )}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Footer Section */}
                    <div className="p-8 space-y-6">
                        {profile && (
                            <div className="p-5 bg-white/5 rounded-[2rem] border border-white/5 shadow-sm transition-all hover:bg-white/10 group">
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <div className="h-14 w-14 rounded-2xl bg-brand-500/20 flex items-center justify-center text-brand-400 font-black text-xl border border-white/10 shadow-sm italic group-hover:scale-110 transition-transform duration-500">
                                            {profile.full_name?.[0] || 'U'}
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-[#0F172A] rounded-full" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-black text-white truncate tracking-tight">{profile.full_name}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="px-2 py-0.5 bg-brand-500/20 text-brand-400 text-[9px] font-black uppercase rounded-full tracking-widest">{profile.role}</span>
                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">{profile.site}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <button
                            onClick={handleLogout}
                            className="flex items-center w-full px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-2xl transition-all duration-300 group"
                        >
                            <LogOut className="w-5 h-5 mr-4 group-hover:-translate-x-1 transition-transform" />
                            Déconnexion
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                <header className="bg-white/70 backdrop-blur-md border-b border-gray-100/50 lg:hidden sticky top-0 z-30">
                    <div className="flex items-center justify-between h-20 px-6">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="p-2 bg-gray-50 text-gray-600 rounded-xl hover:bg-white hover:shadow-sm transition-all"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
                                <PackagePlus className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-lg font-black tracking-tighter text-gray-900">NHR GESTION</span>
                        </div>
                        <div className="w-10" />
                    </div>
                </header>

                <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-10 xl:p-14 transition-all duration-500">
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
