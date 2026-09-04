import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "@/react-app/lib/errors";

// 👉 mock do supabase ANTES do import do service
vi.mock("@/react-app/lib/supabase", () => {
  return {
    supabase: {
      from: vi.fn(),
      rpc: vi.fn(),
    },
  };
});

import { supabase } from "@/react-app/lib/supabase";
import {
  getReferencias,
  createReferencia,
  updateReferencia,
  activateReferencia,
  deleteOrDeactivateReferencia,
} from "./referencias.service";

type Fn = ReturnType<typeof vi.fn>;

interface Builder {
  select: Fn;
  or: Fn;
  in: Fn;
  eq: Fn;
  ilike: Fn;
  order: Fn;
  update: Fn;
  insert: Fn;
  delete: Fn;
  single: Fn;
  maybeSingle: Fn;
  range: Fn;
}

/**
 * Builder encadeável EXPLÍCITO do cliente supabase (sem Proxy): métodos de
 * cadeia (select/or/in/eq/order/update/insert/delete) retornam o próprio
 * builder; os terminais (single/maybeSingle/range) resolvem o valor
 * configurado por teste. O contrato espelha o service real:
 *  - cadeia de favoritos: ...select().eq() — resolve no .eq()
 *  - create: ...insert().select().single() — resolve no .single()
 *  - update: ...update().eq().select() — resolve no .select()
 *  - getReferencias: ...range() — resolve no .range()
 */
function criarBuilder(): Builder {
  const b = {} as Builder;

  // Cada método de cadeia é uma vi.fn PRÓPRIA que devolve o builder — assim
  // sobrescrever um método (ex.: select terminal do update) não contamina os
  // demais.
  b.select = vi.fn(() => b);
  b.or = vi.fn(() => b);
  b.in = vi.fn(() => b);
  b.eq = vi.fn(() => b);
  b.ilike = vi.fn(() => b);
  b.order = vi.fn(() => b);
  b.update = vi.fn(() => b);
  b.insert = vi.fn(() => b);
  b.delete = vi.fn(() => b);

  b.single = vi.fn().mockResolvedValue({ data: null, error: null });
  b.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  b.range = vi.fn().mockResolvedValue({ data: [], error: null });

  return b;
}

const from = supabase.from as unknown as Fn;
const rpc = supabase.rpc as unknown as Fn;

