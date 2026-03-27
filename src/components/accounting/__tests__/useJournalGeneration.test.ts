import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock supabase
const mockRpc = vi.fn();
const mockInvoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: any[]) => mockRpc(...args),
    functions: { invoke: (...args: any[]) => mockInvoke(...args) },
  },
}));

// Mock react-query
const mockInvalidateQueries = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

// Mock toast - use vi.hoisted to avoid hoisting issues
const mockToast = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({
  toast: mockToast,
  useToast: () => ({ toast: mockToast }),
}));

import { useJournalGeneration } from "../useJournalGeneration";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useJournalGeneration", () => {
  describe("countUnlinked", () => {
    it("calls the correct RPC and returns count", async () => {
      mockRpc.mockResolvedValue({ data: 5, error: null });
      const { result } = renderHook(() => useJournalGeneration("user1"));

      let count: number = 0;
      await act(async () => { count = await result.current.countUnlinked(); });

      expect(mockRpc).toHaveBeenCalledWith("count_unlinked_transactions", {});
      expect(count).toBe(5);
    });

    it("throws on RPC error", async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: "fail" } });
      const { result } = renderHook(() => useJournalGeneration());

      await expect(act(() => result.current.countUnlinked())).rejects.toEqual({ message: "fail" });
    });
  });

  describe("generate", () => {
    it("returns created count on success", async () => {
      mockInvoke.mockResolvedValue({ data: { created: 3, skipped: [], total: 3 }, error: null });
      const { result } = renderHook(() => useJournalGeneration("user1"));

      let created = 0;
      await act(async () => { created = await result.current.generate(); });

      expect(created).toBe(3);
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["journals"] });
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Completado" }));
    });

    it("shows warning toast when entries are skipped", async () => {
      mockInvoke.mockResolvedValue({ data: { created: 2, skipped: ["reason1", "reason2"], total: 4 }, error: null });
      const { result } = renderHook(() => useJournalGeneration());

      await act(async () => { await result.current.generate(); });

      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
    });

    it("shows info toast when nothing to generate", async () => {
      mockInvoke.mockResolvedValue({ data: { created: 0, skipped: [], total: 0 }, error: null });
      const { result } = renderHook(() => useJournalGeneration());

      await act(async () => { await result.current.generate(); });

      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Info" }));
    });

    it("handles errors gracefully", async () => {
      mockInvoke.mockResolvedValue({ data: null, error: { message: "server error" } });
      const { result } = renderHook(() => useJournalGeneration());

      let created = 0;
      await act(async () => { created = await result.current.generate(); });

      expect(created).toBe(0);
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
    });
  });
});
