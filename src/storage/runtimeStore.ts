import fs from 'node:fs';
import path from 'node:path';

export type TicketState = {
  ownerId: string;
  serviceId: string;
  mode?: 'text' | 'call';
  callStatus?: 'not_requested' | 'pending' | 'accepted' | 'declined';
  status: 'open' | 'awaiting_review' | 'closed';
  assigneeId?: string;
  assigneeName?: string;
  voiceChannelId?: string;
};

export type RuntimeState = {
  panels: Record<string, string>;
  tickets: Record<string, TicketState>;
};

const runtimeDir = path.resolve('data/runtime');
const runtimePath = path.join(runtimeDir, 'state.json');

export function createDefaultRuntimeState(): RuntimeState {
  return { panels: {}, tickets: {} };
}

export function loadRuntimeState(): RuntimeState {
  if (!fs.existsSync(runtimePath)) return createDefaultRuntimeState();

  return {
    ...createDefaultRuntimeState(),
    ...JSON.parse(fs.readFileSync(runtimePath, 'utf8')),
  };
}

export function saveRuntimeState(state: RuntimeState) {
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.writeFileSync(runtimePath, JSON.stringify(state, null, 2));
}
