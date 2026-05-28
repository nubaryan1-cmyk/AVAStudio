const fs = require("fs");
const path = require("path");
const { spawn, execSync } = require("child_process");

const PATHS = {
  SOURCE_FLASH: "D:\\FFMPEG\\Source\\flash",
  WORK_FLASH: "D:\\FFMPEG\\work\\in\\flash",
  WORK_REACTION: "D:\\FFMPEG\\work\\in\\reaction",
  WORK_MUSIC: "D:\\FFMPEG\\work\\in\\music",
  OUT_TEST: "D:\\FFMPEG\\work\\out_test",
  SMART_SCRIPT: "D:\\FFMPEG\\panel\\bot\\smart_scan.py",
  FFMPEG: "D:\\FFMPEG\\downloads\\ffmpeg-8.0.1-essentials_build\\bin\\ffmpeg.exe",
  POWERSHELL_SCRIPT: "D:\\FFMPEG\\work\\run_make.ps1",
  CONFIG_FILE: "D:\\FFMPEG\\work\\latest.json",
  ERROR_LOG: "D:\\FFMPEG\\work\\ERRORS_LIST.txt",
};

const TOTAL_DURATION = 5.0;
const SPEED_FACTOR = 3.0;

console.log("==========================================");
console.log("🚀 ЗАПУСК ЗАВОДА: HYBRID MODE (AUTO + MANUAL)");
console.log("==========================================");

function clearDir(dir) {
  if (fs.existsSync(dir)) fs.readdirSync(dir).forEach((f) => fs.unlinkSync(path.join(dir, f)));
  else fs.mkdirSync(dir, { recursive: true });
}
clearDir(PATHS.WORK_FLASH);
clearDir(PATHS.OUT_TEST);
if (fs.existsSync(PATHS.ERROR_LOG)) fs.unlinkSync(PATHS.ERROR_LOG);

console.log("\n✂️ [2/5] Обработка...");
const sourceFiles = fs
  .readdirSync(PATHS.SOURCE_FLASH)
  .filter((f) => f.endsWith(".mp4") || f.endsWith(".mov"));

if (sourceFiles.length === 0) {
  console.error("❌ ПАПКА ИСХОДНИКИ ПУСТА!");
  process.exit(1);
}

let processedCount = 0;

for (const file of sourceFiles) {
  const inputFile = path.join(PATHS.SOURCE_FLASH, file);
  let splitPoint = 1.8;
  let status = "OK";

  console.log(`\n🎥 ${file}`);
  try {
    const output = execSync(`python "${PATHS.SMART_SCRIPT}" "${inputFile}"`, {
      encoding: "utf8",
    }).trim();
    const parts = output.split("|");
    splitPoint = parseFloat(parts[0]);
    if (parts.length > 1) status = parts[1];

    if (status === "MANUAL") {
      console.log(`   🛠️ РУЧНОЙ РЕЖИМ (из имени файла): Режем на ${splitPoint}s`);
    } else if (status === "WARN") {
      console.log(`   ⚠️ КОНФЛИКТ ГОЛОСА (Смещено на ${splitPoint}s)`);
      fs.appendFileSync(PATHS.ERROR_LOG, `[VOICE_CLASH] ${file}\n`);
    } else {
      console.log(`   🤖 Авто-поиск (Движение): ${splitPoint}s`);
    }
  } catch (e) {
    console.log(`   ❌ Ошибка, дефолт.`);
  }

  const prefix = status === "WARN" ? "WARN_" : "";
  const outputFile = path.join(
    PATHS.WORK_FLASH,
    `${prefix}auto_${Date.now()}_${processedCount}.mp4`,
  );

  const start = 0.0;
  const end = start + TOTAL_DURATION;

  const filterComplex =
    `[0:v]trim=${start}:${splitPoint},setpts=PTS-STARTPTS[v1];` +
    `[0:v]trim=${splitPoint}:${end},setpts=${(1 / SPEED_FACTOR).toFixed(2)}*(PTS-STARTPTS)[v2];` +
    `[0:a]atrim=${start}:${splitPoint},asetpts=PTS-STARTPTS[a1];` +
    `[0:a]atrim=${splitPoint}:${end},atempo=${SPEED_FACTOR.toFixed(1)},asetpts=PTS-STARTPTS[a2];` +
    `[v1][a1][v2][a2]concat=n=2:v=1:a=1[outv][outa]`;

  const finalMap = `[outv]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280[vfinal]`;

  const args = [
    "-y",
    "-i",
    inputFile,
    "-filter_complex",
    `${filterComplex};${finalMap}`,
    "-map",
    "[vfinal]",
    "-map",
    "[outa]",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-c:a",
    "aac",
    outputFile,
  ];

  try {
    execSync(`"${PATHS.FFMPEG}" ${args.join(" ")}`, { stdio: "ignore" });
    processedCount++;
  } catch (e) {
    console.error(`   ❌ Ошибка FFmpeg.`);
  }
}

console.log("\n🏭 [3/5] Сборка...");
const reactions = fs
  .readdirSync(PATHS.WORK_REACTION)
  .filter((f) => f.endsWith(".mp4"))
  .map((f) => path.join(PATHS.WORK_REACTION, f));
const flashes = fs
  .readdirSync(PATHS.WORK_FLASH)
  .filter((f) => f.endsWith(".mp4"))
  .map((f) => path.join(PATHS.WORK_FLASH, f));
const music = fs
  .readdirSync(PATHS.WORK_MUSIC)
  .filter((f) => f.endsWith(".mp3"))
  .map((f) => path.join(PATHS.WORK_MUSIC, f));

if (reactions.length === 0 || flashes.length === 0) {
  console.error("❌ Нечего собирать!");
  process.exit(1);
}

const totalVideos = reactions.length * flashes.length;
console.log(`   📊 ${totalVideos} видео`);

const config = {
  reactions: reactions,
  flashes: flashes,
  music: music,
  outDir: PATHS.OUT_TEST,
  N: totalVideos.toString(),
  Speed: "1.0",
  UseColor: "1",
  UseCrop: "1",
  MusicVol: "35",
};
fs.writeFileSync(PATHS.CONFIG_FILE, JSON.stringify(config, null, 2));

console.log(`\n🚀 [4/5] Генерация...`);
const psArgs = [
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  PATHS.POWERSHELL_SCRIPT,
  "-ConfigPath",
  PATHS.CONFIG_FILE,
];
const child = spawn("powershell.exe", psArgs);
child.stdout.on("data", (d) => process.stdout.write(d.toString()));
child.stderr.on("data", (d) => process.stdout.write(d.toString()));
child.on("close", (c) => {
  if (c === 0) console.log("\n✅ [5/5] ЗАВОД ЗАВЕРШЕН!");
  else console.log("❌ ОШИБКА.");
});
