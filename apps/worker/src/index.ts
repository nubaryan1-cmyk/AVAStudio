import { PLATFORMS } from "@avastudio/shared/domain";

// AVAStudio worker — точка входа.
// Тяжёлые задачи (FFmpeg-рендер, постинг) добавляются на следующих этапах.
function main(): void {
  console.log(`AVAStudio worker alive (${PLATFORMS.length} platforms supported)`);
}

main();
process.exit(0);
