import { useState, useEffect, useCallback } from "react";
import { openDB, DBSchema, IDBPDatabase } from "idb";
import { useOnlineStatus } from "./useOnlineStatus";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface PendingSubmission {
  id: string;
  tractorId: string;
  tractorName: string;
  tankId: string;
  tankName: string;
  hourMeterReading: number;
  previousHourMeter: number;
  pumpStartReading: number;
  pumpEndReading: number;
  gallons: number;
  photos: {
    hourMeter?: string;
    pumpStart?: string;
    pumpEnd?: string;
  };
  createdAt: string;
  syncStatus: "pending" | "syncing" | "failed";
  retryCount: number;
}

interface FuelQueueDB extends DBSchema {
  submissions: {
    key: string;
    value: PendingSubmission;
    indexes: { "by-status": string };
  };
}

const DB_NAME = "fuel-queue";
const DB_VERSION = 1;

async function getDB(): Promise<IDBPDatabase<FuelQueueDB>> {
  return openDB<FuelQueueDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore("submissions", { keyPath: "id" });
      store.createIndex("by-status", "syncStatus");
    },
  });
}

export function useOfflineQueue() {
  const [pending, setPending] = useState<PendingSubmission[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const isOnline = useOnlineStatus();

  // Load pending submissions from IndexedDB
  const loadPending = useCallback(async () => {
    try {
      const db = await getDB();
      const all = await db.getAll("submissions");
      setPending(all.filter(s => s.syncStatus === "pending" || s.syncStatus === "failed"));
    } catch (error) {
      console.error("[OfflineQueue] Failed to load pending:", error);
    }
  }, []);

  // Add a new submission to the queue
  const addSubmission = useCallback(async (submission: Omit<PendingSubmission, "id" | "createdAt" | "syncStatus" | "retryCount">) => {
    const db = await getDB();
    const newSubmission: PendingSubmission = {
      ...submission,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      syncStatus: "pending",
      retryCount: 0,
    };
    await db.add("submissions", newSubmission);
    await loadPending();
    
    // If online, try to sync immediately
    if (isOnline) {
      syncPending();
    }
    
    return newSubmission.id;
  }, [isOnline, loadPending]);

  // Sync a single submission to the server
  const syncSubmission = async (submission: PendingSubmission): Promise<boolean> => {
    const db = await getDB();
    
    try {
      // Update status to syncing
      await db.put("submissions", { ...submission, syncStatus: "syncing" });
      
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("No authenticated user");
      }

      // Calculate gallons per hour
      const hoursWorked = submission.hourMeterReading - submission.previousHourMeter;
      const gallonsPerHour = hoursWorked > 0 ? submission.gallons / hoursWorked : null;

      // Insert the fuel transaction
      const { error } = await supabase.from("fuel_transactions").insert({
        tank_id: submission.tankId,
        equipment_id: submission.tractorId,
        transaction_type: "dispense",
        gallons: submission.gallons,
        pump_start_reading: submission.pumpStartReading,
        pump_end_reading: submission.pumpEndReading,
        hour_meter_reading: submission.hourMeterReading,
        previous_hour_meter: submission.previousHourMeter,
        gallons_per_hour: gallonsPerHour,
        submitted_by: user.id,
        submission_source: "portal",
      });

      if (error) throw error;

      // Success - remove from queue
      await db.delete("submissions", submission.id);
      setLastSyncTime(new Date());
      return true;
      
    } catch (error) {
      console.error("[OfflineQueue] Sync failed:", error);
      
      // Update with incremented retry count
      const updated: PendingSubmission = {
        ...submission,
        syncStatus: "failed",
        retryCount: submission.retryCount + 1,
      };
      await db.put("submissions", updated);
      
      return false;
    }
  };

  // Sync all pending submissions
  const syncPending = useCallback(async () => {
    if (isSyncing || !isOnline) return;
    
    setIsSyncing(true);
    
    try {
      const db = await getDB();
      const pendingItems = await db.getAllFromIndex("submissions", "by-status", "pending");
      const failedItems = (await db.getAllFromIndex("submissions", "by-status", "failed"))
        .filter(s => s.retryCount < 3); // Max 3 retries
      
      const toSync = [...pendingItems, ...failedItems];
      
      let successCount = 0;
      let failCount = 0;
      
      for (const submission of toSync) {
        const success = await syncSubmission(submission);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      }
      
      if (successCount > 0) {
        toast({
          title: "Sincronización completada",
          description: `${successCount} registro(s) sincronizado(s)`,
        });
      }
      
      if (failCount > 0) {
        toast({
          title: "Algunos registros fallaron",
          description: `${failCount} registro(s) pendiente(s)`,
          variant: "destructive",
        });
      }
      
    } catch (error) {
      console.error("[OfflineQueue] Sync error:", error);
    } finally {
      setIsSyncing(false);
      await loadPending();
    }
  }, [isOnline, isSyncing, loadPending]);

  // Load on mount
  useEffect(() => {
    loadPending();
  }, [loadPending]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && pending.length > 0) {
      syncPending();
    }
  }, [isOnline]);

  return {
    pending,
    pendingCount: pending.length,
    lastSyncTime,
    isSyncing,
    addSubmission,
    syncPending,
    loadPending,
  };
}
