"use client";

import { useIssueUIStore } from "@/entities/issue/store";
import { useSearchIssues } from "@/entities/issue/api";
import { CATEGORY_MAP } from "@/shared/config";
import { formatDateShort } from "@/shared/lib/formatDate";
import { useNavigateToList } from "@/shared/lib/useNavigateToList";

export function SearchBox() {
  const searchOpen = useIssueUIStore((s) => s.searchOpen);
  const searchQuery = useIssueUIStore((s) => s.searchQuery);
  const toggleSearch = useIssueUIStore((s) => s.toggleSearch);
  const setSearchQuery = useIssueUIStore((s) => s.setSearchQuery);
  const jumpToResult = useIssueUIStore((s) => s.jumpToResult);
  const navigateToList = useNavigateToList();

  const { data: results = [] } = useSearchIssues(searchQuery);
  const showResults = searchOpen && searchQuery.trim().length > 0;

  return (
    <div className="relative flex items-center gap-1.5">
      {searchOpen && (
        <input
          autoFocus
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="이슈 검색"
          className="rounded-pill border-border-strong bg-bg-subtle text-text-primary h-9 w-44 border px-4 text-sm outline-none md:w-55"
        />
      )}
      <button
        onClick={toggleSearch}
        className="duration-base hover:bg-border-soft flex h-9 w-9 cursor-pointer items-center justify-center rounded-sm transition-colors"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          className="stroke-icon"
        >
          <circle cx="10.5" cy="10.5" r="6.5" strokeWidth="1.6" />
          <line
            x1="15.5"
            y1="15.5"
            x2="20.5"
            y2="20.5"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {showResults && (
        <div className="border-border bg-bg absolute top-12 right-0 z-60 max-h-100 w-85 overflow-y-auto rounded-md border shadow-lg">
          {results.length > 0 ? (
            results.map((r) => {
              const cat = CATEGORY_MAP[r.category];
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    jumpToResult(r.published_at, r.category);
                    navigateToList();
                  }}
                  className="border-border-soft duration-base hover:bg-bg-subtle block w-full cursor-pointer border-b px-4 py-3.5 text-left transition-colors"
                >
                  <div className={`text-2xs mb-1 font-bold ${cat.textClass}`}>
                    {cat.label} · {formatDateShort(r.published_at)}
                  </div>
                  <div className="text-text-primary text-sm font-semibold">
                    {r.title}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="text-text-placeholder px-4 py-6 text-center text-sm">
              검색 결과가 없어요
            </div>
          )}
        </div>
      )}
    </div>
  );
}
