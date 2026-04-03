import { useEntity } from "@/contexts/EntityContext";

/**
 * Returns a function that adds entity_id filter to a Supabase query builder.
 * When isAllEntities is true (global admin consolidated view), no filter is added.
 * When a specific entity is selected, adds .eq('entity_id', selectedEntityId).
 */
export function useEntityFilter() {
  const { selectedEntityId, isAllEntities } = useEntity();

  /**
   * Apply entity filter to a Supabase query builder.
   * Call as: applyEntityFilter(query) or applyEntityFilter(query, 'custom_entity_column')
   */
  function applyEntityFilter<T extends { eq: (column: string, value: string) => T }>(
    query: T,
    column: string = 'entity_id'
  ): T {
    if (!isAllEntities && selectedEntityId) {
      return query.eq(column, selectedEntityId);
    }
    return query;
  }

  return { applyEntityFilter, selectedEntityId, isAllEntities };
}
