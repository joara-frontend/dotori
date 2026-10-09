import { RssItem } from "./rss";

type ClusteredRssItem = RssItem & { sourceCount: number };

export function clusterIssues(items: RssItem[], limit: number) {
  // 1. 배열에서 따옴표, 괄호, 특수문자 제거하고 공백 기준으로 토큰 집합 생성
  const tokenSets = items.map((item) => {
    const cleanedTitle = item.title
      // \w는 ASCII 전용이라 한글까지 지워지므로 유니코드 문자/숫자 기준으로 남긴다
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .toLowerCase();
    const tokens = new Set(cleanedTitle.split(/\s+/).filter(Boolean));
    return tokens;
  });

  /* 2. 각 기사 간의 유사도 계산 (Jaccard 유사도)
    교집합과 합집합을 계산해서 0.4 이상이면 합치고 그렇지 않으면 새로운 클러스터 생성
  */
  function jaccardSimilarity(set1: Set<string>, set2: Set<string>) {
    // 교집합 계산
    const intersection = new Set([...set1].filter((item) => set2.has(item)));

    // 합집합 계산
    const union = new Set([...set1, ...set2]);

    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  // 클러스터의 "대표 토큰"만 저장 — 첫 기사(클러스터를 시작한 기사)의
  // 토큰 집합 하나와만 비교한다. 클러스터 안 기사 전체를 합친 토큰
  // 뭉치와 비교하면 클러스터가 커질수록 판단 기준이 느슨해져 관계없는
  // 기사가 잘못 합쳐질 위험이 있다.
  const clusters: RssItem[][] = [];
  const clusterAnchorTokens: Set<string>[] = [];
  for (let i = 0; i < items.length; i++) {
    let addedToCluster = false;
    for (let c = 0; c < clusters.length; c++) {
      if (jaccardSimilarity(tokenSets[i], clusterAnchorTokens[c]) >= 0.4) {
        clusters[c].push(items[i]);
        addedToCluster = true;
        break;
      }
    }
    if (!addedToCluster) {
      clusters.push([items[i]]);
      clusterAnchorTokens.push(tokenSets[i]);
    }
  }

  // 3. 클러스터마다 대표 기사 1개 + sourceCount로 압축
  const selected: ClusteredRssItem[] = clusters.map((cluster) => {
    const sourceCount = new Set(cluster.map((item) => item.sourceName)).size;

    // 대표 기사: 가장 먼저 보도된 기사(=publishedAt이 가장 이른 것)
    const representative = cluster.reduce((earliest, item) =>
      item.publishedAt < earliest.publishedAt ? item : earliest
    );

    return { ...representative, sourceCount };
  });

  // 4. sourceCount 내림차순 정렬 후 상위 limit개만 선택
  return selected.sort((a, b) => b.sourceCount - a.sourceCount).slice(0, limit);
}
