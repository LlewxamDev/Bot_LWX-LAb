import {
  MessageFlags,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type GuildMember,
  type User,
} from 'discord.js';
import { BOT_CONFIG } from '../config/botConfig.js';
import { createWelcomeOnboardingRow } from '../ui/components.js';
import { collectBrandFiles, createStudioEmbed, getBrandAttachmentUrl } from '../ui/embeds.js';
import { em } from '../ui/emojis.js';
import { getOrdersForUser } from './orders.js';

export async function handleRegisterVerifyButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) {
    await interaction.reply({
      content: 'Esta ação só pode ser utilizada dentro do servidor.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const member: GuildMember = interaction.member;
  const roleId = BOT_CONFIG.roles.verified;
  const role = interaction.guild.roles.cache.get(roleId) ?? (await interaction.guild.roles.fetch(roleId));

  if (!role) {
    await interaction.reply({
      embeds: [
        createStudioEmbed('danger')
          .setTitle('Configuração de Cargo Pendente')
          .setDescription(`> Não foi possível localizar o cargo (\`${roleId}\`). Avise a equipe do servidor.`),
      ],
      files: collectBrandFiles(['emblem']),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const files = collectBrandFiles(['emblem', 'animatedEmblem', 'divider']);

  if (member.roles.cache.has(role.id)) {
    const alreadyEmbed = createStudioEmbed('secondary')
      .setThumbnail(getBrandAttachmentUrl('animatedEmblem'))
      .setImage(getBrandAttachmentUrl('divider'))
      .setTitle('Credencial Já Ativa • LWX Lab')
      .setDescription(
        [
          `> ${em('verify')} Olá, ${member}! Seu acesso como <@&${role.id}> já está ativo no **LWX Lab**.`,
          '',
          `### ${em('spark')} Atalhos Rápidos do Estúdio`,
          `${em('palette')} **Portfólio Oficial:** <#${BOT_CONFIG.channels.portfolio}>`,
          `${em('flame')} **Tabela de Investimento:** <#${BOT_CONFIG.channels.pricing}>`,
          `${em('ticket')} **Central de Orçamentos:** <#${BOT_CONFIG.channels.budget}>`,
        ].join('\n'),
      );

    await interaction.reply({
      embeds: [alreadyEmbed],
      files,
      components: [createWelcomeOnboardingRow()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await member.roles.add(role, 'Registro automático LWX Lab');

  const verifiedEmbed = createStudioEmbed('primary')
    .setThumbnail(getBrandAttachmentUrl('animatedEmblem'))
    .setImage(getBrandAttachmentUrl('divider'))
    .setTitle('Acesso Liberado • Bem-vindo ao LWX Lab!')
    .setDescription(
      [
        `> ${em('knight')} Seja muito bem-vindo(a), ${member}! Sua credencial <@&${role.id}> foi ativada.`,
        '',
        `### ${em('crown')} Onde ir agora?`,
        `${em('palette')} Explore nossas obras em <#${BOT_CONFIG.channels.portfolio}>`,
        `${em('flame')} Consulte prazos e valores em <#${BOT_CONFIG.channels.pricing}>`,
        `${em('ticket')} Solicite seu projeto exclusivo em <#${BOT_CONFIG.channels.budget}>`,
      ].join('\n'),
    );

  await interaction.reply({
    embeds: [verifiedEmbed],
    files,
    components: [createWelcomeOnboardingRow()],
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleRegisterRoleToggleButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) {
    await interaction.reply({
      content: 'Esta ação só pode ser utilizada dentro do servidor.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const isAvisos = interaction.customId === BOT_CONFIG.customIds.registerAvisos;
  const roleId = isAvisos ? BOT_CONFIG.roles.avisos : BOT_CONFIG.roles.notificacoes;
  const label = isAvisos ? 'Avisos LWX' : 'Drops & Eventos';

  const member = interaction.member;
  const hasRole = member.roles.cache.has(roleId);

  try {
    if (hasRole) {
      await member.roles.remove(roleId, 'Toggle de cargo de notificação no painel');
    } else {
      await member.roles.add(roleId, 'Toggle de cargo de notificação no painel');
    }

    const embed = createStudioEmbed(hasRole ? 'warning' : 'secondary')
      .setTitle(hasRole ? `Radar Desativado • ${label}` : `Radar Ativado • ${label}`)
      .setDescription(
        hasRole
          ? `> ${em('spark')} O cargo <@&${roleId}> foi removido do seu perfil. Clique novamente quando quiser reativar.`
          : `> ${em('flame')} O cargo <@&${roleId}> foi adicionado ao seu perfil! Você será avisado nas novidades do estúdio.`,
      );

    await interaction.reply({
      embeds: [embed],
      files: collectBrandFiles(['emblem']),
      flags: MessageFlags.Ephemeral,
    });
  } catch {
    await interaction.reply({
      content: `Não foi possível atualizar o cargo **${label}** no momento.`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

export async function handleMemberProfileInteraction(
  interaction: ButtonInteraction | ChatInputCommandInteraction,
): Promise<void> {
  const targetUser: User =
    interaction.isChatInputCommand() && interaction.options.getUser('membro')
      ? interaction.options.getUser('membro', true)
      : interaction.user;

  const member = interaction.guild
    ? await interaction.guild.members.fetch(targetUser.id).catch(() => null)
    : null;

  const orders = getOrdersForUser(targetUser.id);
  const activeOrders = orders.filter((o) => o.stage !== 'delivered');

  const rolesList = member
    ? member.roles.cache
        .filter((r) => r.id !== interaction.guild?.id)
        .map((r) => `<@&${r.id}>`)
        .join(' ') || 'Nenhum cargo atribuído'
    : 'Membro do servidor';

  const ordersText =
    orders.length > 0
      ? orders
          .slice(-3)
          .map((o) => `${em('flame')} **#${o.id}** — ${o.service} *(${o.stage.toUpperCase()})*`)
          .join('\n')
      : 'Nenhuma encomenda registrada até o momento.';

  const joinedText = member?.joinedTimestamp
    ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D> (<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)`
    : 'Recente';

  const embed = createStudioEmbed('primary')
    .setThumbnail(targetUser.displayAvatarURL({ extension: 'png', size: 256 }))
    .setImage(getBrandAttachmentUrl('divider'))
    .setTitle(`Cartão de Membro & Cliente • ${targetUser.username}`)
    .setDescription(
      [
        `> ${em('knight')} **Dossiê oficial no estúdio LWX Lab.**`,
        `> Acompanhe suas credenciais, cargos ativos e histórico de encomendas.`,
      ].join('\n'),
    )
    .addFields(
      {
        name: `${em('verify')} Status de Acesso`,
        value: member?.roles.cache.has(BOT_CONFIG.roles.verified) ? '**Verificado**' : 'Pendente de Registro',
        inline: true,
      },
      {
        name: `${em('crown')} Entrada no Estúdio`,
        value: joinedText,
        inline: true,
      },
      {
        name: `${em('ticket')} Pedidos Ativos`,
        value: `**${activeOrders.length}** em produção (${orders.length} total)`,
        inline: true,
      },
      {
        name: `${em('spark')} Cargos no Servidor`,
        value: rolesList,
        inline: false,
      },
      {
        name: `${em('palette')} Histórico Recente de Encomendas`,
        value: ordersText,
        inline: false,
      },
    );

  await interaction.reply({
    embeds: [embed],
    files: collectBrandFiles(['emblem', 'divider']),
    components: [createWelcomeOnboardingRow()],
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleRulesAcceptButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) {
    await interaction.reply({
      content: 'Esta ação só pode ser utilizada dentro do servidor.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const member = interaction.member;
  const roleId = BOT_CONFIG.roles.verified;
  const role = interaction.guild.roles.cache.get(roleId) ?? (await interaction.guild.roles.fetch(roleId));

  if (role && !member.roles.cache.has(role.id)) {
    await member.roles.add(role, 'Aceite das Diretrizes e Termos LWX Lab').catch(() => undefined);
  }

  const embed = createStudioEmbed('primary')
    .setThumbnail(getBrandAttachmentUrl('animatedEmblem'))
    .setImage(getBrandAttachmentUrl('divider'))
    .setTitle('Termos & Diretrizes Confirmados • LWX Lab')
    .setDescription(
      [
        `> ${em('verify')} Obrigado pela leitura e confirmação, ${member}!`,
        '> Você está 100% alinhado às diretrizes de convivência e aos termos de encomenda do **LWX Lab**.',
        '',
        `### ${em('spark')} Próximos Passos`,
        `${em('palette')} Explore o acervo em <#${BOT_CONFIG.channels.portfolio}>`,
        `${em('flame')} Veja os novos preços acessíveis em <#${BOT_CONFIG.channels.pricing}>`,
        `${em('ticket')} Abra seu pedido em <#${BOT_CONFIG.channels.budget}>`,
      ].join('\n'),
    );

  await interaction.reply({
    embeds: [embed],
    files: collectBrandFiles(['emblem', 'animatedEmblem', 'divider']),
    components: [createWelcomeOnboardingRow()],
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleRulesFaqButton(interaction: ButtonInteraction): Promise<void> {
  const embed = createStudioEmbed('secondary')
    .setThumbnail(getBrandAttachmentUrl('animatedEmblem'))
    .setImage(getBrandAttachmentUrl('divider'))
    .setTitle('Dúvidas Frequentes (FAQ) • LWX Lab')
    .setDescription(
      [
        `> ${em('spark')} **Respostas rápidas sobre como funcionam as comissões e entregas no estúdio:**`,
      ].join('\n'),
    )
    .addFields(
      {
        name: `${em('ticket')} 1. Como faço um pedido?`,
        value: `Vá até <#${BOT_CONFIG.channels.budget}> e clique no serviço desejado. Uma sala privada será criada imediatamente para você conversar direto com **Llewxam**.`,
        inline: false,
      },
      {
        name: `${em('flame')} 2. Quais são as formas de pagamento e prazos?`,
        value: 'Trabalhamos com PIX e combinamos tudo de forma transparente dentro do seu ticket privado. Prazos médios variam de **24h a 5 dias** conforme a peça.',
        inline: false,
      },
      {
        name: `${em('palette')} 3. E se eu ainda não souber exatamente como quero a arte?`,
        value: 'Você pode usar o canal da **Silia AI** e clicar em **Aprimorar Ideia com Silia AI**! Ela ajuda você a escolher cores, estilo e monta o briefing para você.',
        inline: false,
      },
      {
        name: `${em('verify')} 4. Como funcionam as revisões?`,
        value: 'Você recebe prévias durante a criação (esboço e iluminação) e tem rodadas de ajustes inclusas para garantir que o resultado fique exatamente no seu gosto.',
        inline: false,
      },
    );

  await interaction.reply({
    embeds: [embed],
    files: collectBrandFiles(['emblem', 'animatedEmblem', 'divider']),
    flags: MessageFlags.Ephemeral,
  });
}
