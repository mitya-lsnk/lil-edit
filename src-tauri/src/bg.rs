// Background removal via ONNX models (BiRefNet / U²-Net / IS-Net / Silueta) run
// with onnxruntime (the `ort` crate). Preprocessing matches rembg so the
// downloaded weights behave as expected.

use std::path::PathBuf;

use image::{imageops::FilterType, GenericImageView};
use ort::session::{builder::GraphOptimizationLevel, Session};
use ort::value::Tensor;
use tauri::ipc::{Request, Response};
use tauri::AppHandle;

use crate::ipcx;

/// Per-model input size and normalization (mean, std), matching rembg.
fn model_params(id: &str) -> (usize, [f32; 3], [f32; 3]) {
    match id {
        // BiRefNet: 1024² input, ImageNet normalization.
        "birefnet" => (1024, [0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        "isnet-general-use" => (1024, [0.5, 0.5, 0.5], [1.0, 1.0, 1.0]),
        // u2net, u2netp, silueta
        _ => (320, [0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    }
}

fn model_path(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    let file = match id {
        "birefnet" => "birefnet.onnx",
        "u2net" => "u2net.onnx",
        "u2netp" => "u2netp.onnx",
        "isnet-general-use" => "isnet-general-use.onnx",
        "silueta" => "silueta.onnx",
        other => return Err(format!("Неизвестная модель: {other}")),
    };
    let p = crate::models::models_dir(app)?.join(file);
    if !p.is_file() {
        return Err(format!("Модель {id} не скачана"));
    }
    Ok(p)
}

/// Image in and cut-out out both travel as raw IPC bodies rather than JSON number
/// arrays — see `ipcx` for why that matters at these sizes.
#[tauri::command]
pub async fn remove_background(app: AppHandle, request: Request<'_>) -> Result<Response, String> {
    let image = ipcx::raw_body(&request)?;
    let model_id = ipcx::header(&request, "x-model")?;
    let path = model_path(&app, &model_id)?;
    // Inference is CPU-heavy and blocking; run off the async runtime.
    let out = tokio::task::spawn_blocking(move || remove_bg_bytes(&path, &model_id, &image))
        .await
        .map_err(|e| e.to_string())??;
    Ok(Response::new(out))
}

/// Pure inference: given a model file path, its id (for preprocessing params),
/// and image bytes, return an RGBA PNG with the background cut out.
pub fn remove_bg_bytes(
    path: &std::path::Path,
    model_id: &str,
    image_bytes: &[u8],
) -> Result<Vec<u8>, String> {
    let (size, mean, std) = model_params(model_id);

    // Oriented, so a phone photo comes back the way the preview showed it.
    let (img, _) = crate::imgx::decode_oriented(image_bytes)?;
    let (ow, oh) = img.dimensions();

    // ---- preprocess: resize to size×size, normalize, NCHW ----
    let resized = img
        .resize_exact(size as u32, size as u32, FilterType::Triangle)
        .to_rgb8();
    let plane = size * size;
    let mut data = vec![0f32; 3 * plane];
    for (x, y, px) in resized.enumerate_pixels() {
        let (x, y) = (x as usize, y as usize);
        for c in 0..3 {
            let v = px[c] as f32 / 255.0;
            data[c * plane + y * size + x] = (v - mean[c]) / std[c];
        }
    }

    // ---- load + run (onnxruntime via ort) ----
    // We run exactly one inference per session, so ORT's memory-pattern arena
    // (which pre-allocates activation buffers for reuse across runs) is pure
    // overhead — disabling it cuts peak RSS a lot on big models like BiRefNet.
    // Threads are capped for the same reason: each intra-op thread keeps its
    // own arena.
    let threads = std::thread::available_parallelism()
        .map(|n| n.get().min(4))
        .unwrap_or(2);
    let mut session = Session::builder()
        .map_err(|e| e.to_string())?
        .with_optimization_level(GraphOptimizationLevel::Level3)
        .map_err(|e| e.to_string())?
        .with_memory_pattern(false)
        .map_err(|e| e.to_string())?
        // NB: leave the CPU arena ON. Measured on BiRefNet/1024²: arena off
        // pushes peak RSS from 8.1 GB to 10.1 GB, because block reuse matters
        // more here than returning memory to the OS.
        .with_intra_threads(threads)
        .map_err(|e| e.to_string())?
        .commit_from_file(path)
        .map_err(|e| format!("Ошибка загрузки модели: {e}"))?;

    let input =
        Tensor::from_array(([1_usize, 3, size, size], data)).map_err(|e| e.to_string())?;
    let outputs = session
        .run(ort::inputs![input])
        .map_err(|e| format!("Ошибка инференса: {e}"))?;

    // First output is the saliency mask (1,1,size,size).
    let (_shape, flat) = outputs[0]
        .try_extract_tensor::<f32>()
        .map_err(|e| e.to_string())?;
    let expected = size * size;
    if flat.len() < expected {
        return Err(format!(
            "Неожиданный размер выхода модели: {} (ожидалось ≥ {expected})",
            flat.len()
        ));
    }

    let (mut mi, mut ma) = (f32::INFINITY, f32::NEG_INFINITY);
    for &v in &flat[..expected] {
        mi = mi.min(v);
        ma = ma.max(v);
    }

    // How the raw output becomes 0..1 depends on whether the graph ends in a
    // sigmoid. U²-Net/IS-Net exports do, so their output is already 0..1 and
    // min-max stretching just adds contrast. BiRefNet's export does NOT — it
    // emits raw logits, and min-max on logits maps the *least* background-like
    // pixel to 0 while ordinary background lands well above it, leaving a faint
    // ghost of the background over the whole cut-out. Detect the range and
    // squash logits with a sigmoid instead.
    let is_logits = mi < -0.01 || ma > 1.01;
    let range = if (ma - mi).abs() < 1e-6 { 1.0 } else { ma - mi };

    // Build a size×size grayscale mask, then resize back to original.
    let mut mask_img = image::GrayImage::new(size as u32, size as u32);
    for y in 0..size {
        for x in 0..size {
            let raw = flat[y * size + x];
            let v = if is_logits {
                1.0 / (1.0 + (-raw).exp())
            } else {
                (raw - mi) / range
            };
            // Snap the near-flat tails: models leave a little noise in fully
            // transparent / fully opaque regions, which reads as a haze.
            let a = (v * 255.0).clamp(0.0, 255.0) as u8;
            let a = match a {
                0..=10 => 0,
                245..=255 => 255,
                other => other,
            };
            mask_img.put_pixel(x as u32, y as u32, image::Luma([a]));
        }
    }
    drop(outputs);
    let mask_full = image::imageops::resize(&mask_img, ow, oh, FilterType::Triangle);

    // The weights are no longer needed; free them before allocating the
    // full-resolution output (BiRefNet alone is ~1 GB resident).
    drop(session);

    // ---- compose RGBA ----
    // Convert once and patch alpha in place: building a second RgbaImage here
    // doubled peak memory on large images for no reason.
    let mut out = img.into_rgba8();
    for (x, y, px) in out.enumerate_pixels_mut() {
        px[3] = mask_full.get_pixel(x, y)[0];
    }
    drop(mask_full);

    // Encode PNG.
    let mut buf = std::io::Cursor::new(Vec::new());
    out.write_to(&mut buf, image::ImageFormat::Png)
        .map_err(|e| format!("Ошибка кодирования PNG: {e}"))?;
    Ok(buf.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    // End-to-end check: real u2netp weights + tract inference on the sample image.
    // Downloads the model once into the OS temp dir. Ignored by default so normal
    // `cargo test` stays offline; run with `cargo test -- --ignored`.
    #[test]
    #[ignore]
    fn u2netp_produces_alpha_mask() {
        let model = std::env::temp_dir().join("u2netp.onnx");
        if !model.is_file() {
            let status = Command::new("curl")
                .args([
                    "-sL",
                    "-o",
                    model.to_str().unwrap(),
                    "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx",
                ])
                .status()
                .expect("curl");
            assert!(status.success(), "download failed");
        }

        let sample = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("sample.png");
        let bytes = std::fs::read(&sample).expect("read sample.png");

        let out = remove_bg_bytes(&model, "u2netp", &bytes).expect("inference");

        // Result must be a valid PNG that decodes to RGBA with varying alpha.
        let img = image::load_from_memory(&out).expect("decode output");
        let rgba = img.to_rgba8();
        let mut min_a = 255u8;
        let mut max_a = 0u8;
        for p in rgba.pixels() {
            min_a = min_a.min(p[3]);
            max_a = max_a.max(p[3]);
        }
        assert!(
            max_a > min_a,
            "alpha channel is flat ({min_a}..{max_a}) — mask did not vary"
        );
        eprintln!("OK: {}x{}, alpha {}..{}", rgba.width(), rgba.height(), min_a, max_a);
    }

    /// BiRefNet emits raw logits, so the old min-max path left every background
    /// pixel semi-opaque (a visible haze over the whole cut-out). Guard the
    /// sigmoid path: the background must come out *fully* transparent, and the
    /// mask must be mostly decided rather than a field of mid greys.
    ///
    /// Uses the already-downloaded model; skipped if it isn't there. Run with
    /// `cargo test -- --ignored birefnet`.
    #[test]
    #[ignore]
    fn birefnet_background_is_fully_transparent() {
        let model = dirs_models().join("birefnet.onnx");
        if !model.is_file() {
            eprintln!("SKIP: {} not downloaded", model.display());
            return;
        }
        let sample = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("sample.png");
        let bytes = std::fs::read(&sample).expect("read sample.png");

        let out = remove_bg_bytes(&model, "birefnet", &bytes).expect("inference");
        let rgba = image::load_from_memory(&out).expect("decode").to_rgba8();

        let total = rgba.pixels().len() as f64;
        let fully_clear = rgba.pixels().filter(|p| p[3] == 0).count() as f64;
        let fully_solid = rgba.pixels().filter(|p| p[3] == 255).count() as f64;
        let midtones = rgba
            .pixels()
            .filter(|p| p[3] > 16 && p[3] < 239)
            .count() as f64;
        eprintln!(
            "alpha: {:.1}% clear, {:.1}% solid, {:.1}% midtone",
            fully_clear / total * 100.0,
            fully_solid / total * 100.0,
            midtones / total * 100.0
        );

        assert!(
            fully_clear > 0.05 * total,
            "no fully-transparent background: only {:.2}% at alpha=0 — logits were not squashed",
            fully_clear / total * 100.0
        );
        assert!(
            midtones < 0.25 * total,
            "mask is mostly midtones ({:.1}%) — looks like the min-max haze",
            midtones / total * 100.0
        );
    }

    /// Where the running app keeps downloaded weights (macOS).
    fn dirs_models() -> PathBuf {
        PathBuf::from(std::env::var("HOME").unwrap_or_default())
            .join("Library/Application Support/com.lil.image/models")
    }
}
