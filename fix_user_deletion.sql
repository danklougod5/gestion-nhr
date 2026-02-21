-- ==================================================================================
-- SCRIPT DE RÉPARATION DE LA SUPPRESSION DES UTILISATEURS
-- ==================================================================================
-- Ce script permet de supprimer réellement un utilisateur du système d'authentification
-- (auth.users) lorsqu'il est supprimé de la table des profils.
-- ==================================================================================

-- 1. On ajuste les contraintes pour ne pas bloquer la suppression
-- Si l'utilisateur a fait des actions, on garde la trace mais on détache son ID

-- Pour les logs d'audit
ALTER TABLE IF EXISTS public.audit_logs 
  DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey,
  ADD CONSTRAINT audit_logs_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Création d'une fonction sécurisée pour supprimer l'utilisateur d'AUTH
-- Cette fonction s'exécute avec les privilèges 'service_role' (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.delete_user_auth(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Vérification : Seul un administrateur peut appeler cette fonction
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Non autorisé : Seul un administrateur peut supprimer un compte.';
  END IF;

  -- Suppression de l'utilisateur dans la table AUTH (ce qui est le vrai compte)
  DELETE FROM auth.users WHERE id = target_user_id;
  
  -- La suppression dans public.profiles devrait suivre par cascade si configuré,
  -- mais au cas où, on le fait explicitement (ou le frontend le fait déjà)
  DELETE FROM public.profiles WHERE id = target_user_id;
END;
$$;

-- 3. Alternative : Trigger automatique (plus simple)
-- Si on veut que n'importe quelle suppression dans 'profiles' déclenche 'auth'
CREATE OR REPLACE FUNCTION public.on_profile_deleted_trigger()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_delete_auth_user ON public.profiles;
CREATE TRIGGER trigger_delete_auth_user
AFTER DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.on_profile_deleted_trigger();

COMMENT ON FUNCTION public.delete_user_auth IS 'Supprime un utilisateur d''auth.users via son ID de profil.';
