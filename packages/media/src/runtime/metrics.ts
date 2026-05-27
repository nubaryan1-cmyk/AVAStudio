import { stat } from "node:fs/promises";

import { probe } from "../ffmpeg/probe.js";

export interface RenderMetrics {
  inputDurationSec: number;
  renderDurationMs: number;
  ratio: number;
  outputSizeBytes: number;
  outputResolution: string;
  presetChain: string[];
  exitCode: number;
  encoder: string;
}

export interface CollectMetricsParams {
  inputDurationSec: number;
  startedAt: number;
  finishedAt: number;
  outputPath: string;
  presetChain: string[];
  exitCode: number;
  encoder: string;
  ffprobePath?: string;
}

/** Собирает метрики рендера (для последующей записи в render_metrics — БД в ЭТАПЕ 7). */
export async function collectRenderMetrics(params: CollectMetricsParams): Promise<RenderMetrics> {
  const renderDurationMs = params.finishedAt - params.startedAt;
  const { size } = await stat(params.outputPath);
  const data = await probe(
    params.outputPath,
    params.ffprobePath ? { ffprobePath: params.ffprobePath } : {},
  );
  const resolution = data.video ? `${data.video.width}x${data.video.height}` : "0x0";
  const ratio = params.inputDurationSec > 0 ? renderDurationMs / 1000 / params.inputDurationSec : 0;
  return {
    inputDurationSec: params.inputDurationSec,
    renderDurationMs,
    ratio,
    outputSizeBytes: size,
    outputResolution: resolution,
    presetChain: params.presetChain,
    exitCode: params.exitCode,
    encoder: params.encoder,
  };
}
