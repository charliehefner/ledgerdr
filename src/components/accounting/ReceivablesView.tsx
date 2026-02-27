import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { ApArDocumentList } from "./ApArDocumentList";

export function ReceivablesView() {
  return <ApArDocumentList direction="receivable" />;
}
