import { useState, useMemo } from 'react';

export interface UsePaginationOptions {
  defaultPageSize?: number;
  pageSizeOptions?: number[];
}

export interface UsePaginationReturn<T> {
  /** Current page (0-indexed) */
  page: number;
  /** Items per page */
  pageSize: number;
  /** Total number of items */
  totalItems: number;
  /** Total number of pages */
  totalPages: number;
  /** The slice of data for the current page */
  pageData: T[];
  /** Go to a specific page */
  setPage: (page: number) => void;
  /** Change page size (resets to page 0) */
  setPageSize: (size: number) => void;
  /** Go to next page */
  nextPage: () => void;
  /** Go to previous page */
  prevPage: () => void;
  /** Whether there is a next page */
  hasNextPage: boolean;
  /** Whether there is a previous page */
  hasPrevPage: boolean;
  /** Available page size options */
  pageSizeOptions: number[];
}

export function usePagination<T>(
  data: T[],
  options: UsePaginationOptions = {}
): UsePaginationReturn<T> {
  const {
    defaultPageSize = 20,
    pageSizeOptions = [20, 50, 100, 200],
  } = options;

  const [page, setPage] = useState(0);
  const [pageSize, setPageSizeState] = useState(defaultPageSize);

  const totalItems = data.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Clamp page to valid range when data changes
  const safePage = Math.min(page, totalPages - 1);

  const pageData = useMemo(() => {
    const start = safePage * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, safePage, pageSize]);

  const setPageSize = (size: number) => {
    setPageSizeState(size);
    setPage(0);
  };

  return {
    page: safePage,
    pageSize,
    totalItems,
    totalPages,
    pageData,
    setPage: (p: number) => setPage(Math.max(0, Math.min(p, totalPages - 1))),
    setPageSize,
    nextPage: () => setPage(p => Math.min(p + 1, totalPages - 1)),
    prevPage: () => setPage(p => Math.max(p - 1, 0)),
    hasNextPage: safePage < totalPages - 1,
    hasPrevPage: safePage > 0,
    pageSizeOptions,
  };
}
