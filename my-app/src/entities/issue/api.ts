import { supabase } from "@/shared/config/supabase";
import { useQuery } from "@tanstack/react-query";
import type { Issue } from "./types";

export async function fetchIssuesByDate(date: string): Promise<Issue[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("issues")
    .select("*")
    .eq("published_at", date)
    .order("published_at", { ascending: false });

  if (error) {
    console.error("Error fetching issues by date:", error);
    return [];
  }

  return data;
}

export async function fetchIssueById(id: string): Promise<Issue | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("issues")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Error fetching issue by ID:", error);
    return null;
  }

  return data;
}

function sanitizeSearchQuery(query: string) {
  return query.trim().replace(/[,%_()]/g, "");
}

export async function searchIssues(query: string): Promise<Issue[]> {
  if (!supabase) return [];

  const sanitized = sanitizeSearchQuery(query);
  if (!sanitized) return [];

  const { data, error } = await supabase
    .from("issues")
    .select("*")
    .or(
      `title.ilike.%${sanitized}%,summary_1.ilike.%${sanitized}%,summary_2.ilike.%${sanitized}%,summary_3.ilike.%${sanitized}%`
    );

  if (error) {
    console.error("Error searching issues:", error);
    return [];
  }

  return data;
}

export function useIssuesByDate(date: string, initialData?: Issue[]) {
  return useQuery({
    queryKey: ["issues", "by-date", date],
    queryFn: () => fetchIssuesByDate(date),
    initialData,
  });
}

export function useSearchIssues(query: string) {
  return useQuery({
    queryKey: ["issues", "search", query],
    queryFn: () => searchIssues(query),
    enabled: query.trim().length > 0,
  });
}
