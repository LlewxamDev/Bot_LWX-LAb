export type PricingService = {
  id: string;
  label: string;
  short: string;
  basePrice: string;
  delivery: string;
  revisions: string;
  includes: string[];
  bestFor: string;
};

export const pricingServices: PricingService[] = [
  {
    id: 'banner',
    label: 'Banner',
    short: 'Impacto visual para Discord, YouTube, X/Twitter ou perfil.',
    basePrice: 'A partir de R$ 55',
    delivery: '1 a 3 dias',
    revisions: '2 ajustes leves inclusos',
    includes: ['Composicao visual', 'Tipografia', 'Export final em alta qualidade'],
    bestFor: 'Divulgar servidor, canal, perfil ou campanha.',
  },
  {
    id: 'logo',
    label: 'Logo',
    short: 'Marca visual limpa, memoravel e pronta para uso.',
    basePrice: 'A partir de R$ 90',
    delivery: '2 a 5 dias',
    revisions: '2 rodadas de ajuste',
    includes: ['Conceito visual', 'Versao principal', 'Arquivo transparente quando aplicavel'],
    bestFor: 'Servidores, marcas pessoais, projetos e comunidades.',
  },
  {
    id: 'divider',
    label: 'Barrinha / Divisoria',
    short: 'Separadores visuais para organizar canais e apresentacoes.',
    basePrice: 'A partir de R$ 35',
    delivery: '1 a 2 dias',
    revisions: '1 ajuste leve incluso',
    includes: ['Estilo alinhado ao tema', 'Tamanho otimizado', 'Export pronto para Discord'],
    bestFor: 'Deixar canais, regras e anuncios mais bonitos.',
  },
  {
    id: 'illustration',
    label: 'Ilustracao simples',
    short: 'Arte personalizada com composicao e acabamento estilizado.',
    basePrice: 'A partir de R$ 120',
    delivery: '3 a 7 dias',
    revisions: '2 ajustes conforme escopo',
    includes: ['Direcao visual', 'Arte final', 'Export para uso digital'],
    bestFor: 'Personagens, mascotes simples e pecas especiais.',
  },
  {
    id: 'uiux',
    label: 'UI/UX Screen',
    short: 'Tela ou interface organizada para produto, site ou app.',
    basePrice: 'A partir de R$ 160',
    delivery: '3 a 6 dias',
    revisions: '2 rodadas de ajuste',
    includes: ['Layout', 'Hierarquia visual', 'Componentes principais'],
    bestFor: 'Landing pages, dashboards, apps e ideias de produto.',
  },
  {
    id: 'site_one_page',
    label: 'Site one-page',
    short: 'Site de pagina unica com visual forte e responsivo.',
    basePrice: 'A partir de R$ 350',
    delivery: '5 a 10 dias',
    revisions: '2 rodadas de ajuste',
    includes: ['Layout responsivo', 'Codigo base', 'Publicacao combinada no ticket'],
    bestFor: 'Portfolio, apresentacao, comunidade ou produto pequeno.',
  },
  {
    id: 'site_complete',
    label: 'Site completo',
    short: 'Site com multiplas secoes/paginas e acabamento mais profundo.',
    basePrice: 'A partir de R$ 650',
    delivery: '10 a 20 dias',
    revisions: 'Escopo combinado no ticket',
    includes: ['Arquitetura visual', 'Paginas principais', 'Ajustes responsivos'],
    bestFor: 'Projetos maiores, marcas e produtos com mais conteudo.',
  },
  {
    id: 'server_pack',
    label: 'Pacote servidor / marca',
    short: 'Combo visual para deixar servidor ou marca consistente.',
    basePrice: 'A partir de R$ 220',
    delivery: '4 a 8 dias',
    revisions: '2 rodadas de ajuste',
    includes: ['Logo ou icone simples', 'Banner', 'Barrinhas/divisorias base'],
    bestFor: 'Lancar ou reformular um servidor com identidade visual.',
  },
  {
    id: 'bot_discord',
    label: 'Bot Discord',
    short: 'Bot personalizado para servidor com paineis, tickets e automacoes.',
    basePrice: 'A partir de R$ 480',
    delivery: '7 a 14 dias',
    revisions: '2 rodadas de ajuste',
    includes: ['Comandos e botoes', 'Paineis fixos', 'Config local e orientacao de deploy'],
    bestFor: 'Servidores que querem atendimento, portfolio, registro ou automacao.',
  },
  {
    id: 'bot_whatsapp',
    label: 'Bot WhatsApp',
    short: 'Automacao de atendimento no WhatsApp com fluxo e respostas guiadas.',
    basePrice: 'A partir de R$ 850',
    delivery: '10 a 18 dias',
    revisions: 'Escopo combinado no ticket',
    includes: ['Fluxo de conversa', 'Mensagens personalizadas', 'Integracao conforme API escolhida'],
    bestFor: 'Atendimento comercial, triagem de clientes e respostas rapidas.',
  },
  {
    id: 'complete_custom',
    label: 'Personalizacao completa',
    short: 'Site, bot, design, identidade visual e configuracao do servidor.',
    basePrice: 'A partir de R$ 1800',
    delivery: '20 a 35 dias',
    revisions: 'Acompanhamento por etapas',
    includes: ['Identidade visual', 'Site responsivo', 'Bot personalizado', 'Setup do servidor Discord'],
    bestFor: 'Criar uma presenca completa, bonita e pronta para receber clientes.',
  },
];
