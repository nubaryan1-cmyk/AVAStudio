// AVAStudio worker — точка входа.
// Тяжёлые задачи (FFmpeg-рендер, постинг) добавляются на следующих этапах.
function main(): void {
  console.log("AVAStudio worker alive");
}

main();
process.exit(0);
