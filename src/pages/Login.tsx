
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { session } = useAuth();

    useEffect(() => {
        if (session) {
            navigate('/dashboard');
        }
    }, [session, navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // Convert username to a virtual email format for Supabase Auth
        // If the user entered an email, use it as is, otherwise append @nhr.com
        const email = username.includes('@') ? username : `${username.toLowerCase().trim()}@nhr.com`;

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            toast.success('Connexion réussie');
            navigate('/dashboard');
        } catch (error: any) {
            console.error(error);
            toast.error(error.message === 'Invalid login credentials' ? 'Nom ou mot de passe incorrect' : error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 sm:p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-brand-50 via-white to-gray-50">
            <div className="max-w-md w-full bg-white rounded-[2rem] sm:rounded-[3rem] shadow-2xl overflow-hidden border border-white/50 relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-100 rounded-full blur-3xl opacity-30 -translate-y-1/2 translate-x-1/2"></div>

                <div className="bg-brand-600 p-8 sm:p-12 text-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-500 to-brand-800"></div>
                    <div className="relative z-10">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/10 backdrop-blur-md rounded-xl sm:rounded-2xl mx-auto mb-4 sm:mb-6 flex items-center justify-center border border-white/20">
                            <Lock className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-black text-white mb-2 tracking-tighter">NHR GESTION</h1>
                        <p className="text-brand-100 text-[10px] sm:text-xs font-black uppercase tracking-[0.3em]">Portail Sécurisé</p>
                    </div>
                </div>

                <form onSubmit={handleLogin} className="p-8 sm:p-10 space-y-6 sm:space-y-8 relative">
                    <div className="space-y-1.5 sm:space-y-2">
                        <label className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Utilisateur</label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-500 transition-colors">
                                <User className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full pl-11 sm:pl-12 pr-4 py-3.5 sm:py-4 bg-gray-50 border border-gray-100 rounded-xl sm:rounded-2xl focus:ring-4 focus:ring-brand-100 focus:bg-white outline-none transition-all font-bold text-gray-900 text-sm sm:text-base"
                                placeholder="votre_nom"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5 sm:space-y-2">
                        <label className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Mot de passe</label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-500 transition-colors">
                                <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-11 sm:pl-12 pr-4 py-3.5 sm:py-4 bg-gray-50 border border-gray-100 rounded-xl sm:rounded-2xl focus:ring-4 focus:ring-brand-100 focus:bg-white outline-none transition-all font-bold text-gray-900 text-base sm:text-lg"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 sm:py-5 bg-brand-600 text-white rounded-[1.5rem] sm:rounded-[2rem] hover:bg-brand-700 transition-all shadow-xl sm:shadow-2xl shadow-brand-200 flex items-center justify-center font-black text-base sm:text-lg disabled:opacity-50 transform active:scale-95 uppercase tracking-widest"
                    >
                        {loading ? 'Authentification...' : 'Se Connecter'}
                    </button>

                    <div className="pt-2 sm:pt-4 text-center">
                        <p className="text-[8px] sm:text-[9px] text-gray-300 font-bold uppercase tracking-[0.2em]">
                            © 2024 NHR RESORTS • TOUS DROITS RÉSERVÉS
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
}
