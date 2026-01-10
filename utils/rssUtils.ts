import { Article, Subscription } from '../types';

export const downloadFeed = (filename: string, content: string, contentType: string) => {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const generateRSS = (sub: Subscription | undefined, articles: Article[]): string => {
  const feedTitle = sub ? sub.name : "LexiHub All Feeds";
  const items = articles.map(a => `
    <item>
      <title><![CDATA[${a.title}]]></title>
      <link>${a.url || 'https://mp.weixin.qq.com'}</link>
      <description><![CDATA[${a.content}]]></description>
      <pubDate>${new Date(a.publishDate).toUTCString()}</pubDate>
      <guid isPermaLink="false">${a.id}</guid>
      <author>${a.source}</author>
    </item>
  `).join('');

  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${feedTitle}</title>
  <description>WeChat Official Account updates via LexiHub</description>
  <link>https://lexihub.ai</link>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <generator>LexiHub RSS Engine</generator>
  ${items}
</channel>
</rss>`;
};

export const generateAtom = (sub: Subscription | undefined, articles: Article[]): string => {
  const feedTitle = sub ? sub.name : "LexiHub All Feeds";
  const feedId = sub ? `urn:uuid:${sub.id}` : "urn:uuid:all";
  
  const items = articles.map(a => `
    <entry>
      <title>${a.title}</title>
      <link href="${a.url || 'https://mp.weixin.qq.com'}" />
      <id>urn:uuid:${a.id}</id>
      <updated>${new Date(a.publishDate).toISOString()}</updated>
      <content type="html"><![CDATA[${a.content}]]></content>
      <author><name>${a.source}</name></author>
    </entry>
  `).join('');

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${feedTitle}</title>
  <updated>${new Date().toISOString()}</updated>
  <id>${feedId}</id>
  <generator>LexiHub</generator>
  ${items}
</feed>`;
};

export const generateJSON = (sub: Subscription | undefined, articles: Article[]): string => {
  const feedTitle = sub ? sub.name : "LexiHub All Feeds";
  
  return JSON.stringify({
    version: "https://jsonfeed.org/version/1",
    title: feedTitle,
    home_page_url: "https://lexihub.ai",
    feed_url: "https://lexihub.ai/feed.json",
    items: articles.map(a => ({
      id: a.id,
      url: a.url || "https://mp.weixin.qq.com",
      title: a.title,
      content_html: a.content,
      date_published: new Date(a.publishDate).toISOString(),
      author: { name: a.source }
    }))
  }, null, 2);
};
