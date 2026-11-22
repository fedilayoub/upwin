# Third-party notices

upwin community is licensed under [AGPL-3.0-only](LICENSE). It also contains code and files
copied from the projects below, which keep their own licenses. npm dependencies are not listed
here: each one ships its license inside its package.

## Apache License 2.0

| What | Where | Source |
|---|---|---|
| MediaPipe Tasks Vision runtime (`vision_wasm_internal.js`, `vision_wasm_internal.wasm`) | `extension/public/mediapipe/` | [google-ai-edge/mediapipe](https://github.com/google-ai-edge/mediapipe), npm `@mediapipe/tasks-vision` 1.2.2. Copyright Google LLC. |
| Selfie multiclass segmentation model (`selfie_multiclass_256x256.tflite`) | `extension/public/mediapipe/` | MediaPipe image segmenter models, licensed Apache 2.0 per Google's model card. Copyright Google LLC. |

The full license text is in [extension/public/mediapipe/LICENSE](extension/public/mediapipe/LICENSE),
which ships in the extension build next to these files.

## MIT License

| What | Where | Copyright |
|---|---|---|
| [shadcn/ui](https://github.com/shadcn-ui/ui) components and the shimmer utility | `front/components/ui/`, `extension/components/ui/`, `extension/features/theme/shimmer.css` | Copyright (c) 2023 shadcn |
| [EvilCharts](https://github.com/legions-developer/evilcharts) charts, ported to Apache ECharts | `front/components/evilcharts/`, `extension/components/charts/echarts/` | Copyright (c) 2026 Gurbinder |
| [SPEC-01](https://github.com/shuding/spec-01) hardware controls and skin | `front/components/ui/hardware/` | Copyright (c) 2026 Shu Ding |
| [Kibo UI](https://github.com/haydenbleasel/kibo) kanban | `front/components/ui/kanban.tsx` | Copyright (c) 2023 — Present shadcnblocks |
| [Magic UI](https://github.com/magicuidesign/magicui) animated beam | `front/components/ui/animated-beam.tsx` | Copyright (c) Magic UI |

Each of these is distributed under the following terms:

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software
> and associated documentation files (the "Software"), to deal in the Software without
> restriction, including without limitation the rights to use, copy, modify, merge, publish,
> distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
> Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or
> substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
> BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
> NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
> DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
