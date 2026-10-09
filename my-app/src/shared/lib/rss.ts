import Parser from "rss-parser";

export interface RssItem {
  title: string;
  link: string;
  sourceName: string;
  publishedAt: Date;
}

function splitTitleAndSource(RssTitle: string): {
  title: string;
  sourceName: string;
} {
  const targetIndex = RssTitle.lastIndexOf("-");
  const title = RssTitle.substring(0, targetIndex).trim();
  const sourceName = RssTitle.substring(targetIndex + 1).trim();
  if (targetIndex === -1) {
    return { title: RssTitle.trim(), sourceName: "" };
  }
  return { title, sourceName };
}

export async function fetchCategoryFeed(
  query: string,
  limit?: number
): Promise<RssItem[]> {
  const parser = new Parser();
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:1d`)}&hl=ko&gl=KR&ceid=KR:ko`;

  try {
    const feed = await parser.parseURL(url);
    const items: RssItem[] = feed.items
      .map((item) => {
        const { title, sourceName } = splitTitleAndSource(item.title || "");
        return {
          title,
          link: item.link || "",
          sourceName,
          publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        };
      })
      // 제목·링크가 없는 항목은 요약할 수 없고, 빈 source_url끼리는 유니크 키
      // (source_url, published_at)에서 충돌하므로 수집 단계에서 버린다.
      // slice 앞에서 걸러야 버린 만큼 다음 기사로 limit개를 채운다.
      .filter((item) => item.title && item.link)
      .slice(0, limit);
    return items;
  } catch (error) {
    console.error("Error fetching RSS feed:", error);
    return [];
  }
}
