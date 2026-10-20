import { mock, type Mock } from 'bun:test';

type AsyncMethod = (...args: never[]) => Promise<unknown>;

/** A interseção mantém a assinatura genérica de portas como UnitOfWork.run. */
export type MethodMock<T extends AsyncMethod> = T & Mock<T>;
export type MockedPort<T> = { [K in keyof T]: T[K] extends AsyncMethod ? MethodMock<T[K]> : never };

/** Cada ambiente possui seu próprio registro; nenhuma função global do Bun é alterada. */
export function createMockScope() {
  const clearActions: Array<() => void> = [];
  const resetActions: Array<() => void> = [];

  function method<T extends AsyncMethod>(name: string, implementation?: T): MethodMock<T> {
    const initial = implementation ?? (async (..._args: Parameters<T>) => {
      throw new Error(`Mock não configurado: ${name}. Configure o retorno ou a implementação neste teste.`);
    }) as unknown as T;
    const fn = mock(initial).mockName(name) as MethodMock<T>;
    clearActions.push(() => { fn.mockClear(); });
    resetActions.push(() => { fn.mockReset(); fn.mockImplementation(initial); });
    return fn;
  }

  return {
    method,
    clearMocks() { clearActions.forEach(clear => clear()); },
    resetMocks() { resetActions.forEach(reset => reset()); }
  };
}

export type MockScope = ReturnType<typeof createMockScope>;
