export type PortfolioCategoryId = 'all' | 'banners' | 'logos' | 'illustrations' | 'packs' | 'uiux' | 'sites';

export type PortfolioCategory = {
  id: PortfolioCategoryId;
  label: string;
  description: string;
};

export type DesignPortfolioCategoryId = Exclude<PortfolioCategoryId, 'all' | 'sites'>;

export type PortfolioItem = {
  id: string;
  title: string;
  category: DesignPortfolioCategoryId;
  assetPath: string;
  note: string;
};

export type SitePortfolioItem = {
  id: string;
  title: string;
  url: string;
  note: string;
};

export const portfolioCategories: PortfolioCategory[] = [
  { id: 'all', label: 'Todos', description: 'Tudo que ja esta no arquivo visual.' },
  { id: 'banners', label: 'Banners', description: 'Pecas de impacto, capas e composicoes.' },
  { id: 'logos', label: 'Logos', description: 'Identidade visual, marca e mascote.' },
  { id: 'illustrations', label: 'Artes', description: 'Ilustracoes, personagens e artes conceituais.' },
  { id: 'packs', label: 'Packs', description: 'Capas, pacotes visuais e apresentacoes.' },
  { id: 'uiux', label: 'UI/UX', description: 'Interfaces, telas e layouts.' },
  { id: 'sites', label: 'Sites', description: 'Somente sites com link publico disponivel.' },
];

export const portfolioItems: PortfolioItem[] = [
  { id: 'design-01', title: 'Arte dark ornamental', category: 'illustrations', assetPath: 'assets/portfolio/design-01.jpg', note: 'Ilustracao/personagem do portfolio publico.' },
  { id: 'design-02', title: 'Arte em moldura dark', category: 'illustrations', assetPath: 'assets/portfolio/design-02.jpg', note: 'Arte conceitual do portfolio publico.' },
  { id: 'design-03', title: 'Banner Cristiano Ronaldo', category: 'banners', assetPath: 'assets/portfolio/design-03.jpg', note: 'Banner esportivo do portfolio publico.' },
  { id: 'design-04', title: 'Banner Mbappe', category: 'banners', assetPath: 'assets/portfolio/design-04.jpg', note: 'Poster/banner esportivo do portfolio publico.' },
  { id: 'design-05', title: 'Arte personagem com capacete', category: 'illustrations', assetPath: 'assets/portfolio/design-05.jpg', note: 'Arte de personagem do portfolio publico.' },
  { id: 'design-06', title: 'Banner social vermelho', category: 'banners', assetPath: 'assets/portfolio/design-06.jpg', note: 'Banner de perfil/plataformas do portfolio publico.' },
  { id: 'design-07', title: 'Arte personagem anime', category: 'illustrations', assetPath: 'assets/portfolio/design-07.jpg', note: 'Arte de personagem do portfolio publico.' },
  { id: 'design-08', title: 'Ilustracao coracao vermelho', category: 'illustrations', assetPath: 'assets/portfolio/design-08.jpg', note: 'Ilustracao conceitual do portfolio publico.' },
  { id: 'design-09', title: 'Logo Llewxam', category: 'logos', assetPath: 'assets/portfolio/design-09.jpg', note: 'Identidade/mascote do portfolio publico.' },
  { id: 'design-10', title: 'Pack style ficcional', category: 'packs', assetPath: 'assets/portfolio/design-10.jpg', note: 'Pack/capa visual do portfolio publico.' },
  { id: 'design-11', title: 'Arte personagem estilizado', category: 'illustrations', assetPath: 'assets/portfolio/design-11.jpg', note: 'Arte de personagem do portfolio publico.' },
];

export const sitePortfolioItems: SitePortfolioItem[] = [];
