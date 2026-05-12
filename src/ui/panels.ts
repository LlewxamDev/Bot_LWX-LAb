import {
  buildPortfolioOpenButton,
  buildPricingOpenButton,
  buildRegistrationOpenButton,
  buildReviewOpenButton,
  buildTicketButton,
} from './components';
import { buildTerminalEmbed } from './embeds';

export function buildRegistrationPanel() {
  return {
    embeds: [
      buildTerminalEmbed({
        command: 'lwx.register.start()',
        title: 'Registre-se no LWX Lab',
        description: 'Preencha seu acesso para liberar os canais principais e escolher se quer receber avisos.',
      }),
    ],
    components: [buildRegistrationOpenButton()],
  };
}

export function buildPortfolioPanel() {
  return {
    embeds: [
      buildTerminalEmbed({
        command: 'lwx.portfolio.open()',
        title: 'Arquivo de trabalhos',
        description: 'Escolha uma categoria e receba uma galeria privada, organizada e sem poluir o canal.',
      }),
    ],
    components: [buildPortfolioOpenButton()],
  };
}

export function buildPricingPanel() {
  return {
    embeds: [
      buildTerminalEmbed({
        command: 'lwx.pricing.inspect()',
        title: 'Tabela de precos',
        description: 'Selecione o servico para ver preco base, prazo, revisoes e como abrir um orcamento.',
      }),
    ],
    components: [buildPricingOpenButton()],
  };
}

export function buildReviewPanel() {
  return {
    embeds: [
      buildTerminalEmbed({
        command: 'lwx.review.rate()',
        title: 'Avalie sua experiencia',
        description: 'Clique para escolher estrelas e escrever um feedback. A avaliacao final aparece no canal de avaliacoes.',
      }),
    ],
    components: [buildReviewOpenButton()],
  };
}

export function buildBudgetPanel() {
  return {
    embeds: [
      buildTerminalEmbed({
        command: 'lwx.ticket.open()',
        title: 'Fazer um orcamento',
        description: 'Abra um ticket privado para explicar sua ideia, combinar escopo e receber atendimento.',
      }),
    ],
    components: [buildTicketButton()],
  };
}
