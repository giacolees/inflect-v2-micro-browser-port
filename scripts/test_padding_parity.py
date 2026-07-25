#!/usr/bin/env python3
# pyright: reportMissingImports=false
"""Confirm fixed frame padding does not alter the retained latent/audio prefix."""
import sys
from pathlib import Path

import torch

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "source" / "runtime"), str(ROOT / "source"), str(ROOT / "scripts")]
import commons  # noqa: E402
from export_onnx import LATENT_CHANNELS, MAX_FRAMES, MAX_TOKENS, PaddedSynthesisCore, load_model  # noqa: E402

model = load_model()
core = PaddedSynthesisCore(model).eval()
tokens = torch.zeros((1, MAX_TOKENS), dtype=torch.int64)
tokens[0, :8] = torch.arange(8, dtype=torch.int64)
lengths = torch.tensor([8], dtype=torch.int64)
noise = torch.zeros((1, LATENT_CHANNELS, MAX_FRAMES), dtype=torch.float32)
with torch.inference_mode():
    padded_z, frame_lengths = core(tokens, lengths, noise)
    frames = int(frame_lengths[0])
    x, means, log_scales, x_mask = model.enc_p(tokens, lengths)
    durations = torch.ceil(torch.exp(model.dp(x, x_mask)) * x_mask)
    y_mask = torch.unsqueeze(commons.sequence_mask(frame_lengths), 1).to(x_mask.dtype)
    alignment = commons.generate_path(durations, torch.unsqueeze(x_mask, 2) * torch.unsqueeze(y_mask, -1))
    means = torch.matmul(alignment.squeeze(1), means.transpose(1, 2)).transpose(1, 2)
    log_scales = torch.matmul(alignment.squeeze(1), log_scales.transpose(1, 2)).transpose(1, 2)
    reference_z = model.flow(means + noise[:, :, :frames] * torch.exp(log_scales), y_mask, reverse=True)
    latent_error = float((padded_z[:, :, :frames] - reference_z).abs().max())
    padded_audio = model.dec(padded_z[:, :, :frames])
    reference_audio = model.dec(reference_z)
    audio_error = float((padded_audio - reference_audio).abs().max())
if latent_error > 1e-5 or audio_error > 1e-5:
    raise RuntimeError(f"padding parity failed: latent={latent_error} audio={audio_error}")
print(f"PADDING_PARITY_OK frames={frames} latent_max_error={latent_error:.3g} audio_max_error={audio_error:.3g}")
