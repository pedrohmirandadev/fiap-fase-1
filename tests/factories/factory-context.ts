/** Sequências e datas pertencem à fábrica de cada teste, sem estado global. */
export function createFactoryContext() {
  const sequences = new Map<string, number>();
  const digit = (base: string, weights: number[]) => {
    const remainder = [...base].reduce((sum, value, index) => sum + Number(value) * weights[index], 0) % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return {
    nextId(entity: string) {
      const next = (sequences.get(entity) ?? 0) + 1;
      sequences.set(entity, next);
      return next;
    },
    date: () => new Date('2026-01-01T12:00:00.000Z'),
    cpf(sequence: number) {
      const base = String(100000000 + sequence);
      const first = digit(base, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
      return base + first + digit(base + first, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    },
    cnpj(sequence: number) {
      const base = String(100000000000 + sequence);
      const first = digit(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
      return base + first + digit(base + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    },
    plate(sequence: number) {
      let number = sequence - 1;
      const suffix = String(number % 100).padStart(2, '0'); number = Math.floor(number / 100);
      const middle = String.fromCharCode(65 + number % 26); number = Math.floor(number / 26);
      const numeric = number % 10; number = Math.floor(number / 10);
      let prefix = '';
      for (let index = 0; index < 3; index++) {
        prefix = String.fromCharCode(65 + number % 26) + prefix;
        number = Math.floor(number / 26);
      }
      return `${prefix}${numeric}${middle}${suffix}`;
    }
  };
}

export type FactoryContext = ReturnType<typeof createFactoryContext>;
