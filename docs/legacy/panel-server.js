"use strict";
const express = require("express");
const path = require("path");
const fs = require("fs");
const https = require("https");
const { exec, spawn } = require("child_process");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;

// ── Пути ──────────────────────────────────────────────────────────────────────
const BASE_DIR = "D:\\FFMPEG";
const FFMPEG_EXE = `${BASE_DIR}\\downloads\\ffmpeg-8.0.1-essentials_build\\bin\\ffmpeg.exe`;
const WORK_DIR = `${BASE_DIR}\\work`;
const MUSIC_DIR = `${WORK_DIR}\\in\\music`;
const OUT_DIR = `${WORK_DIR}\\out_test_Finish`;
const RUN_MAKE = `${WORK_DIR}\\run_make.ps1`;
const DATA_FILE = `${BASE_DIR}\\panel\\data\\history.json`;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Multer – загрузка видео/аудио
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ts = Date.now();
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9_-]/gi, "_");
    cb(null, `${base}_${ts}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 * 1024 } });

// ── Вспомогательные ──────────────────────────────────────────────────────────
function ps(script, args = []) {
  return new Promise((resolve, reject) => {
    const flat = ["-ExecutionPolicy", "Bypass", "-File", script, ...args];
    const proc = spawn("powershell.exe", flat);
    let stdout = "",
      stderr = "";
    proc.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `exit code ${code}`));
    });
  });
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson(file, def = {}) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return def;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  ① ЧАРТЫ – ТОП-10  (берём с Apple RSS)
// ══════════════════════════════════════════════════════════════════════════════
let CHARTS_CACHE = { data: null, ts: 0 };
const CHARTS_TTL = 60 * 60 * 1000; // 1 час

// Универсальный загрузчик с поддержкой редиректов
function httpsGetJson(url, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 5) return reject(new Error("Too many redirects"));
    const opts = {
      timeout: 12000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ReelsFactory/1.0",
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.9",
      },
    };
    const req = https.get(url, opts, (resp) => {
      // редиректы
      if ([301, 302, 303, 307, 308].includes(resp.statusCode) && resp.headers.location) {
        resp.resume();
        const next = new URL(resp.headers.location, url).toString();
        return httpsGetJson(next, depth + 1).then(resolve, reject);
      }
      if (resp.statusCode !== 200) {
        resp.resume();
        return reject(new Error(`HTTP ${resp.statusCode} от ${url}`));
      }
      let body = "";
      resp.on("data", (d) => (body += d));
      resp.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error("Bad JSON от " + url + ": " + e.message));
        }
      });
    });
    req.on("error", (err) => reject(new Error(err.code ? `${err.code} → ${url}` : err.message)));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("TIMEOUT → " + url));
    });
  });
}

const CHART_BATCH = 50; // тянем сразу 50, потом отдаём порциями

// Источник 1: Deezer Chart — есть 30-сек превью!
async function fetchDeezerChart() {
  const j = await httpsGetJson(`https://api.deezer.com/chart/0/tracks?limit=${CHART_BATCH}`);
  const results = (j && j.data) || [];
  if (!results.length) throw new Error("Deezer вернул пустой список");
  return results.slice(0, CHART_BATCH).map((t, i) => ({
    rank: i + 1,
    name: t.title || t.title_short || "Unknown",
    artist: (t.artist && t.artist.name) || "",
    img: (t.album && (t.album.cover_medium || t.album.cover_small)) || "",
    url: t.link || "",
    preview: t.preview || "",
  }));
}

// Источник 2: Apple Marketing Tools (без превью)
async function fetchAppleNew() {
  const j = await httpsGetJson(
    `https://rss.applemarketingtools.com/api/v2/us/music/most-played/${CHART_BATCH}/songs.json`,
  );
  const results = (j.feed && j.feed.results) || [];
  if (!results.length) throw new Error("Apple new RSS вернул пустой список");
  return results.slice(0, CHART_BATCH).map((t, i) => ({
    rank: i + 1,
    name: t.name || "Unknown",
    artist: t.artistName || "",
    img: t.artworkUrl100 || "",
    url: t.url || "",
    preview: "", // нет в этом API
  }));
}

// Источник 3: Старое iTunes RSS — есть im:audio превью!
async function fetchAppleLegacy() {
  const j = await httpsGetJson(
    `https://itunes.apple.com/us/rss/topsongs/limit=${CHART_BATCH}/json`,
  );
  const entries = (j.feed && j.feed.entry) || [];
  if (!entries.length) throw new Error("Apple legacy RSS вернул пустой список");
  return entries.slice(0, CHART_BATCH).map((e, i) => {
    const images = e["im:image"] || [];
    const img = images.length ? images[images.length - 1].label : "";
    const links = Array.isArray(e.link) ? e.link : [e.link];
    let preview = "";
    for (const lk of links) {
      if (lk && lk.attributes && (lk.attributes.type || "").startsWith("audio")) {
        preview = lk.attributes.href || "";
        break;
      }
    }
    return {
      rank: i + 1,
      name: (e["im:name"] && e["im:name"].label) || "",
      artist: (e["im:artist"] && e["im:artist"].label) || "",
      img,
      url: (links[0] && links[0].attributes && links[0].attributes.href) || "",
      preview,
    };
  });
}

app.get("/api/charts/top10", async (req, res) => {
  const limit = Math.max(1, Math.min(CHART_BATCH, parseInt(req.query.limit) || 10));
  const offset = Math.max(0, Math.min(CHART_BATCH - 1, parseInt(req.query.offset) || 0));

  if (req.query.fresh === "1") CHARTS_CACHE = { data: null, ts: 0 };

  // Кеш: 50 треков, режем порциями
  const cacheOk = CHARTS_CACHE.data && Date.now() - CHARTS_CACHE.ts < CHARTS_TTL;
  if (cacheOk) {
    const slice = CHARTS_CACHE.data.slice(offset, offset + limit);
    return res.json({
      success: true,
      data: slice,
      cached: true,
      offset,
      limit,
      total: CHARTS_CACHE.data.length,
      hasMore: offset + slice.length < CHARTS_CACHE.data.length,
      source: CHARTS_CACHE.source,
    });
  }

  const errors = [];
  const sources = [
    ["deezer", fetchDeezerChart],
    ["apple-new", fetchAppleNew],
    ["apple-legacy", fetchAppleLegacy],
  ];

  for (const [name, fn] of sources) {
    try {
      const list = await fn();
      // Проверка качества: чарт не должен состоять из одного артиста
      const artists = new Set(
        list.map((t) => (t.artist || "").toLowerCase().split(/[,&]/)[0].trim()),
      );
      if (artists.size < 3 && list.length >= 5) {
        throw new Error("источник вернул треки одного артиста — не похоже на чарт");
      }
      CHARTS_CACHE = { data: list, ts: Date.now(), source: name };
      console.log(`[charts/top10] ✅ ${name}: ${list.length} треков, ${artists.size} артистов`);
      const slice = list.slice(offset, offset + limit);
      return res.json({
        success: true,
        data: slice,
        offset,
        limit,
        total: list.length,
        hasMore: offset + slice.length < list.length,
        source: name,
      });
    } catch (e) {
      console.warn(`[charts/top10] ❌ ${name}: ${e.message}`);
      errors.push(`${name}: ${e.message}`);
    }
  }

  console.error("[charts/top10] ВСЕ источники упали:", errors.join(" | "));
  res.status(502).json({
    success: false,
    error: "Не удалось получить чарт. Проверь интернет/прокси/AV.",
    details: errors,
  });
});

