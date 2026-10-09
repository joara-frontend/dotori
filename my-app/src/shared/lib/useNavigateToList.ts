import { usePathname, useRouter } from "next/navigation";

/**
 * 헤더의 날짜·카테고리·검색 컨트롤은 스토어 상태만 바꾼다. 목록(IssueList)이
 * 없는 상세 페이지(/[id])에서는 변경이 보이지 않으므로 홈 목록으로 이동시킨다.
 */
export function useNavigateToList() {
  const pathname = usePathname();
  const router = useRouter();

  return () => {
    if (pathname !== "/") router.push("/#content");
  };
}