describe("referencias.service", () => {
  beforeEach(() => {
    from.mockReset();
    rpc.mockReset();
  });

  describe("getReferencias", () => {
    const seed = [
      { id: "1", nome: "Arroz", marca: "Tio João", fenil_mg_por_100g: 50, is_global: true, is_ativa: true, criado_por: null },
      { id: "2", nome: "Arroz", marca: "Produto In Natura", fenil_mg_por_100g: 48, is_global: true, is_ativa: true, criado_por: null },
    ];

    /** Favoritos do usuário resolvem no .eq() (sem terminal, como no service). */
    function mockFavoritos(favoritos: unknown[]): Builder {
      const fav = criarBuilder();
      fav.eq.mockResolvedValue({ data: favoritos, error: null });
      return fav;
    }

    /** Query principal de referências resolve no .range(). */
    function mockRange(data: unknown[]): Builder {
      const main = criarBuilder();
      main.range.mockResolvedValue({ data, error: null });
      return main;
    }

    it("busca nome E marca no termo de busca (.or) e devolve is_favorita", async () => {
      const fav = mockFavoritos([]);
      const main = mockRange(seed);
      from.mockReturnValueOnce(fav).mockReturnValueOnce(main);

      const result = await getReferencias({ usuarioId: "123", search: "Ar" });

      expect(from).toHaveBeenNthCalledWith(1, "referencias_favoritas");
      expect(from).toHaveBeenNthCalledWith(2, "referencias");
      expect(fav.select).toHaveBeenCalledWith("referencia_id");
      expect(fav.eq).toHaveBeenCalledWith("usuario_id", "123");
      expect(main.select).toHaveBeenCalledWith(expect.stringContaining("marca"));
      expect(main.or).toHaveBeenCalledWith(
        "is_global.eq.true,criado_por.eq.123"
      );
      expect(main.or).toHaveBeenCalledWith(
        "nome.ilike.%Ar%,marca.ilike.%Ar%"
      );
      expect(main.eq).toHaveBeenCalledWith("is_ativa", true);
      expect(main.order).toHaveBeenCalledWith("nome", { ascending: true });
      expect(main.range).toHaveBeenCalledWith(0, 999);

      expect(result).toEqual([
        { ...seed[0], is_favorita: false },
        { ...seed[1], is_favorita: false },
      ]);
    });

    it("remove aspas do termo antes do filtro .or (parser PostgREST)", async () => {
      const fav = mockFavoritos([]);
      const main = mockRange([]);
      from.mockReturnValueOnce(fav).mockReturnValueOnce(main);

      await getReferencias({
        usuarioId: "123",
        search: 'Arroz "Parboilizado"',
      });

      expect(main.or).toHaveBeenCalledWith(
        "nome.ilike.%Arroz Parboilizado%,marca.ilike.%Arroz Parboilizado%"
      );
    });

    it("sem busca, não aplica filtro .or de termo (apenas escopo global/pessoal)", async () => {
      const fav = mockFavoritos([]);
      const main = mockRange([]);
      from.mockReturnValueOnce(fav).mockReturnValueOnce(main);

      await getReferencias({ usuarioId: "123" });

      expect(main.or).toHaveBeenCalledTimes(1);
      expect(main.or).toHaveBeenCalledWith(
        "is_global.eq.true,criado_por.eq.123"
      );
    });

    it("onlyFavoritas com favoritos aplica filtro in(id) e marca is_favorita", async () => {
      const fav = mockFavoritos([
        { referencia_id: "1" },
        { referencia_id: "2" },
      ]);
      const main = mockRange(seed);
      from.mockReturnValueOnce(fav).mockReturnValueOnce(main);

      const result = await getReferencias({
        usuarioId: "123",
        onlyFavoritas: true,
      });

      expect(main.in).toHaveBeenCalledWith("id", ["1", "2"]);
      expect(main.or).not.toHaveBeenCalled();
      expect(result).toEqual([
        { ...seed[0], is_favorita: true },
        { ...seed[1], is_favorita: true },
      ]);
    });

    it("onlyFavoritas sem favoritos retorna vazio sem executar query de dados de referencias", async () => {
      const fav = mockFavoritos([]);
      from.mockReturnValue(fav);

      const result = await getReferencias({
        usuarioId: "123",
        onlyFavoritas: true,
      });

      expect(result).toEqual([]);
      // O early-return ocorre depois da construção do select base (from +
      // select) mas ANTES de qualquer filtro/execução: o .eq() só foi usado no
      // filtro de favoritos e nenhuma query de dados (or/in/eq de escopo,
      // order/range) chegou a rodar sobre a tabela referencias.
      expect(fav.eq).toHaveBeenCalledTimes(1);
      expect(fav.eq).toHaveBeenCalledWith("usuario_id", "123");
      expect(fav.or).not.toHaveBeenCalled();
      expect(fav.in).not.toHaveBeenCalled();
      expect(fav.range).not.toHaveBeenCalled();
    });

    it("deve lançar AppError se a consulta de favoritos falhar", async () => {
      const fav = criarBuilder();
      fav.eq.mockRejectedValue(new Error("DB error"));
      from.mockReturnValue(fav);

      await expect(
        getReferencias({ usuarioId: "123" })
      ).rejects.toBeInstanceOf(AppError);
    });
  });

  describe("createReferencia", () => {
    /** from("referencias") → insert(payload) → select() → single() → {data}. */
    function mockCreate(data: unknown, error: unknown = null) {
      const b = criarBuilder();
      b.single.mockResolvedValue({ data, error });
      from.mockReturnValue(b);
      return b;
    }

    it("sem marca informada, persiste o canônico 'Produto In Natura'", async () => {
      const returned = {
        id: "1", nome: "Banana", marca: "Produto In Natura",
        fenil_mg_por_100g: 30, is_global: false,
      };
      const b = mockCreate(returned);

      const result = await createReferencia({
        nome: "Banana",
        fenil_mg_por_100g: 30,
        usuarioId: "123",
      });

      expect(from).toHaveBeenCalledWith("referencias");
      expect(b.insert).toHaveBeenCalledWith({
        nome: "Banana",
        marca: "Produto In Natura",
        fenil_mg_por_100g: 30,
        criado_por: "123",
        is_global: false,
      });
      expect(result).toMatchObject({
        ...returned,
        criado_por: undefined,
        is_favorita: false,
        is_ativa: true,
      });
    });

    it("promove a marca do campo quando informada", async () => {
      const b = mockCreate({
        id: "2", nome: "Arroz", marca: "Tio João", fenil_mg_por_100g: 48,
        is_global: false,
      });

      await createReferencia({
        nome: "Arroz",
        marca: "Tio João",
        fenil_mg_por_100g: 48,
        usuarioId: "123",
      });

      expect(b.insert).toHaveBeenCalledWith({
        nome: "Arroz",
        marca: "Tio João",
        fenil_mg_por_100g: 48,
        criado_por: "123",
        is_global: false,
      });
    });

    it("remove sufixo legado '(Marca: ...)' do nome e extrai a marca", async () => {
      const b = mockCreate({
        id: "3", nome: "Arroz", marca: "Tio João", fenil_mg_por_100g: 48,
        is_global: false,
      });

      await createReferencia({
        nome: "Arroz (Marca: Tio João)",
        fenil_mg_por_100g: 48,
        usuarioId: "123",
      });

      expect(b.insert).toHaveBeenCalledWith({
        nome: "Arroz",
        marca: "Tio João",
        fenil_mg_por_100g: 48,
        criado_por: "123",
        is_global: false,
      });
    });

    it("mapeia violação 23505 para AppError REFERENCIA_DUPLICADA", async () => {
      mockCreate(null, { code: "23505", message: "duplicate key value" });

      const err = await createReferencia({
        nome: "Banana", fenil_mg_por_100g: 30, usuarioId: "123",
      }).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("REFERENCIA_DUPLICADA");
    });

    it("deve lançar AppError se falhar ao criar referência", async () => {
      mockCreate(null, new Error("Insert error"));

      await expect(
        createReferencia({
          nome: "Erro", fenil_mg_por_100g: 10, usuarioId: "123",
        })
      ).rejects.toBeInstanceOf(AppError);
    });
  });

  describe("updateReferencia", () => {
    /**
     * Dois builders independentes, como no service real:
     * 1ª from() = guarda assertReferenciaEditavel
     *   (select("is_global") → eq("id") → maybeSingle);
     * 2ª from() = update (update → eq("id") → select — resolve no .select()).
     */
    function mockUpdateFlow(global: boolean, selectResult: unknown) {
      const guard = criarBuilder();
      guard.maybeSingle.mockResolvedValue({
        data: global ? { is_global: true } : { is_global: false },
        error: null,
      });
      const upd = criarBuilder();
      upd.select.mockResolvedValue(selectResult);

      from.mockReturnValueOnce(guard).mockReturnValueOnce(upd);
      return { guard, upd };
    }

    it("permite editar referência pessoal (identidade sanitizada)", async () => {
      const { guard, upd } = mockUpdateFlow(false, {
        data: [{ id: "1", nome: "Banana", marca: "Produto In Natura" }],
        error: null,
      });

      await updateReferencia("1", {
        nome: "Banana",
        marca: "",
        fenil_mg_por_100g: 31,
      });

      expect(guard.select).toHaveBeenCalledWith("is_global");
      expect(guard.eq).toHaveBeenCalledWith("id", "1");
      expect(upd.update).toHaveBeenCalledWith({
        nome: "Banana",
        marca: "Produto In Natura",
        fenil_mg_por_100g: 31,
      });
      expect(upd.eq).toHaveBeenCalledWith("id", "1");
    });

    it("bloqueia edição de referência GLOBAL (REFERENCIA_GLOBAL_IMUTAVEL)", async () => {
      const guard = criarBuilder();
      guard.maybeSingle.mockResolvedValue({
        data: { is_global: true },
        error: null,
      });
      // A guarda lança antes do segundo from() — apenas um fluxo é consumido.
      from.mockReturnValueOnce(guard);

      const err = await updateReferencia("global-1", {
        nome: "Outro Nome",
        fenil_mg_por_100g: 99,
      }).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("REFERENCIA_GLOBAL_IMUTAVEL");
      expect(guard.maybeSingle).toHaveBeenCalled();
      expect(from).toHaveBeenCalledTimes(1);
    });

    it("lança REFERENCIA_DUPLICADA em violação 23505 no update", async () => {
      mockUpdateFlow(false, {
        data: null,
        error: { code: "23505", message: "duplicate key" },
      });

      const err = await updateReferencia("1", {
        nome: "Arroz", fenil_mg_por_100g: 48,
      }).catch((e: unknown) => e);

      expect((err as AppError).code).toBe("REFERENCIA_DUPLICADA");
    });

    it("lança REFERENCIA_UPDATE_NOT_ALLOWED quando nada é retornado", async () => {
      mockUpdateFlow(false, { data: [], error: null });

      const err = await updateReferencia("1", {
        nome: "Arroz", fenil_mg_por_100g: 48,
      }).catch((e: unknown) => e);

      expect((err as AppError).code).toBe("REFERENCIA_UPDATE_NOT_ALLOWED");
    });
  });

  describe("RPCs (ativar / remover-ou-desativar)", () => {
    it("activateReferencia chama rpc ativar_referencia", async () => {
      rpc.mockResolvedValue({ data: "activated", error: null });

      const data = await activateReferencia("r1");

      expect(rpc).toHaveBeenCalledWith("ativar_referencia", {
        p_referencia_id: "r1",
      });
      expect(data).toBe("activated");
    });

    it("deleteOrDeactivateReferencia chama rpc remover_ou_desativar_referencia e retorna o resultado", async () => {
      rpc.mockResolvedValue({ data: "deactivated", error: null });

      const data = await deleteOrDeactivateReferencia("r1");

      expect(rpc).toHaveBeenCalledWith("remover_ou_desativar_referencia", {
        p_referencia_id: "r1",
      });
      expect(data).toBe("deactivated");
    });

    it("erro do rpc vira AppError", async () => {
      rpc.mockResolvedValue({ data: null, error: new Error("rpc error") });

      await expect(deleteOrDeactivateReferencia("r1")).rejects.toBeInstanceOf(
        AppError
      );
    });
  });
});
