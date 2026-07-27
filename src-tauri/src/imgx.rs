// Decoding that agrees with what the user is looking at.
//
// A photo off a phone or a mirrorless body is usually stored in the sensor's
// own orientation with an EXIF tag saying how to turn it. Browsers apply that
// tag when they paint an <img>, so the preview in the app is already upright —
// but the ncnn engines and the `image` crate's plain `load_from_memory` both
// ignore it. The result came back rotated relative to the original it was
// supposed to be compared against.
//
// Everything that reads user image bytes goes through here so the whole
// pipeline sees the same picture the preview does.

use std::io::Cursor;

use image::{metadata::Orientation, DynamicImage, ImageDecoder, ImageReader};

/// Decode `bytes`, applying the EXIF orientation. Also returns the orientation
/// that was applied, so callers can skip work when there was nothing to do.
pub fn decode_oriented(bytes: &[u8]) -> Result<(DynamicImage, Orientation), String> {
    let reader = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|e| format!("не удалось определить формат: {e}"))?;
    let mut decoder = reader
        .into_decoder()
        .map_err(|e| format!("не удалось прочитать изображение: {e}"))?;
    // A missing or malformed tag just means "upright".
    let orientation = decoder.orientation().unwrap_or(Orientation::NoTransforms);
    let mut img = DynamicImage::from_decoder(decoder)
        .map_err(|e| format!("не удалось декодировать изображение: {e}"))?;
    img.apply_orientation(orientation);
    Ok((img, orientation))
}

/// Read the EXIF orientation without decoding the pixels.
pub fn orientation_of(bytes: &[u8]) -> Orientation {
    ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .ok()
        .and_then(|r| r.into_decoder().ok())
        .and_then(|mut d| d.orientation().ok())
        .unwrap_or(Orientation::NoTransforms)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A 2×1 JPEG with no EXIF at all must read as upright, not as an error.
    #[test]
    fn missing_exif_reads_as_upright() {
        let img = DynamicImage::new_rgb8(2, 1);
        let mut buf = Cursor::new(Vec::new());
        img.write_to(&mut buf, image::ImageFormat::Jpeg).unwrap();
        let bytes = buf.into_inner();
        assert_eq!(orientation_of(&bytes), Orientation::NoTransforms);
        let (out, o) = decode_oriented(&bytes).unwrap();
        assert_eq!(o, Orientation::NoTransforms);
        assert_eq!((out.width(), out.height()), (2, 1));
    }

    /// Rotate90 has to actually swap the reported dimensions — that swap is the
    /// whole reason the upscaled result used to come back sideways.
    #[test]
    fn rotate90_swaps_dimensions() {
        let mut img = DynamicImage::new_rgb8(4, 2);
        img.apply_orientation(Orientation::Rotate90);
        assert_eq!((img.width(), img.height()), (2, 4));
    }

    #[test]
    fn exif_tag_6_is_rotate90() {
        // Tag 6 is the common "camera held on its side" value.
        assert_eq!(Orientation::from_exif(6), Some(Orientation::Rotate90));
        assert_eq!(Orientation::from_exif(1), Some(Orientation::NoTransforms));
    }
}
