-- ==================================================================================
-- SCRIPT DE MISE À JOUR DES POLITIQUES DE SÉCURITÉ (RLS)
-- ==================================================================================
-- INSTRUCTIONS :
-- 1. Copiez tout le contenu de ce fichier.
-- 2. Allez dans votre Tableau de bord Supabase (https://supabase.com/dashboard)
-- 3. Allez dans la section "SQL Editor".
-- 4. Collez le code et cliquez sur "RUN".
-- ==================================================================================

-- 1. Activer RLS sur les tables (au cas où ce n'est pas fait)
ALTER TABLE needs_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- 2. Nettoyer les anciennes politiques pour éviter les conflits
DROP POLICY IF EXISTS "Allow delete needs if authorized" ON needs_requests;
DROP POLICY IF EXISTS "Allow delete stock_movements if authorized" ON stock_movements;
DROP POLICY IF EXISTS "Allow update products if authorized" ON products;

-- 3. Politique : SUPPRESSION des Bons de Sortie (needs_requests)
-- Autorise la suppression si l'utilisateur a la permission 'delete_needs' dans son profil
CREATE POLICY "Allow delete needs if authorized" ON needs_requests
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.permissions->>'delete_needs')::boolean = true
    )
  );

-- 4. Politique : SUPPRESSION des Mouvements de Stock (stock_movements)
-- Nécessaire car on supprime les mouvements associés avant de supprimer le bon
CREATE POLICY "Allow delete stock_movements if authorized" ON stock_movements
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.permissions->>'delete_needs')::boolean = true
    )
  );

-- 5. Politique : MISE À JOUR des Produits (products)
-- Nécessaire pour remettre le stock (incrémenter) lors de la suppression
-- ou le modifier lors de l'édition
CREATE POLICY "Allow update products if authorized" ON products
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        (profiles.permissions->>'delete_needs')::boolean = true OR
        (profiles.permissions->>'edit_needs')::boolean = true OR
        (profiles.permissions->>'create_needs')::boolean = true
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        (profiles.permissions->>'delete_needs')::boolean = true OR
        (profiles.permissions->>'edit_needs')::boolean = true OR
        (profiles.permissions->>'create_needs')::boolean = true
      )
    )
  );

-- 6. Politique : MODIFICATION des Mouvements (stock_movements)
-- Pour modifier les quantités via le bouton "MODIFIER"
CREATE POLICY "Allow update stock_movements if authorized" ON stock_movements
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.permissions->>'edit_needs')::boolean = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.permissions->>'edit_needs')::boolean = true
    )
  );
