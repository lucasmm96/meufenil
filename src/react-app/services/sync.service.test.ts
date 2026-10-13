import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/react-app/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

vi.mock('./offlineStorage.service', () => ({
  readPending: vi.fn(),
  removePending: vi.fn(),
}));

import { processarFilaSync } from './sync.service';
import { supabase } from '@/react-app/lib/supabase';
import { readPending, removePending } from './offlineStorage.service';

const mockReadPending = readPending as ReturnType<typeof vi.fn>;
const mockRemovePending = removePending as ReturnType<typeof vi.fn>;
const mockRpc = supabase.rpc as ReturnType<typeof vi.fn>;
const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

const USER_ID = 'user-test-uuid';

function makePendingCreate(id: string) {
  return {
    id,
    userId: USER_ID,
    type: 'create' as const,
    payload: {
      alimento_id: 'alim-uuid',
      quantidade: 100,
      data: '2026-10-12',
      hora: '12:00:00',
      fenil_mg: 150,
    },
    timestamp: new Date().toISOString(),
    retries: 0,
  };
}

function makePendingDelete(id: string, registroId: string) {
  return {
    id,
    userId: USER_ID,
    type: 'delete' as const,
    payload: { registro_id: registroId },
    timestamp: new Date().toISOString(),
    retries: 0,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRemovePending.mockResolvedValue(undefined);
});

describe('processarFilaSync', () => {
  it('retorna zeros para fila vazia', async () => {
    mockReadPending.mockResolvedValue([]);

    const result = await processarFilaSync(USER_ID);

    expect(result).toEqual({ success: true, syncedCount: 0, discardedCount: 0 });
    expect(mockRemovePending).not.toHaveBeenCalled();
  });

  it('sincroniza CREATE com sucesso', async () => {
    const op = makePendingCreate('client-uuid-1');
    mockReadPending.mockResolvedValue([op]);
    mockRpc.mockResolvedValue({ data: { status: 'created' }, error: null });

    const result = await processarFilaSync(USER_ID);

    expect(result).toEqual({ success: true, syncedCount: 1, discardedCount: 0 });
    expect(mockRpc).toHaveBeenCalledWith('fn_upsert_consumo_offline', {
      p_client_uuid: 'client-uuid-1',
      p_alimento_id: 'alim-uuid',
      p_quantidade: 100,
      p_data_registro: '2026-10-12',
      p_hora_registro: '12:00:00',
    });
    expect(mockRemovePending).toHaveBeenCalledWith(USER_ID, 'client-uuid-1');
  });

  it('descarta CREATE quando alimento arquivado (archived_ref)', async () => {
    const op = makePendingCreate('client-uuid-2');
    mockReadPending.mockResolvedValue([op]);
    mockRpc.mockResolvedValue({ data: { status: 'archived_ref' }, error: null });

    const result = await processarFilaSync(USER_ID);

    expect(result).toEqual({ success: true, syncedCount: 0, discardedCount: 1 });
    expect(mockRemovePending).toHaveBeenCalledWith(USER_ID, 'client-uuid-2');
  });

  it('sincroniza DELETE com sucesso', async () => {
    const op = makePendingDelete('del-op-id', 'registro-uuid-1');
    mockReadPending.mockResolvedValue([op]);

    const eqFn = vi.fn().mockReturnThis();
    const deleteFn = vi.fn().mockReturnValue({ eq: eqFn });
    eqFn.mockImplementationOnce(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
    mockFrom.mockReturnValue({ delete: deleteFn });

    const result = await processarFilaSync(USER_ID);

    expect(result).toEqual({ success: true, syncedCount: 1, discardedCount: 0 });
    expect(mockRemovePending).toHaveBeenCalledWith(USER_ID, 'del-op-id');
  });

  it('lança erro de rede e preserva a fila', async () => {
    const op = makePendingCreate('client-uuid-3');
    mockReadPending.mockResolvedValue([op]);
    mockRpc.mockResolvedValue({ data: null, error: new Error('Network error') });

    await expect(processarFilaSync(USER_ID)).rejects.toThrow('Network error');
    expect(mockRemovePending).not.toHaveBeenCalled();
  });

  it('processa múltiplas ops em ordem', async () => {
    const op1 = makePendingCreate('uuid-1');
    const op2 = makePendingCreate('uuid-2');
    mockReadPending.mockResolvedValue([op1, op2]);
    mockRpc
      .mockResolvedValueOnce({ data: { status: 'created' }, error: null })
      .mockResolvedValueOnce({ data: { status: 'archived_ref' }, error: null });

    const result = await processarFilaSync(USER_ID);

    expect(result).toEqual({ success: true, syncedCount: 1, discardedCount: 1 });
    expect(mockRemovePending).toHaveBeenCalledTimes(2);
  });
});
