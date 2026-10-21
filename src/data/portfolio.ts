export type PortfolioCategoryId = 'all' | 'banners' | 'logos' | 'illustrations' | 'packs' | 'uiux' | 'sites';

export type PortfolioCategory = {
  id: PortfolioCategoryId;
  label: string;
  description: string;
  emoji: string;
};

export type DesignPortfolioCategoryId = Exclude<PortfolioCategoryId, 'all' | 'sites'>;

export type PortfolioItem = {
  id: string;
  title: string;
  category: DesignPortfolioCategoryId;
  assetPath: string;
  note: string;
  technique: string;
  serviceId: string;
};

export type SitePortfolioItem = {
  id: string;
  title: string;
  url: string;
  note: string;
};

export const portfolioCategories: PortfolioCategory[] = [
  { id: 'all', label: 'Acervo Completo', description: 'Todas as 11 obras autorais do estúdio.', emoji: '✨' },
  { id: 'banners', label: 'Banners & Headers', description: 'Peças de alto impacto, capas e composições HD.', emoji: '🖼️' },
  { id: 'logos', label: 'Logos & Identidade', description: 'Identidade visual, marca autoral e mascote.', emoji: '👑' },
  { id: 'illustrations', label: 'Ilustrações & Concept', description: 'Personagens, concept art e ilustrações autorais.', emoji: '🎨' },
  { id: 'packs', label: 'Packs Visuais', description: 'Sistemas visuais completos para servidores e marcas.', emoji: '📦' },
  { id: 'uiux', label: 'UI/UX & Interfaces', description: 'Interfaces, telas interativas e layouts.', emoji: '💠' },
  { id: 'sites', label: 'Sites & Web 3D', description: 'Experiências web interativas e sistemas publicados.', emoji: '🌐' },
];

export const portfolioItems: PortfolioItem[] = [
  {
    id: 'design-01',
    title: 'Arte Dark Ornamental',
    category: 'illustrations',
    assetPath: 'assets/portfolio/design-01.jpg',
    note: 'Composição sombria com ornamentos hipnóticos, alto contraste e presença do cavaleiro Llewxam.',
    technique: 'Ilustração Autoral • Contraste Dramático',
    serviceId: 'illustration',
  },
  {
    id: 'design-02',
    title: 'Concept Art • Moldura Dark',
    category: 'illustrations',
    assetPath: 'assets/portfolio/design-02.jpg',
    note: 'Direção de arte conceitual com atmosfera densa, iluminação realista e foco narrativo.',
    technique: 'Concept Art • Textura & Atmosfera',
    serviceId: 'illustration',
  },
  {
    id: 'design-03',
    title: 'Banner Esportivo • Cristiano Ronaldo',
    category: 'banners',
    assetPath: 'assets/portfolio/design-03.jpg',
    note: 'Peça de alto impacto com tipografia monumental, brasas em profundidade e recorte de luz.',
    technique: 'Manipulação HD • Iluminação & Tipografia',
    serviceId: 'banner',
  },
  {
    id: 'design-04',
    title: 'Poster Editorial • Kylian Mbappé',
    category: 'banners',
    assetPath: 'assets/portfolio/design-04.jpg',
    note: 'Poster esportivo com múltiplas camadas de textura, feixes cromáticos e dinamismo.',
    technique: 'Direção Esportiva • Color Grading',
    serviceId: 'banner',
  },
  {
    id: 'design-05',
    title: 'Personagem Autoral • Capacete & Visor',
    category: 'illustrations',
    assetPath: 'assets/portfolio/design-05.jpg',
    note: 'Pintura tradicional e digital de personagem com capacete e iluminação expressiva.',
    technique: 'Character Design • Aquarela & Nankim',
    serviceId: 'illustration',
  },
  {
    id: 'design-06',
    title: 'Header Multiplataforma • Cyber Red',
    category: 'banners',
    assetPath: 'assets/portfolio/design-06.jpg',
    note: 'Header para redes e comunidades conectando ícones com energia neon e foco central.',
    technique: 'Social Branding • Efeitos de Luz',
    serviceId: 'banner',
  },
  {
    id: 'design-07',
    title: 'Ilustração Dual • Anime & Contraste',
    category: 'illustrations',
    assetPath: 'assets/portfolio/design-07.jpg',
    note: 'Composição dividida entre sombra carmesim e céu vibrante com acabamento expressivo.',
    technique: 'Ilustração Estilizada • Dualidade de Luz',
    serviceId: 'illustration',
  },
  {
    id: 'design-08',
    title: 'Arte Conceitual • Coração Carmesim',
    category: 'illustrations',
    assetPath: 'assets/portfolio/design-08.jpg',
    note: 'Obra simbólica de alto impacto visual com reflexos líquidos e atmosfera cinematográfica.',
    technique: 'Arte Conceitual • Iluminação Dramática',
    serviceId: 'illustration',
  },
  {
    id: 'design-09',
    title: 'Logo & Mascote Oficial • Llewxam',
    category: 'logos',
    assetPath: 'assets/portfolio/design-09.jpg',
    note: 'Identidade visual oficial com o Cavaleiro Roxo, chamas azuis cel-shaded e estética pixel-glitch.',
    technique: 'Brand Identity • Pixel-Glitch & Mascote',
    serviceId: 'logo',
  },
  {
    id: 'design-10',
    title: 'Pack Visual • Style Ficcional',
    category: 'packs',
    assetPath: 'assets/portfolio/design-10.jpg',
    note: 'Sistema visual coeso com reflexo espelhado, tipografia oriental e direção de arte para lançamentos.',
    technique: 'Pack Visual Completo • Direção de Arte',
    serviceId: 'server_pack',
  },
  {
    id: 'design-11',
    title: 'Ilustração Autoral • Cavaleiro em Mosaico',
    category: 'illustrations',
    assetPath: 'assets/portfolio/design-11.jpg',
    note: 'Obra autoral texturizada em blocos geométricos contrastando armadura fria e manto carmesim.',
    technique: 'Arte Autoral • Textura Geométrica',
    serviceId: 'illustration',
  },
];

export const sitePortfolioItems: SitePortfolioItem[] = [];
