#!/usr/bin/env python3
# pyright: reportMissingImports=false
"""Export the synthesis graph with externally supplied latent noise."""
import sys
from pathlib import Path
from typing import Any

import torch

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "source" / "runtime"), str(ROOT / "source")]
import commons  # noqa: E402
import utils  # noqa: E402
from models import SynthesizerTrn  # noqa: E402
from text.symbols import symbols  # noqa: E402

MAX_FRAMES = 4000

class DeterministicSynthesis(torch.nn.Module):
    def __init__(self, model: SynthesizerTrn):
        super().__init__()
        self.model = model

    def forward(self, tokens: torch.Tensor, lengths: torch.Tensor, latent_noise: torch.Tensor):
        x, means, log_scales, x_mask = self.model.enc_p(tokens, lengths)
        log_durations = self.model.dp(x, x_mask)
        durations = torch.ceil(torch.exp(log_durations) * x_mask)
        frame_lengths = torch.clamp_min(torch.sum(durations, [1, 2]), 1).long()
        y_mask = torch.unsqueeze(commons.sequence_mask(frame_lengths, MAX_FRAMES), 1).to(x_mask.dtype)
        alignment = commons.generate_path(durations, torch.unsqueeze(x_mask, 2) * torch.unsqueeze(y_mask, -1))
        means = torch.matmul(alignment.squeeze(1), means.transpose(1, 2)).transpose(1, 2)
        log_scales = torch.matmul(alignment.squeeze(1), log_scales.transpose(1, 2)).transpose(1, 2)
        z_prior = means + latent_noise[:, :, :MAX_FRAMES] * torch.exp(log_scales)
        z = self.model.flow(z_prior, y_mask, reverse=True)
        return self.model.dec(z * y_mask)

def main() -> None:
    hps: Any = utils.get_hparams_from_file(str(ROOT / "source" / "config.json"))
    model = SynthesizerTrn(len(symbols), hps.data.filter_length // 2 + 1,
        hps.train.segment_size // hps.data.hop_length, **hps.model).eval()
    utils.load_checkpoint(str(ROOT / "source" / "model.pth"), model, None)
    from inference import optimize_for_inference
    optimize_for_inference(model)
    wrapper = DeterministicSynthesis(model).eval()
    tokens = torch.tensor([[1, 2, 3, 4]], dtype=torch.int64)
    lengths = torch.tensor([4], dtype=torch.int64)
    noise = torch.zeros((1, 192, MAX_FRAMES), dtype=torch.float32)
    output = ROOT / "artifacts" / "inflect-synthesis.onnx"
    output.parent.mkdir(exist_ok=True)
    torch.onnx.export(wrapper, (tokens, lengths, noise), output, opset_version=18,
        input_names=["tokens", "lengths", "latent_noise"], output_names=["waveform"],
        dynamic_axes={"tokens": {1: "tokens"}, "lengths": {0: "batch"}, "waveform": {2: "samples"}},
        dynamo=False)
    print(f"ONNX_EXPORT_OK {output}")

if __name__ == "__main__":
    main()
