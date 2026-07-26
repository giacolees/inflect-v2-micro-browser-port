#!/usr/bin/env python3
# pyright: reportMissingImports=false
"""Export FP16-weight dynamic ONNX graphs tuned for ORT-Web WebGPU."""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import onnx
import torch
from torch import nn

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "source" / "runtime"), str(ROOT / "source")]
import commons  # noqa: E402
import utils  # noqa: E402
from models import SynthesizerTrn  # noqa: E402
from text.symbols import symbols  # noqa: E402


class DurationWebGPU(nn.Module):
    """Dynamic duration graph with FP16 internals and FP32 boundaries."""

    def __init__(self, model: SynthesizerTrn):
        super().__init__()
        self.enc_p = model.enc_p
        self.dp = model.dp

    def forward(
        self,
        tokens: torch.Tensor,
        lengths: torch.Tensor,
        length_scale: torch.Tensor,
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        hidden, means, log_scales, x_mask = self.enc_p(tokens, lengths)
        log_durations = self.dp(hidden, x_mask)
        durations = torch.ceil(
            torch.exp(log_durations) * x_mask * length_scale.to(x_mask.dtype)
        )
        frame_lengths = torch.clamp_min(torch.sum(durations, [1, 2]), 1).long()
        y_mask = torch.unsqueeze(commons.sequence_mask(frame_lengths, None), 1).to(
            x_mask.dtype
        )
        alignment = commons.generate_path(
            durations,
            torch.unsqueeze(x_mask, 2) * torch.unsqueeze(y_mask, -1),
        )
        means = torch.matmul(
            alignment.squeeze(1), means.transpose(1, 2)
        ).transpose(1, 2)
        log_scales = torch.matmul(
            alignment.squeeze(1), log_scales.transpose(1, 2)
        ).transpose(1, 2)
        return means.float(), log_scales.float(), y_mask.float()


class DecodeWebGPU(nn.Module):
    """FP16 flow/decoder with FP32 inputs and waveform output."""

    def __init__(self, model: SynthesizerTrn):
        super().__init__()
        self.flow = model.flow
        self.decoder = model.dec

    def forward(
        self,
        means: torch.Tensor,
        log_scales: torch.Tensor,
        y_mask: torch.Tensor,
        latent_noise: torch.Tensor,
        noise_scale: torch.Tensor,
    ) -> torch.Tensor:
        means_half = means.half()
        logs_half = log_scales.half()
        mask_half = y_mask.half()
        noise_half = latent_noise.half()
        z_prior = (
            means_half
            + noise_half * torch.exp(logs_half) * noise_scale.to(torch.float16)
        )
        latent = self.flow(z_prior, mask_half, reverse=True)
        return self.decoder(latent * mask_half).float()


def load_model(*, fp16: bool) -> SynthesizerTrn:
    hps: Any = utils.get_hparams_from_file(str(ROOT / "source" / "config.json"))
    model = SynthesizerTrn(
        len(symbols),
        hps.data.filter_length // 2 + 1,
        hps.train.segment_size // hps.data.hop_length,
        **hps.model,
    ).eval()
    utils.load_checkpoint(str(ROOT / "source" / "model.pth"), model, None)
    return model.half() if fp16 else model


def main() -> None:
    duration = DurationWebGPU(load_model(fp16=False)).eval()
    decoder = DecodeWebGPU(load_model(fp16=True)).eval()
    tokens = torch.tensor(
        [[0, 18, 0, 61, 0, 55, 0, 48, 0, 44, 0, 46, 0]], dtype=torch.int64
    )
    lengths = torch.tensor([tokens.shape[1]], dtype=torch.int64)
    length_scale = torch.tensor(1.0, dtype=torch.float32)
    output = ROOT / "artifacts" / "webgpu"
    output.mkdir(parents=True, exist_ok=True)

    torch.onnx.export(
        duration,
        (tokens, lengths, length_scale),
        output / "duration.onnx",
        input_names=["tokens", "lengths", "length_scale"],
        output_names=["m_p_exp", "logs_p_exp", "y_mask"],
        dynamic_axes={
            "tokens": {1: "text_len"},
            "m_p_exp": {2: "mel_len"},
            "logs_p_exp": {2: "mel_len"},
            "y_mask": {2: "mel_len"},
        },
        opset_version=17,
        do_constant_folding=True,
        dynamo=False,
    )
    with torch.no_grad():
        means, logs, mask = duration(tokens, lengths, length_scale)
    noise = torch.zeros_like(means)
    variation = torch.tensor(0.667, dtype=torch.float32)
    torch.onnx.export(
        decoder,
        (means, logs, mask, noise, variation),
        output / "decode.onnx",
        input_names=[
            "m_p_exp",
            "logs_p_exp",
            "y_mask",
            "zp_noise",
            "noise_scale",
        ],
        output_names=["waveform"],
        dynamic_axes={
            "m_p_exp": {2: "mel_len"},
            "logs_p_exp": {2: "mel_len"},
            "y_mask": {2: "mel_len"},
            "zp_noise": {2: "mel_len"},
            "waveform": {2: "wav_len"},
        },
        opset_version=17,
        do_constant_folding=True,
        dynamo=False,
    )
    for path in (output / "duration.onnx", output / "decode.onnx"):
        onnx.checker.check_model(onnx.load(path))
    print(f"WEBGPU_ONNX_EXPORT_OK output={output}")


if __name__ == "__main__":
    main()
