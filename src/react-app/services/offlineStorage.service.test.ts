import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import {
  write,
  read,
  clearUser,
  clearDelegado,
  clearAll,
  getLastSync,
  setLastSync,
  getCounts,
} from './offlineStorage.service';

// Reset IndexedDB between tests to avoid state leakage
beforeEach(() => {
  (globalThis as Record<string, unknown>).indexedDB = new IDBFactory();
});

const USER_A = 'user-a-uuid';
const USER_B = 'user-b-uuid';

describe('offlineStorage — write/read', () => {
  it('escreve e lê favoritos por userId', async () => {
    const data = [{ id: '1', nome: 'Arroz' }];
    await write('favoritos', USER_A, data);
    const result = await read('favoritos', USER_A);
    expect(result).toEqual(data);
  });

  it('escreve e lê customizadas por userId', async () => {
    const data = [{ id: '2', nome: 'Feijão custom' }];
    await write('customizadas', USER_A, data);
    const result = await read('customizadas', USER_A);
    expect(result).toEqual(data);
  });

  it('escreve e lê perfil por userId', async () => {
    const data = { nome: 'Maria', email: 'maria@test.com', limite_diario: 400 };
    await write('perfil', USER_A, data);
    const result = await read('perfil', USER_A);
    expect(result).toEqual(data);
  });

  it('escreve e lê histórico por userId', async () => {
    const data = [{ id: 'r1', data: '2026-10-12', fenil_mg: 120 }];
    await write('historico', USER_A, data);
    const result = await read('historico', USER_A);
    expect(result).toEqual(data);
  });

  it('retorna null para store não inicializada', async () => {
    const result = await read('favoritos', 'inexistente-user');
    expect(result).toBeNull();
  });

  it('substituição completa ao escrever novamente', async () => {
    await write('favoritos', USER_A, [{ id: '1' }]);
    await write('favoritos', USER_A, [{ id: '2' }, { id: '3' }]);
    const result = await read('favoritos', USER_A) as unknown[];
    expect(result).toHaveLength(2);
    expect(result).toEqual([{ id: '2' }, { id: '3' }]);
  });
});

describe('offlineStorage — isolamento entre usuários', () => {
  it('stores de user A não afetam stores de user B', async () => {
    await write('favoritos', USER_A, [{ id: 'a' }]);
    await write('favoritos', USER_B, [{ id: 'b' }]);

    const resultA = await read('favoritos', USER_A) as unknown[];
    const resultB = await read('favoritos', USER_B) as unknown[];

    expect(resultA).toEqual([{ id: 'a' }]);
    expect(resultB).toEqual([{ id: 'b' }]);
  });

  it('clearUser(A) não afeta dados de B', async () => {
    await write('favoritos', USER_A, [{ id: 'a' }]);
    await write('favoritos', USER_B, [{ id: 'b' }]);

    await clearUser(USER_A);

    const resultA = await read('favoritos', USER_A);
    const resultB = await read('favoritos', USER_B) as unknown[];

    expect(resultA).toBeNull();
    expect(resultB).toEqual([{ id: 'b' }]);
  });
});

describe('offlineStorage — clearUser', () => {
  it('limpa todas as stores do userId no logout', async () => {
    await write('favoritos', USER_A, [{ id: '1' }]);
    await write('customizadas', USER_A, [{ id: '2' }]);
    await write('historico', USER_A, [{ id: '3' }]);
    await write('perfil', USER_A, { nome: 'teste' });

    await clearUser(USER_A);

    expect(await read('favoritos', USER_A)).toBeNull();
    expect(await read('customizadas', USER_A)).toBeNull();
    expect(await read('historico', USER_A)).toBeNull();
    expect(await read('perfil', USER_A)).toBeNull();
  });
});

describe('offlineStorage — clearDelegado', () => {
  it('limpa stores do usuário delegado ao sair da delegação', async () => {
    const DELEGADO = 'delegado-uuid';
    await write('favoritos', DELEGADO, [{ id: 'x' }]);
    await write('perfil', DELEGADO, { nome: 'Delegado' });

    await clearDelegado(DELEGADO);

    expect(await read('favoritos', DELEGADO)).toBeNull();
    expect(await read('perfil', DELEGADO)).toBeNull();
  });
});

describe('offlineStorage — lastSync', () => {
  it('retorna null antes de setar', async () => {
    const result = await getLastSync(USER_A);
    expect(result).toBeNull();
  });

  it('persiste e lê data de sync', async () => {
    const now = new Date('2026-10-12T22:00:00.000Z');
    await setLastSync(USER_A, now);
    const result = await getLastSync(USER_A);
    expect(result?.toISOString()).toBe(now.toISOString());
  });

  it('clearUser apaga lastSync', async () => {
    await setLastSync(USER_A, new Date());
    await clearUser(USER_A);
    const result = await getLastSync(USER_A);
    expect(result).toBeNull();
  });
});

describe('offlineStorage — getCounts', () => {
  it('retorna zeros para userId sem dados', async () => {
    const counts = await getCounts('vazio-user');
    expect(counts.favoritos).toBe(0);
    expect(counts.customizadas).toBe(0);
    expect(counts.historico).toBe(0);
    expect(counts.lastSync).toBeNull();
  });

  it('retorna contagens corretas após escrita', async () => {
    await write('favoritos', USER_A, [{ id: '1' }, { id: '2' }]);
    await write('customizadas', USER_A, [{ id: '3' }]);
    await write('historico', USER_A, [
      { id: 'r1', data: '2026-10-06' },
      { id: 'r2', data: '2026-10-12' },
    ]);
    const now = new Date('2026-10-12T22:00:00.000Z');
    await setLastSync(USER_A, now);

    const counts = await getCounts(USER_A);
    expect(counts.favoritos).toBe(2);
    expect(counts.customizadas).toBe(1);
    expect(counts.historico).toBe(2);
    expect(counts.historicoInicio).toBe('2026-10-06');
    expect(counts.historicoFim).toBe('2026-10-12');
    expect(counts.lastSync?.toISOString()).toBe(now.toISOString());
  });
});