// Скачать превью трека (Deezer/Apple) в work/in/music
function sanitizeFilename(s) {
  return (
    String(s || "")
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "track"
  );
}

function downloadToFile(url, destPath, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 5) return reject(new Error("Too many redirects"));
    const req = https.get(
      url,
      { timeout: 20000, headers: { "User-Agent": "ReelsFactory/1.0" } },
      (resp) => {
        if ([301, 302, 303, 307, 308].includes(resp.statusCode) && resp.headers.location) {
          resp.resume();
          return downloadToFile(
            new URL(resp.headers.location, url).toString(),
            destPath,
            depth + 1,
          ).then(resolve, reject);
        }
        if (resp.statusCode !== 200) {
          resp.resume();
          return reject(new Error("HTTP " + resp.statusCode));
        }
        const out = fs.createWriteStream(destPath);
        let bytes = 0;
        resp.on("data", (d) => {
          bytes += d.length;
        });
        resp.pipe(out);
        out.on("finish", () => out.close(() => resolve({ bytes, path: destPath })));
        out.on("error", (err) => {
          try {
            fs.unlinkSync(destPath);
          } catch {}
          reject(err);
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

app.post("/api/charts/download-preview", async (req, res) => {
  try {
    const { url, name, artist } = req.body || {};
    if (!url || typeof url !== "string" || !/^https?:\/\//.test(url)) {
      return res.status(400).json({ ok: false, error: "URL превью не передан или невалиден" });
    }
    // Разрешаем скачивать только с доменов известных источников превью
    const allowedHosts = [
      "cdns-preview",
      "cdn-preview",
      "cdnt-preview",
      "dzcdn.net",
      "mzstatic.com",
      "audio-ssl.itunes.apple.com",
    ];
    let host = "";
    try {
      host = new URL(url).hostname;
    } catch {}
    if (!host || !allowedHosts.some((h) => host.includes(h))) {
      return res.status(400).json({ ok: false, error: "Домен не в белом списке: " + host });
    }

    ensureDir(MUSIC_DIR);
    const safeArtist = sanitizeFilename(artist);
    const safeName = sanitizeFilename(name);
    const base = (safeArtist ? safeArtist + " - " : "") + safeName;
    let outFile = path.join(MUSIC_DIR, base + ".mp3");
    // Не перезаписываем — добавляем суффикс
    let n = 1;
    while (fs.existsSync(outFile)) {
      outFile = path.join(MUSIC_DIR, `${base} (${n}).mp3`);
      n++;
      if (n > 99) break;
    }

    const result = await downloadToFile(url, outFile);
    console.log(`[download-preview] ✅ ${path.basename(outFile)} (${result.bytes} bytes)`);
    res.json({
      ok: true,
      file: outFile,
      filename: path.basename(outFile),
      bytes: result.bytes,
    });
  } catch (err) {
    console.error("[download-preview] ❌", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Обновить кэш чартов вручную (опционально)
app.post("/api/charts/refresh", (req, res) => {
  const scanScript = path.join(BASE_DIR, "panel", "bot", "ai_scan.py");
  if (!fs.existsSync(scanScript))
    return res.json({ success: true, message: "Scan script not found, cache unchanged" });
  exec(
    `python "${scanScript}"`,
    { cwd: path.join(BASE_DIR, "panel", "bot") },
    (err, out, sterr) => {
      if (err) return res.status(500).json({ success: false, error: sterr || err.message });
      res.json({ success: true, output: out });
    },
  );
});

// ══════════════════════════════════════════════════════════════════════════════
//  ② МУЗЫКА – СОЗДАТЬ МИКС + FINISH  (ИСПРАВЛЕНО)
// ══════════════════════════════════════════════════════════════════════════════
// Хранилище активных миксов (в памяти – достаточно для одного сервера)
const activeMixes = new Map();

// Получить список треков
app.get("/api/music/tracks", (req, res) => {
  try {
    ensureDir(MUSIC_DIR);
    const files = fs
      .readdirSync(MUSIC_DIR)
      .filter((f) => /\.(mp3|m4a|aac|wav|ogg)$/i.test(f))
      .map((f) => ({
        id: f,
        name: f,
        path: path.join(MUSIC_DIR, f),
        size: fs.statSync(path.join(MUSIC_DIR, f)).size,
      }));
    res.json({ success: true, tracks: files });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Создать сессию микса (ИСПРАВЛЕНО – раньше не создавалась сессия → Finish не работал)
app.post("/api/music/create-mix", upload.array("tracks", 50), (req, res) => {
  try {
    const mixId = `mix_${Date.now()}`;
    const outDir = path.join(BASE_DIR, "work", "temp_edit");
    ensureDir(outDir);

    // Файлы могут прийти либо через загрузку, либо как список путей
    let trackPaths = [];

    if (req.files && req.files.length > 0) {
      trackPaths = req.files.map((f) => f.path);
    } else if (req.body.tracks) {
      const raw = req.body.tracks;
      const list = Array.isArray(raw) ? raw : JSON.parse(raw);
      trackPaths = list
        .map((t) => (typeof t === "string" ? t : t.path || t.id))
        .filter((p) => {
          // Разрешаем пути только внутри BASE_DIR
          const abs = path.isAbsolute(p) ? p : path.join(MUSIC_DIR, p);
          return fs.existsSync(abs);
        })
        .map((p) => (path.isAbsolute(p) ? p : path.join(MUSIC_DIR, p)));
    }

    if (trackPaths.length === 0) {
      return res.status(400).json({ success: false, error: "Нет треков для микса" });
    }

    activeMixes.set(mixId, {
      id: mixId,
      tracks: trackPaths,
      outDir,
      status: "pending",
      createdAt: Date.now(),
      outFile: null,
    });

    res.json({ success: true, mixId, trackCount: trackPaths.length });
  } catch (err) {
    console.error("[create-mix]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// FINISH – собрать микс в один файл (ИСПРАВЛЕНО)
app.post("/api/music/finish", (req, res) => {
  try {
    const { mixId, outputName, fadeIn, fadeOut, normalize } = req.body;

    if (!mixId) return res.status(400).json({ success: false, error: "mixId не передан" });

    // Если mixId не найден в памяти – пробуем собрать все треки из MUSIC_DIR
    let mix = activeMixes.get(mixId);
    if (!mix) {
      // Фоллбэк: берём все треки из папки
      const tracks = fs
        .readdirSync(MUSIC_DIR)
        .filter((f) => /\.(mp3|m4a|aac|wav)$/i.test(f))
        .map((f) => path.join(MUSIC_DIR, f));

      if (tracks.length === 0)
        return res
          .status(404)
          .json({ success: false, error: "Микс не найден и треки отсутствуют" });

      mix = { id: mixId, tracks, outDir: path.join(WORK_DIR, "temp_edit"), status: "pending" };
      activeMixes.set(mixId, mix);
    }

    const outDir = path.join(OUT_DIR);
    ensureDir(outDir);

    const safeOut = (outputName || `mix_${mixId}`).replace(/[^a-z0-9_\-\.]/gi, "_");
    const outFile = path.join(outDir, `${safeOut}.mp3`);

    // Строим concat-лист для FFmpeg
    const listFile = path.join(
      mix.outDir || path.join(WORK_DIR, "temp_edit"),
      `concat_${mixId}.txt`,
    );
    ensureDir(path.dirname(listFile));
    const listContent = mix.tracks.map((p) => `file '${p.replace(/'/g, "\\'")}'`).join("\n");
    fs.writeFileSync(listFile, listContent, "utf8");

    // Аудио-фильтры
    const filters = [];
    if (normalize) filters.push("loudnorm");
    if (fadeIn) filters.push(`afade=t=in:d=${fadeIn}`);
    if (fadeOut) filters.push(`afade=t=out:st=0:d=${fadeOut}`); // st=0 = конец

    const afStr = filters.length ? `-af "${filters.join(",")}"` : "";

    const cmd = `"${FFMPEG_EXE}" -y -f concat -safe 0 -i "${listFile}" ${afStr} -acodec libmp3lame -b:a 192k "${outFile}"`;

    mix.status = "processing";
    activeMixes.set(mixId, mix);

    exec(cmd, { timeout: 10 * 60 * 1000 }, (err, stdout, stderr) => {
      if (err) {
        mix.status = "error";
        activeMixes.set(mixId, mix);
        console.error("[finish]", stderr);
        return res.status(500).json({ success: false, error: stderr || err.message });
      }
      mix.status = "done";
      mix.outFile = outFile;
      activeMixes.set(mixId, mix);

      // Очищаем временный список
      try {
        fs.unlinkSync(listFile);
      } catch {}

      res.json({
        success: true,
        mixId,
        outputFile: outFile,
        trackCount: mix.tracks.length,
        message: "Микс успешно создан!",
      });
    });
  } catch (err) {
    console.error("[finish]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Скачать готовый микс
app.get("/api/music/download/:mixId", (req, res) => {
  const mix = activeMixes.get(req.params.mixId);
  if (!mix || !mix.outFile || !fs.existsSync(mix.outFile)) {
    return res.status(404).json({ success: false, error: "Файл не найден" });
  }
  res.download(mix.outFile);
});

// ══════════════════════════════════════════════════════════════════════════════
//  ③ КОНВЕЙЕР – УНИКАЛИЗАЦИЯ ВИДЕО  (ИСПРАВЛЕН ПУТЬ + НОВЫЕ ФИЧИ)
// ══════════════════════════════════════════════════════════════════════════════
const conveyorJobs = new Map();

// Загрузить видео и запустить конвейер
app.post("/api/conveyor/start", upload.single("video"), (req, res) => {
  try {
    // ── КРИТИЧНО: берём путь из ЗАГРУЖЕННОГО файла, а НЕ из глобальной переменной
    let inputFile = "";
    if (req.file) {
      inputFile = req.file.path; // multer сохранил файл – используем ЕГО путь
    } else if (req.body.inputFile) {
      inputFile = req.body.inputFile;
    } else {
      return res.status(400).json({ success: false, error: "Видео не передано" });
    }

    if (!fs.existsSync(inputFile)) {
      return res.status(400).json({ success: false, error: `Файл не найден: ${inputFile}` });
    }

    const count = Math.max(1, Math.min(1000, parseInt(req.body.count) || 1));
    const jobId = `job_${Date.now()}`;
    const outDir = req.body.outDir || path.join(WORK_DIR, "out_test_Finish");
    const features = {
      mirror: req.body.mirror !== "false",
      zoom: req.body.zoom !== "false",
      fpsJitter: req.body.fpsJitter !== "false",
      metadata: req.body.metadata !== "false",
      crop: req.body.crop !== "false",
      color: req.body.color !== "false",
    };

    ensureDir(outDir);

    conveyorJobs.set(jobId, {
      id: jobId,
      status: "running",
      total: count,
      done: 0,
      errors: 0,
      outDir,
      inputFile,
      startedAt: Date.now(),
    });

    // Запускаем PowerShell-скрипт с явной передачей пути
    const args = [
      "-InputFile",
      inputFile,
      "-Count",
      String(count),
      "-OutDir",
      outDir,
      "-JobId",
      jobId,
      "-Mirror",
      features.mirror ? "1" : "0",
      "-Zoom",
      features.zoom ? "1" : "0",
      "-FpsJitter",
      features.fpsJitter ? "1" : "0",
      "-Metadata",
      features.metadata ? "1" : "0",
      "-Crop",
      features.crop ? "1" : "0",
      "-Color",
      features.color ? "1" : "0",
    ];

    ps(RUN_MAKE, args)
      .then((out) => {
        const job = conveyorJobs.get(jobId);
        if (job) {
          job.status = "done";
          job.done = count;
          conveyorJobs.set(jobId, job);
        }
        console.log(`[conveyor] Job ${jobId} done`, out.slice(0, 200));
      })
      .catch((err) => {
        const job = conveyorJobs.get(jobId);
        if (job) {
          job.status = "error";
          job.lastError = err.message;
          conveyorJobs.set(jobId, job);
        }
        console.error(`[conveyor] Job ${jobId} error`, err.message);
      });

    res.json({ success: true, jobId, count, inputFile, message: `Запущено ${count} задач` });
  } catch (err) {
    console.error("[conveyor/start]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Прогресс задания
app.get("/api/conveyor/status/:jobId", (req, res) => {
  const job = conveyorJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ success: false, error: "Job не найден" });

  // Считаем реальный прогресс по файлам в папке
  try {
    const files = fs
      .readdirSync(job.outDir)
      .filter((f) => /\.(mp4|mov|avi|mkv)$/i.test(f) && f.includes(job.id.replace("job_", "")));
    job.done = files.length;
  } catch {}

  res.json({ success: true, ...job, progress: Math.round((job.done / job.total) * 100) });
});

// SSE-стрим прогресса
app.get("/api/conveyor/stream/:jobId", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = () => {
    const job = conveyorJobs.get(req.params.jobId);
    if (job) {
      res.write(`data: ${JSON.stringify(job)}\n\n`);
      if (job.status === "done" || job.status === "error") return clearInterval(timer);
    }
  };
  const timer = setInterval(send, 1000);
  req.on("close", () => clearInterval(timer));
});

// ── Общие роуты ───────────────────────────────────────────────────────────────
app.get("/api/files/list", (req, res) => {
  const dir = req.query.dir || WORK_DIR;
  try {
    if (!dir.startsWith(BASE_DIR))
      return res.status(403).json({ success: false, error: "Доступ запрещён" });
    const files = fs.readdirSync(dir).map((f) => {
      const fp = path.join(dir, f);
      const stat = fs.statSync(fp);
      return { name: f, path: fp, size: stat.size, isDir: stat.isDirectory(), mtime: stat.mtimeMs };
    });
    res.json({ success: true, files });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    uptime: process.uptime(),
    ffmpeg: fs.existsSync(FFMPEG_EXE),
    workDir: fs.existsSync(WORK_DIR),
    musicDir: fs.existsSync(MUSIC_DIR),
    timestamp: new Date().toISOString(),
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  ④ НОВЫЕ ЭНДПОИНТЫ – закрываем все «Ошибки сети» в UI
// ══════════════════════════════════════════════════════════════════════════════

// ── Глобальное состояние для /api/progress, /api/stop ────────────────────────
let CURRENT_PROC = null;
let PROGRESS = { running: false, current: 0, total: 0, pct: 0, message: "idle", exitCode: null };

function startBgProcess(cmd, args, opts = {}) {
  if (CURRENT_PROC && !CURRENT_PROC.killed) {
    throw new Error("Уже выполняется другой процесс — нажмите СТОП");
  }
  PROGRESS = {
    running: true,
    current: 0,
    total: 0,
    pct: 0,
    message: "starting...",
    exitCode: null,
  };
  const proc = spawn(cmd, args, opts);
  CURRENT_PROC = proc;
  proc.stdout.on("data", (d) => {
    const text = d.toString();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length) PROGRESS.message = lines[lines.length - 1].trim().slice(0, 200);
    const m = text.match(/(\d+)\s*\/\s*(\d+)/);
    if (m) {
      PROGRESS.current = parseInt(m[1]);
      PROGRESS.total = parseInt(m[2]);
      PROGRESS.pct = Math.round((PROGRESS.current / PROGRESS.total) * 100);
    }
  });
  proc.stderr.on("data", (d) => {
    PROGRESS.message = ("ERR: " + d.toString()).trim().slice(0, 200);
  });
  proc.on("close", (code) => {
    PROGRESS.running = false;
    PROGRESS.exitCode = code;
    PROGRESS.message = code === 0 ? "✅ done" : `❌ exit ${code}`;
    if (CURRENT_PROC === proc) CURRENT_PROC = null;
  });
  proc.on("error", (err) => {
    PROGRESS.running = false;
    PROGRESS.exitCode = -1;
    PROGRESS.message = "ERR: " + err.message;
    if (CURRENT_PROC === proc) CURRENT_PROC = null;
  });
  return proc;
}

function killCurrentProc() {
  if (CURRENT_PROC && !CURRENT_PROC.killed) {
    try {
      if (process.platform === "win32") exec(`taskkill /F /T /PID ${CURRENT_PROC.pid}`);
      else CURRENT_PROC.kill("SIGKILL");
    } catch {}
  }
  CURRENT_PROC = null;
  PROGRESS.running = false;
  PROGRESS.message = "🛑 stopped";
}

// ── Аккаунты ──────────────────────────────────────────────────────────────────
const ACCOUNTS_FILE = path.join(BASE_DIR, "panel", "data", "accounts.json");

app.get("/api/accounts", (req, res) => {
  try {
    ensureDir(path.dirname(ACCOUNTS_FILE));
    const list = readJson(ACCOUNTS_FILE, []);
    res.json(Array.isArray(list) ? list : []);
  } catch (err) {
    res.status(500).json([]);
  }
});

app.post("/api/accounts", (req, res) => {
  try {
    ensureDir(path.dirname(ACCOUNTS_FILE));
    const data = Array.isArray(req.body) ? req.body : req.body.accounts || [];
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(data, null, 2), "utf8");
    res.json({ ok: true, count: data.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.delete("/api/accounts/:id", (req, res) => {
  try {
    ensureDir(path.dirname(ACCOUNTS_FILE));
    const id = String(req.params.id);
    let list = readJson(ACCOUNTS_FILE, []);
    if (!Array.isArray(list)) list = [];
    const before = list.length;
    list = list.filter((a) => String(a.id) !== id);
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(list, null, 2), "utf8");
    res.json({ ok: true, removed: before - list.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Авторизация / тесты прогрева и посева (запуск bot/browser.js) ────────────
function spawnBrowserBot(account, mode) {
  const browserScript = path.join(BASE_DIR, "panel", "bot", "browser.js");
  if (!fs.existsSync(browserScript)) throw new Error("browser.js не найден: " + browserScript);
  const env = Object.assign({}, process.env, {
    ACC_LOGIN: account.login || "",
    ACC_PASS: account.pass || "",
    ACC_PROXY: account.proxy || "",
    ACC_PLATFORM: account.platform || "",
    TEST_MODE: mode || "auth",
  });
  const proc = spawn("node", [browserScript], {
    env,
    cwd: path.join(BASE_DIR, "panel", "bot"),
    detached: true,
    stdio: "ignore",
  });
  proc.unref();
  return proc;
}

app.post("/api/auth", (req, res) => {
  try {
    spawnBrowserBot(req.body || {}, "auth");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/test/warmup", (req, res) => {
  try {
    spawnBrowserBot(req.body || {}, "warmup");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/test/seed", (req, res) => {
  try {
    spawnBrowserBot(req.body || {}, "seed");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Автопилот (FULL_AUTO.js) ─────────────────────────────────────────────────
app.post("/api/autopilot", (req, res) => {
  try {
    const script = path.join(BASE_DIR, "panel", "FULL_AUTO.js");
    if (!fs.existsSync(script))
      return res.status(404).json({ ok: false, error: "FULL_AUTO.js не найден" });
    startBgProcess("node", [script], { cwd: path.join(BASE_DIR, "panel") });
    res.json({ ok: true, message: "Автопилот запущен" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Бот рассылки (uploader.js) ───────────────────────────────────────────────
app.post("/api/bot/start", (req, res) => {
  try {
    const script = path.join(BASE_DIR, "panel", "bot", "uploader.js");
    if (!fs.existsSync(script))
      return res.status(404).json({ ok: false, error: "uploader.js не найден" });
    startBgProcess("node", [script], { cwd: path.join(BASE_DIR, "panel", "bot") });
    res.json({ ok: true, message: "Бот запущен" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Старый конвейер: run_make.ps1 ────────────────────────────────────────────
app.post("/api/start", (req, res) => {
  try {
    if (!fs.existsSync(RUN_MAKE))
      return res.status(404).json({ ok: false, error: "run_make.ps1 не найден" });
    const cfg = req.body || {};
    const args = [
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      RUN_MAKE,
      "-N",
      String(cfg.N || 10),
      "-Speed",
      String(cfg.Speed || 1.0),
      "-MusicVol",
      String(cfg.MusicVol || 15),
      "-UseColor",
      cfg.UseColor ? "1" : "0",
      "-UseCrop",
      cfg.UseCrop ? "1" : "0",
    ];
    startBgProcess("powershell.exe", args);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/stop", (req, res) => {
  killCurrentProc();
  res.json({ ok: true });
});

app.get("/api/progress", (req, res) => {
  res.json(PROGRESS);
});

// ── Очередь файлов (для «Менеджера Аккаунтов») ───────────────────────────────
app.get("/api/files", (req, res) => {
  try {
    ensureDir(OUT_DIR);
    const files = fs
      .readdirSync(OUT_DIR)
      .filter((f) => /\.(mp4|mov|avi|mkv)$/i.test(f))
      .map((f) => {
        const fp = path.join(OUT_DIR, f);
        const stat = fs.statSync(fp);
        return {
          name: f,
          size: (stat.size / 1024 / 1024).toFixed(1) + " MB",
          path: fp,
          mtime: stat.mtimeMs,
        };
      })
      .sort((a, b) => b.mtime - a.mtime);
    res.json(files);
  } catch (err) {
    res.status(500).json([]);
  }
});

// ── Multi-upload (Reaction / Flashes / Music) ────────────────────────────────
const REACTION_DIR = path.join(WORK_DIR, "in", "reaction");
const FLASH_DIR = path.join(WORK_DIR, "in", "flash");

app.post(
  "/api/upload",
  upload.fields([
    { name: "reaction", maxCount: 100 },
    { name: "flashes", maxCount: 200 },
    { name: "music", maxCount: 50 },
  ]),
  (req, res) => {
    try {
      ensureDir(REACTION_DIR);
      ensureDir(FLASH_DIR);
      ensureDir(MUSIC_DIR);
      let n = 0;
      const moveAll = (arr, destDir) => {
        if (!arr) return;
        arr.forEach((f) => {
          const dest = path.join(destDir, path.basename(f.path));
          try {
            fs.renameSync(f.path, dest);
            n++;
          } catch {
            fs.copyFileSync(f.path, dest);
            fs.unlinkSync(f.path);
            n++;
          }
        });
      };
      moveAll(req.files?.reaction, REACTION_DIR);
      moveAll(req.files?.flashes, FLASH_DIR);
      moveAll(req.files?.music, MUSIC_DIR);
      res.json({ ok: true, count: n });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  },
);

// ── Сохранение из редактора в нужную папку ───────────────────────────────────
function destForType(type) {
  if (type === "flash") return FLASH_DIR;
  if (type === "reaction") return REACTION_DIR;
  return OUT_DIR; // finish (по умолчанию)
}

app.post("/api/save", upload.single("video"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: "video не передан" });
    const type = req.body.type || "finish";
    const name = (req.body.name || "clip").replace(/[^a-z0-9_\-]/gi, "_");
    const dest = destForType(type);
    ensureDir(dest);
    const ext = path.extname(req.file.originalname) || ".mp4";
    const outFile = path.join(dest, `${name}_${Date.now()}${ext}`);
    fs.renameSync(req.file.path, outFile);
    res.json({ ok: true, file: outFile });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/save-existing", (req, res) => {
  try {
    const { filename, type, name } = req.body || {};
    if (!filename) return res.status(400).json({ ok: false, error: "filename не передан" });
    const src = path.join(__dirname, "uploads", path.basename(filename));
    if (!fs.existsSync(src))
      return res.status(404).json({ ok: false, error: "Файл не найден: " + src });
    const dest = destForType(type || "finish");
    ensureDir(dest);
    const ext = path.extname(filename) || ".mp4";
    const safe = (name || "clip").replace(/[^a-z0-9_\-]/gi, "_");
    const outFile = path.join(dest, `${safe}_${Date.now()}${ext}`);
    fs.copyFileSync(src, outFile);
    res.json({ ok: true, file: outFile });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Раздаём /uploads/ статикой (для предпросмотра видео) ─────────────────────
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ── Редактор: trim + ускорение (/api/edit/process) ───────────────────────────
app.post("/api/edit/process", upload.single("video"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: "video не передан" });
    const trimStart = parseFloat(req.body.trimStart) || 0;
    const trimEnd = parseFloat(req.body.trimEnd) || 0;
    const speedStart = parseFloat(req.body.speedStart) || 0;
    const speedEnd = parseFloat(req.body.speedEnd) || 0;
    const speed = Math.max(0.25, Math.min(8, parseFloat(req.body.speed) || 1));

    const inFile = req.file.path;
    const ext = path.extname(req.file.originalname) || ".mp4";
    const outName = `edit_${Date.now()}${ext}`;
    const outFile = path.join(__dirname, "uploads", outName);

    const hasTrim = trimEnd > trimStart + 0.05;
    const hasSpeed = speedEnd > speedStart + 0.05 && Math.abs(speed - 1) > 0.01;

    let cmd;
    if (hasSpeed && hasTrim) {
      const aStart = Math.max(speedStart, trimStart);
      const aEnd = Math.min(speedEnd, trimEnd);
      const ptsScale = 1 / speed;
      const atempo = Math.max(0.5, Math.min(2.0, speed));
      const fc =
        `[0:v]trim=start=${trimStart}:end=${aStart},setpts=PTS-STARTPTS[v1];` +
        `[0:v]trim=start=${aStart}:end=${aEnd},setpts=${ptsScale}*(PTS-STARTPTS)[v2];` +
        `[0:v]trim=start=${aEnd}:end=${trimEnd},setpts=PTS-STARTPTS[v3];` +
        `[0:a]atrim=start=${trimStart}:end=${aStart},asetpts=PTS-STARTPTS[a1];` +
        `[0:a]atrim=start=${aStart}:end=${aEnd},asetpts=PTS-STARTPTS,atempo=${atempo}[a2];` +
        `[0:a]atrim=start=${aEnd}:end=${trimEnd},asetpts=PTS-STARTPTS[a3];` +
        `[v1][a1][v2][a2][v3][a3]concat=n=3:v=1:a=1[outv][outa]`;
      cmd = `"${FFMPEG_EXE}" -y -i "${inFile}" -filter_complex "${fc}" -map "[outv]" -map "[outa]" -c:v libx264 -c:a aac "${outFile}"`;
    } else if (hasTrim) {
      cmd = `"${FFMPEG_EXE}" -y -ss ${trimStart} -to ${trimEnd} -i "${inFile}" -c copy "${outFile}"`;
    } else if (hasSpeed) {
      const ptsScale = 1 / speed;
      const atempo = Math.max(0.5, Math.min(2.0, speed));
      cmd = `"${FFMPEG_EXE}" -y -i "${inFile}" -filter_complex "[0:v]setpts=${ptsScale}*PTS[v];[0:a]atempo=${atempo}[a]" -map "[v]" -map "[a]" -c:v libx264 -c:a aac "${outFile}"`;
    } else {
      fs.copyFileSync(inFile, outFile);
      try {
        fs.unlinkSync(inFile);
      } catch {}
      return res.json({ ok: true, filename: outName, url: "/uploads/" + outName });
    }

    exec(cmd, { timeout: 5 * 60 * 1000 }, (err, stdout, stderr) => {
      try {
        fs.unlinkSync(inFile);
      } catch {}
      if (err) {
        console.error("[edit/process]", (stderr || err.message).slice(0, 400));
        return res.status(500).json({ ok: false, error: (stderr || err.message).slice(0, 400) });
      }
      res.json({ ok: true, filename: outName, url: "/uploads/" + outName });
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Cut Audio (Музыка → Конвейер) ────────────────────────────────────────────
app.post("/api/cut-audio", upload.single("audio"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: "audio не передан" });
    const start = parseFloat(req.body.start) || 0;
    const end = parseFloat(req.body.end) || 0;
    const name = (req.body.name || "music_clip").replace(/[^a-z0-9_\-]/gi, "_");

    ensureDir(MUSIC_DIR);
    const outFile = path.join(MUSIC_DIR, `${name}_${Date.now()}.mp3`);
    const inFile = req.file.path;

    const ss = start > 0 ? `-ss ${start}` : "";
    const dur = end > start + 0.1 ? `-to ${end}` : "";
    const cmd = `"${FFMPEG_EXE}" -y ${ss} ${dur} -i "${inFile}" -acodec libmp3lame -b:a 192k "${outFile}"`;

    exec(cmd, { timeout: 120000 }, (err, stdout, stderr) => {
      try {
        fs.unlinkSync(inFile);
      } catch {}
      if (err)
        return res.status(500).json({ ok: false, error: (stderr || err.message).slice(0, 400) });
      res.json({ ok: true, file: outFile });
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── /api/mix — наложение музыки на видео (из api_mix_patch.js) ───────────────
app.post(
  "/api/mix",
  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "audio", maxCount: 1 },
  ]),
  (req, res) => {
    try {
      if (!req.files || !req.files.video || !req.files.audio) {
        return res.status(400).json({ ok: false, error: "Выберите и видео, и аудио" });
      }
      const videoFile = req.files.video[0].path;
      const audioFile = req.files.audio[0].path;
      const vol = Math.max(0.01, Math.min(2, (parseInt(req.body.volume) || 15) / 100));
      const keepAudio = String(req.body.keepAudio) === "true";
      const audioStart = parseFloat(req.body.audioStart) || 0;
      const audioEnd = parseFloat(req.body.audioEnd) || 0;

      ensureDir(OUT_DIR);
      const outFile = path.join(OUT_DIR, "mix_" + Date.now() + ".mp4");

      const ssArg = audioStart > 0 ? "-ss " + audioStart : "";
      const toArg = audioEnd > audioStart + 0.1 ? "-t " + (audioEnd - audioStart) : "";

      let cmd;
      if (keepAudio) {
        cmd =
          `"${FFMPEG_EXE}" -y -i "${videoFile}" ${ssArg} ${toArg} -i "${audioFile}"` +
          ` -filter_complex "[1:a]volume=${vol}[mus];[0:a][mus]amix=inputs=2:duration=first[outa]"` +
          ` -map 0:v -map "[outa]" -c:v copy -c:a aac -b:a 192k -shortest "${outFile}"`;
      } else {
        cmd =
          `"${FFMPEG_EXE}" -y -i "${videoFile}" ${ssArg} ${toArg} -i "${audioFile}"` +
          ` -filter_complex "[1:a]volume=${vol}[mus]"` +
          ` -map 0:v -map "[mus]" -c:v copy -c:a aac -b:a 192k -shortest "${outFile}"`;
      }

      exec(cmd, { timeout: 300000 }, (err, stdout, stderr) => {
        try {
          fs.unlinkSync(videoFile);
        } catch {}
        try {
          fs.unlinkSync(audioFile);
        } catch {}
        if (err) {
          console.error("[mix]", (stderr || err.message).slice(0, 400));
          return res.status(500).json({ ok: false, error: (stderr || err.message).slice(0, 400) });
        }
        res.json({ ok: true, file: outFile, message: "Готово: " + path.basename(outFile) });
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
//  ⑤ DASHBOARD STATS — реальные числа для нового AvaStudio UI
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/stats/dashboard", (req, res) => {
  try {
    // Аккаунты
    let accounts = [];
    try {
      const accountsFile = path.join(BASE_DIR, "panel", "data", "accounts.json");
      accounts = readJson(accountsFile, []);
      if (!Array.isArray(accounts)) accounts = [];
    } catch {}
    const totalAccounts = accounts.length;
    const readyAccounts = accounts.filter((a) => a.status === "ready").length;
    const bannedAccounts = accounts.filter((a) => a.status === "banned").length;
    const platformCounts = accounts.reduce((acc, a) => {
      acc[a.platform || "unknown"] = (acc[a.platform || "unknown"] || 0) + 1;
      return acc;
    }, {});

    // История публикаций
    let history = [];
    try {
      const historyFile = path.join(BASE_DIR, "panel", "data", "history.json");
      history = readJson(historyFile, []);
      if (!Array.isArray(history)) history = [];
    } catch {}
    const now = new Date();
    const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startYst = startDay - 86400000;
    const postsToday = history.filter((h) => new Date(h.date).getTime() >= startDay).length;
    const postsYesterday = history.filter((h) => {
      const t = new Date(h.date).getTime();
      return t >= startYst && t < startDay;
    }).length;
    const postsTotal = history.length;
    const lastPost = history.length ? history[history.length - 1] : null;

    // Готовые файлы в OUT_DIR
    let filesReady = 0;
    let filesSizeMB = 0;
    try {
      if (fs.existsSync(OUT_DIR)) {
        const files = fs.readdirSync(OUT_DIR).filter((f) => /\.(mp4|mov|avi|mkv)$/i.test(f));
        filesReady = files.length;
        filesSizeMB =
          files.reduce((sum, f) => sum + fs.statSync(path.join(OUT_DIR, f)).size, 0) / 1024 / 1024;
      }
    } catch {}

    // Расписание сегодня — из аккаунтов
    const todaySlots = [];
    accounts.forEach((a) => {
      (a.schedule || []).forEach((t) => {
        const [h, m] = String(t).split(":").map(Number);
        if (!isNaN(h))
          todaySlots.push({
            time: t,
            account: a.login,
            platform: a.platform,
            hour: h,
            minute: m || 0,
          });
      });
    });
    todaySlots.sort((a, b) => a.hour - b.hour || a.minute - b.minute);

    res.json({
      ok: true,
      accounts: {
        total: totalAccounts,
        ready: readyAccounts,
        banned: bannedAccounts,
        platforms: platformCounts,
      },
      posts: { today: postsToday, yesterday: postsYesterday, total: postsTotal, lastPost },
      files: { ready: filesReady, sizeMB: Math.round(filesSizeMB) },
      schedule: todaySlots,
      timestamp: now.toISOString(),
    });
  } catch (err) {
    console.error("[stats/dashboard]", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Активность — последние N событий из history.json (легче чем SSE для MVP)
app.get("/api/stats/activity", (req, res) => {
  try {
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit) || 15));
    let history = [];
    try {
      const historyFile = path.join(BASE_DIR, "panel", "data", "history.json");
      history = readJson(historyFile, []);
      if (!Array.isArray(history)) history = [];
    } catch {}
    const items = history
      .slice(-limit)
      .reverse()
      .map((h) => ({
        type: "posted",
        account: h.account || "",
        file: h.file || "",
        date: h.date || "",
      }));
    res.json({ ok: true, items });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  ⑥ UPLOADER (Playwright) — спавн скриптов из services/uploader
// ══════════════════════════════════════════════════════════════════════════════
const UPLOADER_DIR = path.join(BASE_DIR, "services", "uploader");
const UPLOADER_PYTHON = path.join(UPLOADER_DIR, "venv", "Scripts", "python.exe");
const UPLOADER_LIVE = path.join(__dirname, "public", "live");
const UPLOADER_SCRIPTS = {
  login: "playwright_login.py",
  warmup: "playwright_warmup.py",
  upload: "playwright_upload.py",
};

// Активный процесс uploader-а (один за раз чтобы не открывать 5 браузеров)
let UPLOADER_PROC = null;
// Отдельный процесс bridge.py (WebSocket мост для ручного режима)
let BRIDGE_PROC = null;

app.post("/api/uploader/run", (req, res) => {
  try {
    const script = (req.body && req.body.script) || "";
    if (!UPLOADER_SCRIPTS[script]) {
      return res.status(400).json({ ok: false, error: "Unknown script: " + script });
    }
    if (UPLOADER_PROC && !UPLOADER_PROC.killed) {
      return res.status(409).json({
        ok: false,
        error: "Uploader уже запущен (pid=" + UPLOADER_PROC.pid + "). Нажми Стоп.",
      });
    }
    const scriptPath = path.join(UPLOADER_DIR, UPLOADER_SCRIPTS[script]);
    if (!fs.existsSync(scriptPath)) {
      return res.status(404).json({ ok: false, error: "Script not found: " + scriptPath });
    }
    if (!fs.existsSync(UPLOADER_PYTHON)) {
      return res
        .status(500)
        .json({ ok: false, error: "venv не найден. Запусти setup.ps1 в services/uploader." });
    }
    // Захват stdout/stderr в файл — иначе silent crashes
    const logDir = path.join(UPLOADER_DIR, "logs");
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const runtimeLog = path.join(logDir, `runtime-${script}.log`);
    const logStream = fs.createWriteStream(runtimeLog, { flags: "w" });
    logStream.write(`\n=== ${new Date().toISOString()} - spawn ${script} ===\n`);

    const proc = spawn(UPLOADER_PYTHON, [scriptPath], {
      cwd: UPLOADER_DIR,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    proc.stdout.pipe(logStream, { end: false });
    proc.stderr.pipe(logStream, { end: false });
    UPLOADER_PROC = proc;
    proc.on("exit", (code) => {
      console.log(`[uploader/${script}] exited code=${code} pid=${proc.pid} (log: ${runtimeLog})`);
      logStream.write(`\n=== exited code=${code} at ${new Date().toISOString()} ===\n`);
      logStream.end();
      if (UPLOADER_PROC === proc) UPLOADER_PROC = null;
    });
    console.log(`[uploader/${script}] spawned pid=${proc.pid} → log: ${runtimeLog}`);
    res.json({ ok: true, script, pid: proc.pid, log: runtimeLog });
  } catch (err) {
    console.error("[uploader/run]", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/uploader/stop", (req, res) => {
  if (!UPLOADER_PROC || UPLOADER_PROC.killed) {
    return res.json({ ok: true, message: "Uploader не запущен" });
  }
  try {
    if (process.platform === "win32") {
      exec(`taskkill /F /T /PID ${UPLOADER_PROC.pid}`);
    } else {
      UPLOADER_PROC.kill("SIGKILL");
    }
    // Помечаем статус как неактивный (Python мог не успеть)
    try {
      const statusPath = path.join(UPLOADER_LIVE, "status.json");
      fs.writeFileSync(
        statusPath,
        JSON.stringify({
          active: false,
          stage: "stopped",
          timestamp: new Date().toISOString(),
        }),
        "utf8",
      );
    } catch {}
    UPLOADER_PROC = null;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Параметры заливки (caption + hashtags) ───────────────────────────────
const CAPTION_FILE = path.join(UPLOADER_DIR, "caption.json");

app.get("/api/uploader/caption", (req, res) => {
  try {
    if (!fs.existsSync(CAPTION_FILE)) {
      return res.json({ ok: true, caption: "", hashtags: "" });
    }
    const data = JSON.parse(fs.readFileSync(CAPTION_FILE, "utf8"));
    res.json({ ok: true, caption: data.caption || "", hashtags: data.hashtags || "" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/uploader/caption", (req, res) => {
  try {
    const caption = String((req.body && req.body.caption) || "").slice(0, 2200);
    const hashtags = String((req.body && req.body.hashtags) || "").slice(0, 1000);
    if (!fs.existsSync(UPLOADER_DIR)) {
      return res.status(404).json({ ok: false, error: "uploader dir не найден" });
    }
    fs.writeFileSync(
      CAPTION_FILE,
      JSON.stringify(
        {
          caption,
          hashtags,
          updated: new Date().toISOString(),
        },
        null,
        2,
      ),
      "utf8",
    );
    res.json({ ok: true, file: CAPTION_FILE });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Интерактивный мост (bridge.py) ───────────────────────────────────────
app.post("/api/bridge/start", (req, res) => {
  try {
    if (BRIDGE_PROC && !BRIDGE_PROC.killed) {
      return res.json({ ok: true, message: "Bridge уже запущен", pid: BRIDGE_PROC.pid });
    }
    const scriptPath = path.join(UPLOADER_DIR, "bridge.py");
    if (!fs.existsSync(scriptPath)) {
      return res.status(404).json({ ok: false, error: "bridge.py не найден" });
    }
    if (!fs.existsSync(UPLOADER_PYTHON)) {
      return res.status(500).json({ ok: false, error: "venv python не найден. Запусти setup.ps1" });
    }
    const logDir = path.join(UPLOADER_DIR, "logs");
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const bridgeLog = path.join(logDir, "runtime-bridge.log");
    const logStream = fs.createWriteStream(bridgeLog, { flags: "w" });
    logStream.write(`\n=== ${new Date().toISOString()} - spawn bridge.py ===\n`);
    const proc = spawn(UPLOADER_PYTHON, [scriptPath], {
      cwd: UPLOADER_DIR,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    proc.stdout.pipe(logStream, { end: false });
    proc.stderr.pipe(logStream, { end: false });
    BRIDGE_PROC = proc;
    proc.on("exit", (code) => {
      console.log(`[bridge] exited code=${code} pid=${proc.pid}`);
      logStream.write(`\n=== exited code=${code} at ${new Date().toISOString()} ===\n`);
      logStream.end();
      if (BRIDGE_PROC === proc) BRIDGE_PROC = null;
    });
    console.log(`[bridge] spawned pid=${proc.pid} → http://127.0.0.1:5001/ws`);
    res.json({ ok: true, pid: proc.pid, ws: "ws://127.0.0.1:5001/ws" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/bridge/stop", (req, res) => {
  if (!BRIDGE_PROC || BRIDGE_PROC.killed) {
    return res.json({ ok: true, message: "Bridge не запущен" });
  }
  try {
    if (process.platform === "win32") {
      exec(`taskkill /F /T /PID ${BRIDGE_PROC.pid}`);
    } else {
      BRIDGE_PROC.kill("SIGKILL");
    }
    BRIDGE_PROC = null;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/bridge/status", (req, res) => {
  res.json({
    ok: true,
    running: !!BRIDGE_PROC,
    pid: BRIDGE_PROC ? BRIDGE_PROC.pid : null,
    ws: "ws://127.0.0.1:5001/ws",
  });
});

app.get("/api/uploader/status", (req, res) => {
  try {
    const statusPath = path.join(UPLOADER_LIVE, "status.json");
    if (!fs.existsSync(statusPath)) {
      return res.json({ ok: true, active: false, running: !!UPLOADER_PROC });
    }
    const data = JSON.parse(fs.readFileSync(statusPath, "utf8"));
    const ageMs = Date.now() - new Date(data.timestamp).getTime();
    res.json({
      ok: true,
      active: data.active && ageMs < 5000,
      running: !!UPLOADER_PROC,
      pid: UPLOADER_PROC ? UPLOADER_PROC.pid : null,
      ...data,
      age: ageMs,
    });
  } catch (err) {
    res.json({ ok: true, active: false, running: !!UPLOADER_PROC, error: err.message });
  }
});

// ── 404 для всех неподхваченных /api/* (чтобы не отдавать HTML вместо JSON) ──
app.all("/api/*splat", (req, res) => {
  res
    .status(404)
    .json({ ok: false, success: false, error: `Эндпоинт не найден: ${req.method} ${req.path}` });
});

// SPA fallback (path-to-regexp v8+ requires explicit wildcard syntax)
app.get("/{*path}", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ── Запуск ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ FFMPEG Panel запущен: http://localhost:${PORT}`);
  console.log(`   FFMPEG: ${fs.existsSync(FFMPEG_EXE) ? "✅" : "❌"} ${FFMPEG_EXE}`);
  console.log(`   WorkDir: ${fs.existsSync(WORK_DIR) ? "✅" : "❌"} ${WORK_DIR}`);
});

module.exports = app;
