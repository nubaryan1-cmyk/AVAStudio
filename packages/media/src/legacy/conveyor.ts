/**
 * Multi-file conveyor planner (декартово произведение).
 * Мигрировано из FULL_AUTO.js, строки 86-96 (сборка reactions × flashes [× music]).
 */

export interface ConveyorJob {
  reaction: string;
  flash: string;
  music: string | null;
  index: number;
}

export function planConveyor(
  reactions: string[],
  flashes: string[],
  music: string[] = [],
): ConveyorJob[] {
  const jobs: ConveyorJob[] = [];
  let index = 0;
  for (const reaction of reactions) {
    for (const flash of flashes) {
      jobs.push({
        reaction,
        flash,
        music: music.length > 0 ? (music[index % music.length] ?? null) : null,
        index,
      });
      index += 1;
    }
  }
  return jobs;
}
