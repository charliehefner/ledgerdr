import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

export interface Entity {
  id: string;
  name: string;
  code: string;
}

interface EntityContextType {
  /** Currently selected entity UUID, or null when "All Entities" is selected */
  selectedEntityId: string | null;
  /** True when the user is a global admin (entity_id IS NULL in user_roles) */
  isGlobalAdmin: boolean;
  /** True when global admin has selected "All Entities" (selectedEntityId === null) */
  isAllEntities: boolean;
  /** List of entities accessible to the user */
  entities: Entity[];
  /** Switch entity — only available to global admins */
  setSelectedEntityId: (id: string | null) => void;
  /** Loading state */
  isLoading: boolean;
  /** Require a specific entity for write operations. Returns entity_id or shows toast + returns null. */
  requireEntity: () => string | null;
}

const EntityContext = createContext<EntityContextType | undefined>(undefined);

const STORAGE_KEY = "ledger-selected-entity";

export function EntityProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth();
  const [selectedEntityId, setSelectedEntityIdState] = useState<string | null>(null);
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [isGroupUser, setIsGroupUser] = useState(false);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!user || !session) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const init = async () => {
      try {
        // Check if user is global admin
        const { data: globalAdmin } = await supabase.rpc("is_global_admin");
        const isAdmin = !!globalAdmin;

        if (cancelled) return;
        setIsGlobalAdmin(isAdmin);

        if (isAdmin) {
          // Fetch all active entities
          const { data: ents, error } = await supabase
            .from("entities")
            .select("id, name, code")
            .eq("is_active", true)
            .order("name");

          if (cancelled) return;
          if (error) {
            console.error("[Entity] Error fetching entities:", error);
            setEntities([]);
          } else {
            setEntities(ents || []);

            // Auto-select if only one entity; otherwise restore persisted selection
            if (ents && ents.length === 1) {
              setSelectedEntityIdState(ents[0].id);
              localStorage.setItem(STORAGE_KEY, ents[0].id);
            } else {
              const stored = localStorage.getItem(STORAGE_KEY);
              if (stored && ents?.some((e) => e.id === stored)) {
                setSelectedEntityIdState(stored);
              } else if (ents && ents.length > 0) {
                setSelectedEntityIdState(ents[0].id);
              }
            }
          }
        } else {
          // Entity-scoped user — fetch their fixed entity
          const { data: entityId } = await supabase.rpc("current_user_entity_id");
          if (cancelled) return;

          if (entityId) {
            setSelectedEntityIdState(entityId);

            // Fetch entity details
            const { data: ent } = await supabase
              .from("entities")
              .select("id, name, code")
              .eq("id", entityId)
              .single();

            if (!cancelled && ent) {
              setEntities([ent]);
            }
          }
        }
      } catch (err) {
        console.error("[Entity] Init error:", err);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setInitialized(true);
        }
      }
    };

    init();
    return () => { cancelled = true; };
  }, [user?.id, session?.access_token]);

  const setSelectedEntityId = useCallback((id: string | null) => {
    setSelectedEntityIdState(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const isAllEntities = isGlobalAdmin && selectedEntityId === null;

  const requireEntity = useCallback((): string | null => {
    if (selectedEntityId) return selectedEntityId;
    // In All Entities mode or no entity selected — block write
    return null;
  }, [selectedEntityId]);

  return (
    <EntityContext.Provider
      value={{
        selectedEntityId,
        isGlobalAdmin,
        isAllEntities,
        entities,
        setSelectedEntityId,
        isLoading,
        requireEntity,
      }}
    >
      {children}
    </EntityContext.Provider>
  );
}

export function useEntity() {
  const context = useContext(EntityContext);
  if (context === undefined) {
    throw new Error("useEntity must be used within an EntityProvider");
  }
  return context;
}
