import { Article, ContentType, Subscription } from './types';

export const INITIAL_SUBSCRIPTIONS: Subscription[] = [
  { id: 'sub1', name: '广东顺一律师事务所', avatar: 'https://ui-avatars.com/api/?name=SY&background=random&color=fff', unreadCount: 1 },
  { id: 'sub2', name: '北京市盈科广州律师事务所', avatar: 'https://ui-avatars.com/api/?name=YK&background=random&color=fff', unreadCount: 2 },
  { id: 'sub3', name: '北京市竞天公诚律师事务所', avatar: 'https://ui-avatars.com/api/?name=JT&background=random&color=fff', unreadCount: 0 }
];

// Simulate initial data that might come from Supabase
export const INITIAL_ARTICLES: Article[] = [
  {
    id: '1',
    subscriptionId: 'sub1',
    title: '【顺一喜报】广东顺一律师事务所《村规民约审查法律服务》产品荣获第三届佛山律师法律服务产品大奖！',
    content: `
      <p>广东顺一律师事务所凭借<strong>《村规民约审查法律服务》</strong>在第三届佛山律师法律服务产品大赛中脱颖而出，荣获金奖。</p>
      <p>该产品旨在帮助村居完善治理结构，规避法律风险，促进乡村振兴。随着乡村治理法治化水平的不断提高，村规民约作为基层自治的重要依据，其合法性与规范性显得尤为重要。</p>
      <img src="https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&w=800&q=80" alt="Award Ceremony" style="width: 100%; border-radius: 8px; margin: 16px 0;" />
      <h3>产品核心优势</h3>
      <p>我们的服务团队深入一线，针对不同村居的实际情况，制定了个性化的审查方案。主要包括以下几个方面：</p>
      <ul>
        <li>合法性审查：确保村规民约不与宪法、法律、法规相抵触。</li>
        <li>合理性审查：尊重当地风俗习惯，确保条款具有可操作性。</li>
        <li>程序性审查：规范制定和修订程序，保障村民的知情权和参与权。</li>
      </ul>
      <p>此次获奖不仅是对律所专业能力的认可，更是对我们在基层治理法律服务领域探索的肯定。</p>
      <img src="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=800&q=80" alt="Team Working" style="width: 100%; border-radius: 8px; margin: 16px 0;" />
      <p>我们将继续秉持“专业、高效、诚信”的服务理念，为客户提供优质的法律服务。</p>
    `,
    source: '广东顺一律师事务所',
    url: 'https://mp.weixin.qq.com/s/example_shunyi_award', 
    type: ContentType.ARTICLE,
    publishDate: '2025-12-22 19:38:37',
    createdAt: '2025-12-22T19:38:37Z',
    isAnalyzed: false,
  },
  {
    id: '2',
    subscriptionId: 'sub2',
    title: '喜讯 | 盈科广州律师入选广州市涉外法治专家库',
    content: `
      <p>近日，广州市法学会公布了<strong>广州市涉外法治专家库拟入库人员名单</strong>，盈科广州多名律师凭借深厚的涉外法律服务经验成功入选。</p>
      <p>入选专家将承担涉外法律政策研究、重大涉外经贸活动法律咨询、涉外纠纷调解等重要职责。</p>
      <img src="https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=800&q=80" alt="Expert Team" style="width: 100%; border-radius: 8px; margin: 16px 0;" />
      <p>盈科广州一直高度重视涉外法律服务能力的建设，拥有一支精通多国语言、熟悉国际规则的律师团队。此次入选，标志着盈科广州在涉外法律服务领域的专业实力得到了官方的高度认可。</p>
      <p>未来，我们将继续发挥专业优势，为广州市涉外法治建设贡献力量，护航中国企业“走出去”。</p>
    `,
    source: '北京市盈科广州律师事务所',
    url: 'https://www.yingkelawyer.com/',
    type: ContentType.ANNOUNCEMENT,
    publishDate: '2025-12-22 19:23:50',
    createdAt: '2025-12-22T19:23:50Z',
    isAnalyzed: false,
  },
  {
    id: '3',
    subscriptionId: 'sub2',
    title: '燃动赛场，竞绽锋芒！盈科广州律师征战市律协第十一届运动会风采实录',
    content: `
      <p>盈科广州律师代表队在广州市律师协会第十一届运动会中表现出色，斩获多项荣誉，展现了法律人积极向上的精神风貌。</p>
      <img src="https://images.unsplash.com/photo-1526676037777-05a232554f77?auto=format&fit=crop&w=800&q=80" alt="Sports Event" style="width: 100%; border-radius: 8px; margin: 16px 0;" />
      <p>赛场上，律师们顽强拼搏，团结协作；赛场下，大家欢声笑语，畅叙友谊。这不仅是一场体育竞技，更是一次展示律师风采、凝聚行业力量的盛会。</p>
    `,
    source: '北京市盈科广州律师事务所',
    url: 'https://www.yingkelawyer.com/news',
    type: ContentType.ARTICLE,
    publishDate: '2025-12-22 19:23:50',
    createdAt: '2025-12-22T19:23:50Z',
    isAnalyzed: false,
  },
  {
    id: '4',
    subscriptionId: 'sub3',
    title: '竞天公诚协助华芒生物成功香港H股上市',
    content: `
      <p>竞天公诚作为发行人中国法律顾问，协助<strong>华芒生物科技股份有限公司</strong>成功在香港联合交易所主板挂牌上市。</p>
      <img src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80" alt="IPO Ceremony" style="width: 100%; border-radius: 8px; margin: 16px 0;" />
      <p>本项目涉及复杂的跨境架构重组及行业合规审查。竞天公诚律师团队凭藉在生物医药领域丰富的项目经验，协助公司解决了多个法律难题，确保了项目的顺利推进。</p>
      <p>本次上市将助力华芒生物进一步拓展国际市场，加速研发创新。</p>
    `,
    source: '北京市竞天公诚律师事务所',
    url: 'http://www.jingtian.com/Content/2025/12-22/1618140001.html',
    type: ContentType.ARTICLE,
    publishDate: '2025-12-22 16:18:14',
    createdAt: '2025-12-22T16:18:14Z',
    isAnalyzed: false,
  },
  {
    id: '5',
    subscriptionId: 'sub3',
    title: '竞天公诚主办项目入选2025年“一带一路”法律服务典型案例',
    content: `
      <p>本次入选案例展现了竞天公诚在跨境基础设施建设法律服务领域的领先地位，为一带一路沿线国家的法律合作提供了宝贵经验。</p>
      <p>该项目涉及多个国家的法律适用冲突，律师团队通过创新的法律架构设计，有效化解了法律风险，保障了项目的顺利实施。</p>
    `,
    source: '北京市竞天公诚律师事务所',
    url: 'http://www.jingtian.com/Content/2025/12-22/1618140002.html',
    type: ContentType.ANNOUNCEMENT,
    publishDate: '2025-12-22 16:18:14',
    createdAt: '2025-12-22T16:18:14Z',
    isAnalyzed: false,
  },
   {
    id: '6',
    subscriptionId: 'sub3',
    title: '竞争法与反垄断 | 纵向协议“安全港”规则的简要解读及合规建议',
    content: `
      <h3>引言</h3>
      <p>近期反垄断局发布了关于纵向协议的新指南。本文深入解读了“安全港”规则的具体适用标准，并为企业经销协议的签署提供了具体合规建议，以避免触犯反垄断法红线。</p>
      <h3>安全港规则的核心</h3>
      <p>根据新指南，市场份额低于一定比例的经营者，其纵向协议（除核心限制外）通常被推定为不具有排除、限制竞争的效果。</p>
      <img src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=800&q=80" alt="Legal Analysis" style="width: 100%; border-radius: 8px; margin: 16px 0;" />
      <h3>合规建议</h3>
      <ul>
        <li>审查现有的经销协议，确认是否存在转售价格维持（RPM）等核心限制。</li>
        <li>评估自身在相关市场的市场份额。</li>
        <li>建立完善的反垄断合规体系。</li>
      </ul>
    `,
    source: '北京市竞天公诚律师事务所',
    url: 'http://www.jingtian.com/Content/2025/12-22/1618140003.html',
    type: ContentType.REGULATION,
    publishDate: '2025-12-22 16:18:14',
    createdAt: '2025-12-22T16:18:14Z',
    isAnalyzed: false,
  }
];

export const MOCK_WEWE_RSS_SOURCE = `
[New Fetch] WeChat Account: "LegalDaily"
Found 3 new articles.
1. "Interpretation of the new Company Law"
2. "Labor dispute cases summary Q3"
3. "Intellectual Property protection updates"
... Syncing to Supabase ...
`;