import { supabase } from '@/react-app/lib/supabase';
import { readPending, removePending, PendingOp } from './offlineStorage.service';
import { logger } from '@/react-app/lib/logger';

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  discardedCount: number;
}

async function syncCreate(_userId: string, op: PendingOp): Promise<'ok' | 'archived_ref'> {
  const { data, error } = await supabase.rpc('fn_upsert_consumo_offline', {
    p_client_uuid: op.id,
    p_alimento_id: op.payload.alimento_id!,
    p_quantidade: op.payload.quantidade!,
    p_data_registro: op.payload.data!,
    p_hora_registro: op.payload.hora ?? '00:00:00',
  });

  if (error) throw error;

  const result = data as { status: string };
  if (result.status === 'archived_ref') return 'archived_ref';
  return 'ok';
}

async function syncDelete(userId: string, op: PendingOp): Promise<void> {
  const { error } = await supabase
    .from('registros')
    .delete()
    .eq('id', op.payload.registro_id!)
    .eq('usuario_id', userId);

  if (error) throw error;
}

export async function processarFilaSync(userId: string): Promise<SyncResult> {
  const ops = await readPending(userId);
  let syncedCount = 0;
  let discardedCount = 0;

  for (const op of ops) {
    try {
      if (op.type === 'create') {
        const outcome = await syncCreate(userId, op);
        await removePending(userId, op.id);
        if (outcome === 'archived_ref') {
          discardedCount++;
        } else {
          syncedCount++;
        }
      } else if (op.type === 'delete') {
        await syncDelete(userId, op);
        await removePending(userId, op.id);
        syncedCount++;
      }
    } catch (err) {
      logger.error('Sync failed', err);
      throw err;
    }
  }

  return { success: true, syncedCount, discardedCount };
}
