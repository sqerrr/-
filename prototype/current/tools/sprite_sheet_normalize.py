#!/usr/bin/env python3
"""Split and normalise AI/authored sprite sheets into canonical fixed cells.

The game deliberately renders the complete fixed cell. Transparent margins are therefore part of
animation geometry instead of being silently trimmed and stretched per frame. This tool makes that
contract practical for generated art: each tile is alpha-cropped, resized to a common body height,
and re-anchored to one bottom-centre pivot before the final fixed-cell sheet is written.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from PIL import Image


def bbox_alpha(im: Image.Image, threshold: int) -> tuple[int, int, int, int] | None:
    a = im.getchannel('A')
    if threshold <= 0:
        return a.getbbox()
    mask = a.point(lambda v: 255 if v >= threshold else 0)
    return mask.getbbox()


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument('input', type=Path)
    p.add_argument('output', type=Path)
    p.add_argument('--rows', type=int, required=True)
    p.add_argument('--cols', type=int, required=True)
    p.add_argument('--cell', type=int, default=192, help='square output cell size')
    p.add_argument('--target-height', type=int, default=146)
    p.add_argument('--foot-y', type=int, default=170)
    p.add_argument('--alpha-threshold', type=int, default=8)
    p.add_argument('--report', type=Path)
    args = p.parse_args()

    src = Image.open(args.input).convert('RGBA')
    if src.width % args.cols or src.height % args.rows:
        raise SystemExit(
            f'input {src.width}x{src.height} is not divisible by grid {args.cols}x{args.rows}'
        )
    in_w, in_h = src.width // args.cols, src.height // args.rows
    out = Image.new('RGBA', (args.cols * args.cell, args.rows * args.cell), (0, 0, 0, 0))
    report: list[dict[str, object]] = []

    for row in range(args.rows):
        for col in range(args.cols):
            tile = src.crop((col * in_w, row * in_h, (col + 1) * in_w, (row + 1) * in_h))
            box = bbox_alpha(tile, args.alpha_threshold)
            entry: dict[str, object] = {'row': row, 'col': col, 'source_box': box}
            if not box:
                report.append({**entry, 'empty': True})
                continue
            body = tile.crop(box)
            scale = args.target_height / max(1, body.height)
            new_w = max(1, round(body.width * scale))
            new_h = max(1, round(body.height * scale))
            body = body.resize((new_w, new_h), Image.Resampling.LANCZOS)
            x = col * args.cell + (args.cell - new_w) // 2
            y = row * args.cell + args.foot_y - new_h
            out.alpha_composite(body, (x, y))
            entry.update(
                {
                    'empty': False,
                    'scale': round(scale, 5),
                    'output_size': [new_w, new_h],
                    'pivot': [args.cell // 2, args.foot_y],
                    'overflow': new_w > args.cell or y < row * args.cell,
                }
            )
            report.append(entry)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    out.save(args.output)
    report_path = args.report or args.output.with_suffix('.qa.json')
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
