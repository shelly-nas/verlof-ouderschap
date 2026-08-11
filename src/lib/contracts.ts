import { type DateOnly, formatDateNl, isWithinRange } from "./dates";

export type ContractLike = {
  id: string;
  employerName: string;
  employerEmail: string;
  hoursPerWeek: number;
  grossMonthlySalary: number;
  startDate: DateOnly;
  endDate: DateOnly | null;
};

/**
 * Het contract dat gold op een bepaalde dag. Bij overlappende contracten wint
 * het contract met de laatste startdatum — dat is het nieuwste dienstverband.
 * Geen match betekent dat er die dag geen contract was; de UI blokkeert dan de
 * invoer in plaats van stilzwijgend met verkeerde uren te rekenen.
 */
export function contractForDate<T extends ContractLike>(
  contracts: readonly T[],
  date: DateOnly,
): T | null {
  const matches = contracts.filter((contract) =>
    isWithinRange(date, contract.startDate, contract.endDate),
  );
  if (matches.length === 0) return null;
  return matches.reduce((latest, candidate) =>
    candidate.startDate > latest.startDate ? candidate : latest,
  );
}

/** Het contract dat vandaag geldt, of anders het meest recent gestarte. */
export function activeContract<T extends ContractLike>(
  contracts: readonly T[],
  today: DateOnly,
): T | null {
  const current = contractForDate(contracts, today);
  if (current) return current;
  if (contracts.length === 0) return null;
  return contracts.reduce((latest, candidate) =>
    candidate.startDate > latest.startDate ? candidate : latest,
  );
}

export function sortContracts<T extends ContractLike>(contracts: readonly T[]): T[] {
  return [...contracts].sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export type ContractOverlap = {
  a: ContractLike;
  b: ContractLike;
  message: string;
};

/**
 * Overlappende periodes zijn een waarschuwing, geen fout: twee dienstverbanden
 * tegelijk komt voor. Wel expliciet melden, want het beïnvloedt welk contract
 * aan een verlofdag hangt.
 */
export function findContractOverlaps(contracts: readonly ContractLike[]): ContractOverlap[] {
  const overlaps: ContractOverlap[] = [];
  const sorted = [...contracts].sort((a, b) => a.startDate.localeCompare(b.startDate));

  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      const a = sorted[i];
      const b = sorted[j];
      const aEnd = a.endDate;
      // b start later of gelijk; overlap als a nog loopt op b.startDate.
      if (aEnd === null || aEnd >= b.startDate) {
        overlaps.push({
          a,
          b,
          message: `"${a.employerName}" (vanaf ${formatDateNl(a.startDate)}) overlapt met "${b.employerName}" (vanaf ${formatDateNl(b.startDate)})`,
        });
      }
    }
  }
  return overlaps;
}

export function isContractValid(contract: {
  startDate: DateOnly;
  endDate: DateOnly | null;
}): boolean {
  return contract.endDate === null || contract.endDate >= contract.startDate;
}

/** Uren per werkdag, uitgaande van een vijfdaagse werkweek. */
export function hoursPerWorkday(contract: Pick<ContractLike, "hoursPerWeek">): number {
  return contract.hoursPerWeek / 5;
}

export function contractLabel(contract: ContractLike): string {
  const until = contract.endDate ? formatDateNl(contract.endDate) : "heden";
  return `${contract.employerName} (${formatDateNl(contract.startDate)} – ${until})`;
}
