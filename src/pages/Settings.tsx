
import React, { useState, useEffect } from 'react';
import { UserPlus, Shield, Check, X, Save, Trash2, User, MapPin, Key, Lock, LayoutGrid, Edit2, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { User as UserType, UserRole, UserPermissions, Site } from '../types';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { AuditLogView } from '../components/AuditLogView';
import { logAudit } from '../lib/audit';
import clsx from 'clsx';

const DEFAULT_PERMISSIONS: UserPermissions = {
    view_inventory: true,
    view_all_sites_stock: false,
    edit_inventory: false,
    view_needs: true,
    view_full_needs_history: false,
    create_needs: true,
    edit_needs: false,
    delete_needs: false,
    view_purchases: false,
    manage_users: false,
    view_stock_history: false,
    manage_categories: false,
};

const ROLE_PERMISSIONS: Record<UserRole, UserPermissions> = {
    admin: {
        view_inventory: true,
        view_all_sites_stock: true,
        edit_inventory: true,
        view_needs: true,
        view_full_needs_history: true,
        create_needs: true,
        edit_needs: true,
        delete_needs: true,
        view_purchases: true,
        manage_users: true,
        view_stock_history: true,
        manage_categories: true,
    },
    gouvernante: {
        view_inventory: true,
        view_all_sites_stock: true,
        edit_inventory: true,
        view_needs: true,
        view_full_needs_history: true,
        create_needs: true,
        edit_needs: true,
        delete_needs: true,
        view_purchases: true,
        manage_users: false,
        view_stock_history: true,
        manage_categories: true,
    },
    service: {
        view_inventory: true,
        view_all_sites_stock: false,
        edit_inventory: false,
        view_needs: true,
        view_full_needs_history: false,
        create_needs: true,
        edit_needs: true,
        delete_needs: false,
        view_purchases: false,
        manage_users: false,
        view_stock_history: false,
        manage_categories: false,
    },
};

const PERMISSION_LABELS: Record<keyof UserPermissions, { label: string; description: string }> = {
    view_inventory: { label: 'Voir le stock local', description: "Consulter l'état des produits du site actuel." },
    view_all_sites_stock: { label: 'Voir tous les sites', description: "Consulter le stock d'Abidjan et Bassam simultanément." },
    edit_inventory: { label: 'Modifier le stock', description: 'Ajouter, modifier ou supprimer des articles.' },
    view_needs: { label: 'Voir besoins du jour', description: 'Consulter uniquement les demandes de la journée.' },
    view_full_needs_history: { label: "Historique complet", description: "Accéder à l'historique complet des demandes passées." },
    create_needs: { label: 'Créer des besoins', description: 'Générer de nouveaux bons de sortie.' },
    edit_needs: { label: 'Modifier les bons', description: 'Modifier un bon de sortie déjà validé (réajuster stock).' },
    delete_needs: { label: 'Supprimer les bons', description: 'Supprimer un bon et annuler le mouvement de stock.' },
    view_purchases: { label: 'Voir les achats', description: "Accéder à l'historique des achats effectués." },
    manage_users: { label: 'Gérer les utilisateurs', description: 'Contrôler les accès et rôles de l’équipe.' },
    view_stock_history: { label: 'Voir la chronologie', description: "Autoriser l'accès au journal des mouvements de stock." },
    manage_categories: { label: 'Ajouter les catégories', description: "Gérer la liste des catégories de produits disponibles." },
};

export default function Settings() {
    const { profile } = useAuth();
    const [users, setUsers] = useState<UserType[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingUser, setEditingUser] = useState<UserType | null>(null);

    // Password change states
    const [newPass, setNewPass] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [isChangingPass, setIsChangingPass] = useState(false);

    // Form state
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newName, setNewName] = useState('');
    const [newRole, setNewRole] = useState<UserRole>('service');
    const [newSite, setNewSite] = useState<Site>('abidjan');
    const [newPermissions, setNewPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);

    // Edit form state
    const [editName, setEditName] = useState('');
    const [editRole, setEditRole] = useState<UserRole>('service');
    const [editSite, setEditSite] = useState<Site>('abidjan');
    const [editPassword, setEditPassword] = useState('');
    const [editPermissions, setEditPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);
    const [activeAdminTab, setActiveAdminTab] = useState<'users' | 'audit' | 'categories'>('users');
    const [selectedSiteFilter, setSelectedSiteFilter] = useState<Site | 'all'>('all');

    // Categories management state
    const [categories, setCategories] = useState<{ id: string, name: string }[]>([]);
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [categorySearch, setCategorySearch] = useState('');
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [editingCategoryName, setEditingCategoryName] = useState('');
    const [isUpdatingCategory, setIsUpdatingCategory] = useState(false);

    useEffect(() => {
        if (profile?.role === 'admin' || profile?.permissions?.manage_users || profile?.permissions?.manage_categories) {
            fetchUsers();
            fetchCategories();
        }
    }, [profile]);

    const fetchCategories = async () => {
        try {
            const { data, error } = await supabase
                .from('categories')
                .select('*')
                .order('name', { ascending: true });
            if (error) throw error;
            setCategories(data || []);
        } catch (error: any) {
            console.error('Error fetching categories:', error);
        }
    };

    const handleBulkDeleteCategories = async () => {
        if (selectedCategoryIds.length === 0) return;
        const count = selectedCategoryIds.length;
        const confirmStr = `Souhaitez-vous supprimer les ${count} catégories sélectionnées ?\n\nNote : Les produits existants conserveront leur catégorie actuelle mais celle-ci ne figurera plus dans le catalogue.`;
        const reason = window.prompt(`${confirmStr}\n\nMOTIF DE SUPPRESSION :`);

        if (reason === null) return;
        if (!reason.trim()) {
            toast.error("Le motif est obligatoire pour la suppression groupée");
            return;
        }

        try {
            const { error } = await supabase
                .from('categories')
                .delete()
                .in('id', selectedCategoryIds);

            if (error) throw error;

            if (profile) {
                await logAudit({
                    action_type: 'DELETE',
                    entity_type: 'CATEGORY',
                    entity_id: 'BULK_DELETE',
                    reason: `Suppression groupée de ${count} catégories. Motif : ${reason}`,
                    details: {
                        count,
                        deleted_ids: selectedCategoryIds,
                        motive: reason
                    }
                }, profile);
            }

            toast.success(`${count} catégories supprimées`);
            setSelectedCategoryIds([]);
            fetchCategories();
        } catch (error: any) {
            toast.error("Erreur lors de la suppression groupée");
            console.error(error);
        }
    };

    const handleAddCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        const input = newCategoryName.trim();
        if (!input) return;

        // Split by comma or semicolon to allow multiple additions
        const names = input.split(/[,;]+/).map(n => n.trim()).filter(n => n.length > 0);
        if (names.length === 0) return;

        setIsAddingCategory(true);
        try {
            const { error } = await supabase
                .from('categories')
                .insert(names.map(name => ({ name })));

            if (error) throw error;

            if (profile) {
                await logAudit({
                    action_type: 'CREATE',
                    entity_type: 'CATEGORY',
                    entity_id: names.join(', '),
                    reason: names.length > 1 ? `Création groupée de ${names.length} catégories` : "Création d'une nouvelle catégorie",
                    details: { names }
                }, profile);
            }

            toast.success(names.length > 1 ? `${names.length} catégories ajoutées !` : 'Catégorie ajoutée !');
            setNewCategoryName('');
            fetchCategories();
        } catch (error: any) {
            toast.error("Erreur : " + (error.message || "Doublon détecté"));
        } finally {
            setIsAddingCategory(false);
        }
    };

    const handleUpdateCategory = async (id: string, oldName: string) => {
        if (!editingCategoryName.trim() || editingCategoryName.trim() === oldName) {
            setEditingCategoryId(null);
            return;
        }

        setIsUpdatingCategory(true);
        try {
            // 1. Update category name
            const { error: catError } = await supabase
                .from('categories')
                .update({ name: editingCategoryName.trim() })
                .eq('id', id);

            if (catError) throw catError;

            // 2. Update all products using this category
            // This is necessary because category is stored as a string in products
            const { error: prodError } = await supabase
                .from('products')
                .update({ category: editingCategoryName.trim() })
                .eq('category', oldName);

            if (prodError) {
                console.error('Error updating products category:', prodError);
                toast.error("Catégorie renommée, mais certains produits n'ont pas pu être mis à jour.");
            }

            if (profile) {
                await logAudit({
                    action_type: 'UPDATE',
                    entity_type: 'CATEGORY',
                    entity_id: id,
                    reason: `Renommage de catégorie: ${oldName} ➔ ${editingCategoryName.trim()}`,
                    details: {
                        old_name: oldName,
                        new_name: editingCategoryName.trim(),
                        products_updated: !prodError
                    }
                }, profile);
            }

            toast.success('Catégorie mise à jour !');
            setEditingCategoryId(null);
            fetchCategories();
        } catch (error: any) {
            toast.error("Erreur : " + error.message);
        } finally {
            setIsUpdatingCategory(false);
        }
    };

    const handleDeleteCategory = async (id: string, name: string) => {
        const reason = window.prompt(`Supprimer la catégorie "${name}" ?\n\nVEUILLEZ SAISIR LE MOTIF :`);
        if (reason === null) return;
        if (!reason.trim()) {
            toast.error("Motif obligatoire");
            return;
        }

        try {
            const { error } = await supabase
                .from('categories')
                .delete()
                .eq('id', id);

            if (error) throw error;

            if (profile) {
                await logAudit({
                    action_type: 'DELETE',
                    entity_type: 'CATEGORY',
                    entity_id: id,
                    reason: reason.trim(),
                    details: { name, motive: reason.trim() }
                }, profile);
            }

            toast.success('Catégorie supprimée');
            fetchCategories();
        } catch (error: any) {
            toast.error("Erreur : " + error.message);
        }
    };

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) setUsers(data as UserType[]);
        } catch (error: any) {
            console.error('Error fetching users:', error);
            toast.error("Erreur d'affichage : " + (error.message || "Problème de connexion"));
            setUsers([]);
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = (role: UserRole) => {
        setNewRole(role);
        setNewPermissions(ROLE_PERMISSIONS[role]);
    };

    const togglePermission = (key: keyof UserPermissions, isEdit: boolean = false) => {
        if (isEdit) {
            setEditPermissions(prev => ({
                ...prev,
                [key]: !prev[key]
            }));
        } else {
            setNewPermissions(prev => ({
                ...prev,
                [key]: !prev[key]
            }));
        }
    };

    const handleEditClick = (user: UserType) => {
        setEditingUser(user);
        setEditName(user.full_name || '');
        setEditRole(user.role);
        setEditSite(user.site);
        setEditPermissions(user.permissions || ROLE_PERMISSIONS[user.role]);
        setEditPassword('');
        setShowEditModal(true);
    };

    const handleEditRoleChange = (role: UserRole) => {
        setEditRole(role);
        setEditPermissions(ROLE_PERMISSIONS[role]);
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;

        setLoading(true);
        try {
            // Mise à jour des informations du profil
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: editName,
                    role: editRole,
                    site: editSite,
                    permissions: editPermissions
                })
                .eq('id', editingUser.id);

            if (error) throw error;

            // Si un nouveau mot de passe a été saisi par l'admin
            if (editPassword.trim()) {
                if (editPassword.length < 6) {
                    toast.error("Le nouveau mot de passe doit contenir au moins 6 caractères");
                    setLoading(false);
                    return;
                }

                // Appel d'une fonction RPC Supabase (nécessite d'être créée côté DB)
                const { error: rpcError } = await supabase.rpc('admin_update_user_password', {
                    user_id: editingUser.id,
                    new_password: editPassword
                });

                if (rpcError) {
                    console.log("RPC Error:", rpcError);
                    toast.error("Profil mis à jour, mais impossible de modifier le mot de passe. L'Admin doit configurer l'accès RPC.");
                } else {
                    toast.success('Profil et mot de passe mis à jour !');
                }
            } else {
                toast.success('Utilisateur mis à jour avec succès !');
            }

            if (profile) {
                await logAudit({
                    action_type: 'UPDATE',
                    entity_type: 'USER',
                    entity_id: editingUser.id,
                    site: editSite,
                    reason: "Modification du profil utilisateur",
                    details: {
                        username: editingUser.username,
                        full_name: editName,
                        role: editRole,
                        site: editSite,
                        password_changed: !!editPassword.trim()
                    }
                }, profile);
            }

            setShowEditModal(false);
            setEditingUser(null);
            setEditPassword('');
            fetchUsers();
        } catch (error: any) {
            console.error('Error updating user:', error);
            toast.error(error.message || "Erreur lors de la mise à jour");
        } finally {
            setLoading(false);
        }
    };
    const handleDeleteUser = async (user: UserType) => {
        const reason = window.prompt(`Êtes-vous sûr de vouloir supprimer l'utilisateur ${user.full_name || user.username} ?\n\nVEUILLEZ SAISIR LE MOTIF :`);
        if (reason === null) return;
        if (!reason.trim()) {
            toast.error("Motif obligatoire");
            return;
        }

        setLoading(true);
        try {
            // Tentative de suppression complète via RPC (Auth + Profil)
            const { error: rpcError } = await supabase.rpc('delete_user_auth', {
                target_user_id: user.id
            });

            if (rpcError) {
                console.warn('RPC Error (Falling back to profile deletion):', rpcError);
                // Repli sur la suppression de profil simple si l'RPC n'est pas encore installé
                const { error } = await supabase
                    .from('profiles')
                    .delete()
                    .eq('id', user.id);

                if (error) throw error;
            }

            if (profile) {
                await logAudit({
                    action_type: 'DELETE',
                    entity_type: 'USER',
                    entity_id: user.id,
                    site: user.site,
                    reason: reason.trim(),
                    details: {
                        username: user.username,
                        full_name: user.full_name,
                        role: user.role,
                        motive: reason.trim()
                    }
                }, profile);
            }

            toast.success('Utilisateur supprimé avec succès !');
            fetchUsers();
        } catch (error: any) {
            console.error('Error deleting user:', error);
            toast.error(error.message || "Erreur lors de la suppression");
        } finally {
            setLoading(false);
        }
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword.length < 6) {
            toast.error("Le mot de passe doit contenir au moins 6 caractères");
            return;
        }

        setLoading(true);
        const email = `${newUsername.toLowerCase().trim()}@nhr.com`;

        try {
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password: newPassword,
                options: {
                    data: {
                        full_name: newName,
                    }
                }
            });

            if (authError && authError.message !== 'User already registered') throw authError;
            const userId = authData.user?.id || (await supabase.rpc('get_user_id_by_email', { _email: email })).data;

            if (userId) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .upsert({
                        id: userId,
                        username: newUsername.toLowerCase().trim(),
                        email: email,
                        full_name: newName,
                        role: newRole,
                        site: newSite,
                        permissions: newPermissions
                    });

                if (profileError) throw profileError;
            } else if (authError?.message === 'User already registered') {
                toast.error("Cet utilisateur existe déjà dans le système d'authentification.");
                return;
            }

            if (profile) {
                await logAudit({
                    action_type: 'CREATE',
                    entity_type: 'USER',
                    entity_id: userId,
                    site: newSite,
                    reason: "Création d'un nouvel utilisateur",
                    details: {
                        username: newUsername.toLowerCase().trim(),
                        full_name: newName,
                        role: newRole,
                        site: newSite
                    }
                }, profile);
            }

            toast.success('Utilisateur configuré avec succès !');
            setShowAddModal(false);
            fetchUsers();
            setNewUsername('');
            setNewPassword('');
            setNewName('');
        } catch (error: any) {
            console.error('Detailed error:', error);
            toast.error(error.message || "Erreur lors de la création");
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPass !== confirmPass) {
            toast.error("Les nouveaux mots de passe ne correspondent pas");
            return;
        }
        if (newPass.length < 6) {
            toast.error("Le mot de passe doit contenir au moins 6 caractères");
            return;
        }

        setIsChangingPass(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPass
            });
            if (error) throw error;
            toast.success("Mot de passe mis à jour !");
            setNewPass('');
            setConfirmPass('');
        } catch (error: any) {
            toast.error("Erreur : " + error.message);
        } finally {
            setIsChangingPass(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 sm:space-y-12 pb-10 sm:pb-20">
            {/* Section Profil & Mot de passe (Version Compacte) */}
            <div className="bg-white rounded-[2rem] shadow-lg border border-gray-100 overflow-hidden group">
                <div className="grid grid-cols-1 lg:grid-cols-3">
                    {/* Profil Info - Compact */}
                    <div className="lg:col-span-1 bg-brand-900 p-6 sm:p-8 text-white flex flex-col justify-between relative">
                        <div className="relative">
                            <h2 className="text-xl sm:text-2xl font-black tracking-tight mb-2">Mon Profil</h2>
                            <p className="text-brand-300 font-medium text-[10px] sm:text-xs leading-relaxed max-w-[180px]">Gérez vos informations de sécurité.</p>
                        </div>

                        <div className="relative space-y-4 mt-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-brand-400 to-brand-600 rounded-xl flex items-center justify-center text-lg font-black shadow-lg border-2 border-white/10">
                                    {profile?.full_name?.[0] || profile?.username?.[0] || 'U'}
                                </div>
                                <div>
                                    <p className="text-sm sm:text-base font-black leading-none tracking-tight">{profile?.full_name}</p>
                                    <p className="text-[9px] text-brand-400 mt-1 uppercase tracking-widest font-black">@{profile?.username}</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 rounded-lg text-[8px] font-black uppercase tracking-widest text-brand-200 border border-white/5">
                                    <Shield className="w-2.5 h-2.5" /> {profile?.role}
                                </div>
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 rounded-lg text-[8px] font-black uppercase tracking-widest text-brand-200 border border-white/5">
                                    <MapPin className="w-2.5 h-2.5" /> {profile?.site}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Password Change - Compact */}
                    <div className="lg:col-span-2 p-6 sm:p-10">
                        <div className="max-w-sm">
                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-6">
                                <Lock className="w-3.5 h-3.5 text-brand-600" />
                                Sécurité du compte
                            </h3>
                            <form onSubmit={handlePasswordChange} className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="relative group">
                                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-brand-600 transition-colors" />
                                        <input
                                            type="password"
                                            value={newPass}
                                            onChange={(e) => setNewPass(e.target.value)}
                                            placeholder="Nouveau pass"
                                            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-brand-100 outline-none transition-all font-bold text-gray-900 text-xs placeholder:text-gray-400/60"
                                            required
                                        />
                                    </div>
                                    <div className="relative group">
                                        <Check className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-brand-600 transition-colors" />
                                        <input
                                            type="password"
                                            value={confirmPass}
                                            onChange={(e) => setConfirmPass(e.target.value)}
                                            placeholder="Confirmer"
                                            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-brand-100 outline-none transition-all font-bold text-gray-900 text-xs placeholder:text-gray-400/60"
                                            required
                                        />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={isChangingPass}
                                    className="w-full py-3.5 bg-gray-900 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-black transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
                                >
                                    {isChangingPass ? "Mise à jour..." : "Mettre à jour le mot de passe"}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>


            {/* Section Gestion Utilisateurs (Admin uniquement) */}
            {(profile?.role === 'admin' || profile?.permissions?.manage_users) && (
                <div className="space-y-6 sm:space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    {/* Header & Main Tabs */}
                    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-2 flex flex-col md:flex-row items-center gap-4">
                        <div className="flex bg-gray-50 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
                            <button
                                onClick={() => setActiveAdminTab('users')}
                                className={clsx(
                                    "flex-1 md:flex-none px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap",
                                    activeAdminTab === 'users' ? "bg-white text-brand-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                                )}
                            >
                                <User className="w-3.5 h-3.5" />
                                Utilisateurs
                            </button>
                            <button
                                onClick={() => setActiveAdminTab('audit')}
                                className={clsx(
                                    "flex-1 md:flex-none px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap",
                                    activeAdminTab === 'audit' ? "bg-white text-brand-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                                )}
                            >
                                <Shield className="w-3.5 h-3.5" />
                                Audit
                            </button>
                            {(profile?.role === 'admin' || profile?.permissions?.manage_categories) && (
                                <button
                                    onClick={() => setActiveAdminTab('categories')}
                                    className={clsx(
                                        "flex-1 md:flex-none px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap",
                                        activeAdminTab === 'categories' ? "bg-white text-brand-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                                    )}
                                >
                                    <LayoutGrid className="w-3.5 h-3.5" />
                                    Catégories
                                </button>
                            )}
                        </div>

                        <div className="flex-1 flex items-center justify-between w-full px-2">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-50 rounded-xl border border-brand-100/50">
                                <Shield className="w-3.5 h-3.5 text-brand-500" />
                                <span className="text-[9px] font-black uppercase text-brand-600 tracking-widest">Administration Système</span>
                            </div>

                            {activeAdminTab === 'users' && (
                                <button
                                    onClick={() => setShowAddModal(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-brand-700 transition-all active:scale-95 shadow-lg shadow-brand-100"
                                >
                                    <UserPlus className="w-3.5 h-3.5" />
                                    <span>Nouveau</span>
                                </button>
                            )}
                        </div>
                    </div>


                    {/* Contenu des onglets */}
                    <div className="mt-8">
                        {activeAdminTab === 'users' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {/* Filtre par site */}
                                <div className="flex justify-center">
                                    <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100">
                                        {[
                                            { id: 'all', label: '🌍 Tous' },
                                            { id: 'abidjan', label: '📍 Abidjan' },
                                            { id: 'bassam', label: '📍 Bassam' }
                                        ].map(site => (
                                            <button
                                                key={site.id}
                                                onClick={() => setSelectedSiteFilter(site.id as any)}
                                                className={clsx(
                                                    "px-6 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                                                    selectedSiteFilter === site.id ? "bg-brand-600 text-white shadow-sm" : "text-gray-400 hover:text-gray-600"
                                                )}
                                            >
                                                {site.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="w-full">
                                    {loading ? (
                                        <div className="bg-white rounded-[2.5rem] p-12 text-center text-gray-400 border border-gray-100 flex flex-col items-center">
                                            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-600 mb-6"></div>
                                            <p className="font-black uppercase tracking-widest text-xs">Chargement...</p>
                                        </div>
                                    ) : users.filter(u => selectedSiteFilter === 'all' || u.site === selectedSiteFilter).length === 0 ? (
                                        <div className="py-20 text-center bg-gray-50/20 rounded-[3rem] border-4 border-dashed border-gray-100 flex flex-col items-center">
                                            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-6 opacity-30">
                                                <User className="w-8 h-8 text-gray-400" />
                                            </div>
                                            <p className="font-black uppercase tracking-[0.3em] text-gray-300 text-xs">Aucun utilisateur</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                            {users
                                                .filter(u => selectedSiteFilter === 'all' || u.site === selectedSiteFilter)
                                                .map((user) => (
                                                    <div key={user.id} className="group relative bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-xl hover:shadow-brand-100/50 transition-all border-l-4 border-l-brand-500 flex flex-col">
                                                        <div className="flex justify-between items-start mb-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-12 h-12 bg-gray-50 text-brand-600 rounded-xl flex items-center justify-center text-lg font-black border border-brand-100 group-hover:bg-brand-50 transition-colors">
                                                                    {user.full_name?.[0] || user.username?.[0] || '?'}
                                                                </div>
                                                                <div>
                                                                    <h3 className="text-xs font-black text-gray-900 leading-tight truncate max-w-[120px] uppercase">{user.full_name || user.username}</h3>
                                                                    <p className="text-[9px] font-black text-brand-400 uppercase tracking-widest mt-1">@{user.username}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => handleEditClick(user)}
                                                                    className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-400 hover:text-brand-600 transition-colors"
                                                                >
                                                                    <Edit2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-2 mb-4">
                                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-transparent group-hover:border-gray-100 transition-all">
                                                                <Shield className="w-3 h-3 text-brand-400" />
                                                                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest truncate">{user.role}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-transparent group-hover:border-gray-100 transition-all">
                                                                <MapPin className="w-3 h-3 text-brand-400" />
                                                                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{user.site}</span>
                                                            </div>
                                                        </div>

                                                        <div className="mt-auto pt-4 border-t border-gray-50 flex justify-end">
                                                            <button
                                                                onClick={() => handleDeleteUser(user)}
                                                                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeAdminTab === 'audit' && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <AuditLogView />
                            </div>
                        )}

                        {activeAdminTab === 'categories' && (
                            <div className="animate-in fade-in slide-in-from-bottom-6 duration-500">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                                    <div className="lg:col-span-1">
                                        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                                            <h3 className="text-sm font-black text-gray-900 mb-6 tracking-tight uppercase">Nouvelle Catégorie</h3>
                                            <form onSubmit={handleAddCategory} className="space-y-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Désignation</label>
                                                    <input
                                                        type="text"
                                                        value={newCategoryName}
                                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                                        placeholder="Ex: Viande, Boisson, Légume"
                                                        className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-brand-200 outline-none transition-all font-bold text-gray-900 text-xs"
                                                        required
                                                    />
                                                </div>
                                                <button
                                                    type="submit"
                                                    disabled={isAddingCategory}
                                                    className="w-full py-3 bg-brand-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-brand-700 transition-all shadow-lg shadow-brand-100 active:scale-95 disabled:opacity-50"
                                                >
                                                    {isAddingCategory ? "Traitement..." : "Ajouter"}
                                                </button>
                                            </form>
                                        </div>
                                    </div>


                                    <div className="lg:col-span-2">
                                        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm min-h-[400px]">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                                <div className="flex items-center gap-4">
                                                    <h3 className="text-sm font-black text-gray-900 tracking-tight uppercase">
                                                        Catalogue des catégories
                                                    </h3>
                                                    {selectedCategoryIds.length > 0 && (
                                                        <button
                                                            onClick={handleBulkDeleteCategories}
                                                            className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-100 transition-all animate-in zoom-in"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                            Supprimer ({selectedCategoryIds.length})
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="relative group flex-1 sm:flex-none">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-300 group-focus-within:text-brand-600 transition-colors" />
                                                        <input
                                                            type="text"
                                                            placeholder="Rechercher..."
                                                            value={categorySearch}
                                                            onChange={(e) => setCategorySearch(e.target.value)}
                                                            className="pl-8 pr-3 py-1.5 bg-gray-50 border border-transparent rounded-lg focus:bg-white focus:border-brand-200 outline-none transition-all font-bold text-[10px] text-gray-900 w-full sm:w-40"
                                                        />
                                                    </div>
                                                    <span className="text-[10px] font-black text-brand-600 bg-brand-50 px-3 py-1 rounded-full uppercase tracking-widest whitespace-nowrap">{categories.length} total</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {categories
                                                    .filter(cat => cat.name.toLowerCase().includes(categorySearch.toLowerCase()))
                                                    .map((cat) => {
                                                        const isSelected = selectedCategoryIds.includes(cat.id);
                                                        return (
                                                            <div
                                                                key={cat.id}
                                                                className={clsx(
                                                                    "group flex items-center justify-between p-4 rounded-xl transition-all shadow-sm border cursor-pointer select-none",
                                                                    isSelected
                                                                        ? "bg-brand-50 border-brand-200"
                                                                        : "bg-gray-50/50 hover:bg-white border-transparent hover:border-brand-100"
                                                                )}
                                                                onClick={() => {
                                                                    if (isSelected) {
                                                                        setSelectedCategoryIds(selectedCategoryIds.filter(id => id !== cat.id));
                                                                    } else {
                                                                        setSelectedCategoryIds([...selectedCategoryIds, cat.id]);
                                                                    }
                                                                }}
                                                            >
                                                                {editingCategoryId === cat.id ? (
                                                                    <div className="flex items-center gap-2 flex-1 mr-2" onClick={e => e.stopPropagation()}>
                                                                        <input
                                                                            type="text"
                                                                            value={editingCategoryName}
                                                                            onChange={(e) => setEditingCategoryName(e.target.value)}
                                                                            className="flex-1 px-3 py-1.5 bg-white border border-brand-200 rounded-lg outline-none font-bold text-xs uppercase"
                                                                            autoFocus
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter') handleUpdateCategory(cat.id, cat.name);
                                                                                if (e.key === 'Escape') setEditingCategoryId(null);
                                                                            }}
                                                                        />
                                                                        <button
                                                                            onClick={() => handleUpdateCategory(cat.id, cat.name)}
                                                                            disabled={isUpdatingCategory}
                                                                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-all"
                                                                        >
                                                                            <Check className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setEditingCategoryId(null)}
                                                                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-all"
                                                                        >
                                                                            <X className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        <div className="flex items-center gap-3">
                                                                            <div className={clsx(
                                                                                "w-4 h-4 rounded border flex items-center justify-center transition-all",
                                                                                isSelected ? "bg-brand-600 border-brand-600" : "bg-white border-gray-200"
                                                                            )}>
                                                                                {isSelected && <Check className="w-3 h-3 text-white stroke-[4px]" />}
                                                                            </div>
                                                                            <span className={clsx(
                                                                                "font-bold text-xs uppercase tracking-tight",
                                                                                isSelected ? "text-brand-900" : "text-gray-700"
                                                                            )}>{cat.name}</span>
                                                                        </div>
                                                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all" onClick={e => e.stopPropagation()}>
                                                                            <button
                                                                                onClick={() => {
                                                                                    setEditingCategoryId(cat.id);
                                                                                    setEditingCategoryName(cat.name);
                                                                                }}
                                                                                className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all"
                                                                            >
                                                                                <Edit2 className="w-3.5 h-3.5" />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleDeleteCategory(cat.id, cat.name)}
                                                                                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                            >
                                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                {categories.length === 0 && (
                                                    <div className="col-span-full py-20 text-center italic text-gray-300 text-xs font-bold uppercase tracking-widest">
                                                        Aucune catégorie
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}        {/* Modals de Gestion (Uniquement Admin) */}
            {(profile?.role === 'admin' || profile?.permissions?.manage_users) && (
                <>
                    {showEditModal && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                            <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-xl max-h-[92vh] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in duration-200">
                                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                    <div>
                                        <h2 className="text-lg font-black text-gray-900 tracking-tight">Modifier l'accès</h2>
                                        <p className="text-[10px] font-bold text-brand-600 uppercase tracking-widest mt-0.5">@{editingUser?.username}</p>
                                    </div>
                                    <button onClick={() => { setShowEditModal(false); setEditingUser(null); }} className="p-2 hover:bg-gray-200 rounded-xl text-gray-400 transition-colors">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>


                                <form onSubmit={handleUpdateUser} className="flex-1 overflow-auto p-8 space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                                        <div className="space-y-1.5 sm:space-y-2">
                                            <label className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Nom complet</label>
                                            <div className="relative">
                                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                                                <input
                                                    type="text"
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    className="w-full pl-11 sm:pl-12 pr-4 py-3 sm:py-3.5 bg-gray-50 border border-gray-100 rounded-xl sm:rounded-2xl focus:bg-white focus:border-brand-200 outline-none transition-all font-bold text-gray-900 text-sm sm:text-base"
                                                    placeholder="Ex: Jean Kouadio"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5 sm:space-y-2">
                                            <label className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Rôle</label>
                                            <div className="relative">
                                                <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400 pointer-events-none" />
                                                <select
                                                    value={editRole}
                                                    onChange={(e) => handleEditRoleChange(e.target.value as UserRole)}
                                                    className="w-full pl-11 sm:pl-12 pr-4 py-3 sm:py-3.5 bg-gray-50 border border-gray-100 rounded-xl sm:rounded-2xl focus:bg-white focus:border-brand-200 outline-none transition-all font-bold text-gray-900 text-sm sm:text-base appearance-none cursor-pointer"
                                                >
                                                    <option value="admin">Administrateur</option>
                                                    <option value="gouvernante">Gouvernante</option>
                                                    <option value="service">Service (Cuisine/Resto)</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5 sm:space-y-2">
                                            <label className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Site</label>
                                            <div className="relative">
                                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400 pointer-events-none" />
                                                <select
                                                    value={editSite}
                                                    onChange={(e) => setEditSite(e.target.value as Site)}
                                                    className="w-full pl-11 sm:pl-12 pr-4 py-3 sm:py-3.5 bg-gray-50 border border-gray-100 rounded-xl sm:rounded-2xl focus:bg-white focus:border-brand-200 outline-none transition-all font-bold text-gray-900 text-sm sm:text-base appearance-none cursor-pointer"
                                                >
                                                    <option value="abidjan">Abidjan</option>
                                                    <option value="bassam">Bassam</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5 sm:space-y-2">
                                            <label className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Nouv. Mot de Passe (optionnel)</label>
                                            <div className="relative">
                                                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400 pointer-events-none" />
                                                <input
                                                    type="text"
                                                    value={editPassword}
                                                    onChange={(e) => setEditPassword(e.target.value)}
                                                    className="w-full pl-11 sm:pl-12 pr-4 py-3 sm:py-3.5 bg-gray-50 border border-gray-100 rounded-xl sm:rounded-2xl focus:bg-white focus:border-brand-200 outline-none transition-all font-bold text-gray-900 text-sm sm:text-base"
                                                    placeholder="Laisser vide si inchangé"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-[10px] font-black text-gray-400 border-b border-gray-100 pb-2 flex items-center uppercase tracking-widest">
                                            <Shield className="w-3.5 h-3.5 mr-2 text-brand-600" />
                                            Accès Spécifiques
                                        </h3>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                            {(Object.keys(PERMISSION_LABELS) as Array<keyof UserPermissions>).map((permKey) => {
                                                const { label, description } = PERMISSION_LABELS[permKey];
                                                const value = editPermissions[permKey] || false;
                                                return (
                                                    <label key={permKey} className="flex items-start p-3 sm:p-4 bg-gray-50 rounded-xl sm:rounded-2xl cursor-pointer hover:bg-white hover:shadow-md hover:ring-1 hover:ring-brand-200 transition-all group border border-transparent">
                                                        <div className="relative flex items-center mt-0.5">
                                                            <input
                                                                type="checkbox"
                                                                checked={value}
                                                                onChange={() => togglePermission(permKey, true)}
                                                                className="w-4 h-4 sm:w-5 sm:h-5 rounded-md sm:rounded-lg border-gray-300 text-brand-600 focus:ring-brand-500 transition-all cursor-pointer"
                                                            />
                                                        </div>
                                                        <div className="ml-2.5 sm:ml-3 flex flex-col min-w-0">
                                                            <span className="text-[11px] sm:text-sm font-black text-gray-900 group-hover:text-brand-600 transition-colors truncate">
                                                                {label}
                                                            </span>
                                                            <span className="text-[9px] sm:text-[11px] text-gray-400 font-bold leading-tight mt-0.5">
                                                                {description}
                                                            </span>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="flex space-x-3 pt-6">
                                        <button
                                            type="button"
                                            onClick={() => { setShowEditModal(false); setEditingUser(null); }}
                                            className="flex-1 py-4 bg-gray-50 text-gray-400 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-all"
                                        >
                                            Annuler
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="flex-2 px-8 py-4 bg-gray-900 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg hover:bg-gray-800 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                                        >
                                            <Save className="w-4 h-4" />
                                            {loading ? 'Traitement...' : 'Enregistrer'}
                                        </button>
                                    </div>

                                </form>
                            </div>
                        </div>
                    )}

                    {showAddModal && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                            <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-xl max-h-[92vh] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in duration-200">
                                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                    <div>
                                        <h2 className="text-lg font-black text-gray-900 tracking-tight">Nouveau Collaborateur</h2>
                                        <p className="text-[10px] font-bold text-brand-600 uppercase tracking-widest mt-0.5">Enregistrement système</p>
                                    </div>
                                    <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-200 rounded-xl text-gray-400 transition-colors">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>


                                <form onSubmit={handleAddUser} className="flex-1 overflow-auto p-8 space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                                        <div className="space-y-1.5 sm:space-y-2">
                                            <label className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Nom complet</label>
                                            <div className="relative">
                                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                                                <input
                                                    type="text"
                                                    value={newName}
                                                    onChange={(e) => setNewName(e.target.value)}
                                                    className="w-full pl-11 sm:pl-12 pr-4 py-3 sm:py-3.5 bg-gray-50 border border-gray-100 rounded-xl sm:rounded-2xl focus:bg-white focus:border-brand-200 outline-none transition-all font-bold text-gray-900 text-sm sm:text-base"
                                                    placeholder="Ex: Jean Kouadio"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5 sm:space-y-2">
                                            <label className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Utilisateur</label>
                                            <input
                                                type="text"
                                                value={newUsername}
                                                onChange={(e) => setNewUsername(e.target.value)}
                                                className="w-full px-4 sm:px-5 py-3 sm:py-3.5 bg-gray-50 border border-gray-100 rounded-xl sm:rounded-2xl focus:bg-white focus:border-brand-200 outline-none transition-all font-bold text-gray-900 text-sm sm:text-base"
                                                placeholder="Ex: jkouadio"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-1.5 sm:space-y-2">
                                            <label className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Mot de passe</label>
                                            <div className="relative">
                                                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                                                <input
                                                    type="password"
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    className="w-full pl-11 sm:pl-12 pr-4 py-3 sm:py-3.5 bg-gray-50 border border-gray-100 rounded-xl sm:rounded-2xl focus:bg-white focus:border-brand-200 outline-none transition-all font-bold text-gray-900 text-sm sm:text-base"
                                                    placeholder="••••••••"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5 sm:space-y-2">
                                            <label className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Rôle</label>
                                            <div className="relative">
                                                <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400 pointer-events-none" />
                                                <select
                                                    value={newRole}
                                                    onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                                                    className="w-full pl-11 sm:pl-12 pr-4 py-3 sm:py-3.5 bg-gray-50 border border-gray-100 rounded-xl sm:rounded-2xl focus:bg-white focus:border-brand-200 outline-none transition-all font-bold text-gray-900 text-sm sm:text-base appearance-none cursor-pointer"
                                                >
                                                    <option value="admin">Administrateur</option>
                                                    <option value="gouvernante">Gouvernante</option>
                                                    <option value="service">Service (Cuisine/Resto)</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5 sm:space-y-2">
                                            <label className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Site</label>
                                            <div className="relative">
                                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400 pointer-events-none" />
                                                <select
                                                    value={newSite}
                                                    onChange={(e) => setNewSite(e.target.value as Site)}
                                                    className="w-full pl-11 sm:pl-12 pr-4 py-3 sm:py-3.5 bg-gray-50 border border-gray-100 rounded-xl sm:rounded-2xl focus:bg-white focus:border-brand-200 outline-none transition-all font-bold text-gray-900 text-sm sm:text-base appearance-none cursor-pointer"
                                                >
                                                    <option value="abidjan">Abidjan</option>
                                                    <option value="bassam">Bassam</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-xs sm:text-sm font-black text-gray-900 border-b border-gray-100 pb-2 sm:pb-3 flex items-center uppercase tracking-widest">
                                            <Shield className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-brand-600" />
                                            Accès Spécifiques
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                            {(Object.keys(PERMISSION_LABELS) as Array<keyof UserPermissions>).map((permKey) => {
                                                const { label, description } = PERMISSION_LABELS[permKey];
                                                const value = newPermissions[permKey] || false;
                                                return (
                                                    <label key={permKey} className="flex items-start p-3 sm:p-4 bg-gray-50 rounded-xl sm:rounded-2xl cursor-pointer hover:bg-white hover:shadow-md hover:ring-1 hover:ring-brand-200 transition-all group border border-transparent">
                                                        <div className="relative flex items-center mt-0.5">
                                                            <input
                                                                type="checkbox"
                                                                checked={value}
                                                                onChange={() => togglePermission(permKey)}
                                                                className="w-4 h-4 sm:w-5 sm:h-5 rounded-md sm:rounded-lg border-gray-300 text-brand-600 focus:ring-brand-500 transition-all cursor-pointer"
                                                            />
                                                        </div>
                                                        <div className="ml-2.5 sm:ml-3 flex flex-col min-w-0">
                                                            <span className="text-[11px] sm:text-sm font-black text-gray-900 group-hover:text-brand-600 transition-colors truncate">
                                                                {label}
                                                            </span>
                                                            <span className="text-[9px] sm:text-[11px] text-gray-400 font-bold leading-tight mt-0.5">
                                                                {description}
                                                            </span>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="flex space-x-3 pt-6">
                                        <button
                                            type="button"
                                            onClick={() => setShowAddModal(false)}
                                            className="flex-1 py-4 bg-gray-50 text-gray-400 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-all"
                                        >
                                            Annuler
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="flex-2 px-8 py-4 bg-gray-900 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg hover:bg-gray-800 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                                        >
                                            <UserPlus className="w-4 h-4" />
                                            {loading ? 'Traitement...' : 'Créer l\'accès'}
                                        </button>
                                    </div>

                                </form>
                            </div>
                        </div>
                    )}
                </>
            )
            }
        </div >
    );
}
