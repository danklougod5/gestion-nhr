
export type Site = 'abidjan' | 'bassam';
export type UserRole = 'admin' | 'gouvernante' | 'service';

export interface UserPermissions {
    view_inventory: boolean;
    view_all_sites_stock: boolean;
    edit_inventory: boolean;
    view_needs: boolean;
    view_full_needs_history: boolean;
    create_needs: boolean;
    edit_needs: boolean;
    delete_needs: boolean;
    view_purchases: boolean;
    manage_users: boolean;
    view_stock_history: boolean;
    manage_categories: boolean;
}

export interface User {
    id: string;
    email: string;
    username: string;
    full_name: string;
    role: UserRole;
    site: Site;
    permissions: UserPermissions;
    created_at: string;
}

export interface Product {
    id: string;
    name: string;
    category: string;
    min_threshold: number;
    image_url?: string;
    created_at: string;
    created_by?: string;
    creator?: {
        full_name: string;
    };
    // Stock level per site (handled via relation usually, but for UI simplicity here)
    stock_abidjan: number;
    stock_bassam: number;
    site?: Site;
}

export interface StockMovement {
    id: string;
    product_id: string;
    type: 'IN' | 'OUT' | 'UPDATE' | 'DELETE';
    quantity: number;
    site: Site;
    performed_by: string; // user id
    date: string;
    reference?: string; // Purchase order or Needs request ID
}

export interface NeedsRequest {
    id: string;
    requested_by: string; // user id
    site: Site;
    status: 'pending' | 'approved' | 'rejected' | 'completed';
    date: string;
    items: {
        product_id: string;
        quantity: number;
    }[];
}
