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

/// The embedded ICC colour profile, if the file carries one.
pub fn icc_of(bytes: &[u8]) -> Option<Vec<u8>> {
    ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .ok()
        .and_then(|r| r.into_decoder().ok())
        .and_then(|mut d| d.icc_profile().ok())
        .flatten()
        .filter(|p| !p.is_empty())
}

// ---------------------------------------------------------------------------
// Carrying the colour profile through
//
// Cameras often tag their files Adobe RGB or Display P3. The webview honours
// that tag when it paints the preview, but the ncnn engines write a bare PNG
// with no profile at all — so the result got interpreted as sRGB. Wide-gamut
// numbers read as sRGB land on *less* saturated colours, which is exactly the
// "washed out, less hue" the eye picks up next to the untouched original.
//
// The engine's output is re-tagged rather than re-encoded: a 4× of a 16 MP
// photo is a quarter of a gigabyte of pixels, and splicing one chunk into the
// PNG byte stream costs a memcpy instead of a decode plus a deflate.
// ---------------------------------------------------------------------------

const PNG_SIG: &[u8; 8] = b"\x89PNG\r\n\x1a\n";

/// Tag `png` with `icc`. Returns the input untouched if it isn't a PNG, or if
/// it already carries colour information of its own.
pub fn png_with_icc(png: Vec<u8>, icc: &[u8]) -> Vec<u8> {
    match splice_iccp(&png, icc) {
        Some(out) => out,
        None => png,
    }
}

fn splice_iccp(png: &[u8], icc: &[u8]) -> Option<Vec<u8>> {
    if png.len() < 8 || &png[..8] != PNG_SIG {
        return None;
    }
    // Walk the chunk list: find the end of IHDR, and bail out if the encoder
    // already said something about colour (iCCP and sRGB must not coexist).
    let mut pos = 8usize;
    let mut insert_at = None;
    while pos + 8 <= png.len() {
        let len = u32::from_be_bytes(png[pos..pos + 4].try_into().ok()?) as usize;
        let kind = &png[pos + 4..pos + 8];
        let end = pos.checked_add(12)?.checked_add(len)?;
        if end > png.len() {
            return None; // truncated
        }
        match kind {
            b"IHDR" => insert_at = Some(end),
            b"iCCP" | b"sRGB" => return None,
            // Anything from here on must come after iCCP anyway.
            b"PLTE" | b"IDAT" | b"IEND" => break,
            _ => {}
        }
        pos = end;
    }
    let at = insert_at?;

    let mut data = Vec::with_capacity(icc.len() / 2 + 16);
    data.extend_from_slice(b"ICC profile\0"); // name, null-terminated
    data.push(0); // compression method: zlib
    let mut enc = flate2::write::ZlibEncoder::new(data, flate2::Compression::default());
    std::io::Write::write_all(&mut enc, icc).ok()?;
    let data = enc.finish().ok()?;

    let mut crc = flate2::Crc::new();
    crc.update(b"iCCP");
    crc.update(&data);

    let mut out = Vec::with_capacity(png.len() + data.len() + 12);
    out.extend_from_slice(&png[..at]);
    out.extend_from_slice(&(data.len() as u32).to_be_bytes());
    out.extend_from_slice(b"iCCP");
    out.extend_from_slice(&data);
    out.extend_from_slice(&crc.sum().to_be_bytes());
    out.extend_from_slice(&png[at..]);
    Some(out)
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

    /// Build a small PNG the way an engine would: no colour information at all.
    fn bare_png() -> Vec<u8> {
        let img = DynamicImage::new_rgb8(8, 8);
        let mut buf = Cursor::new(Vec::new());
        img.write_to(&mut buf, image::ImageFormat::Png).unwrap();
        buf.into_inner()
    }

    /// The spliced file has to still be a readable PNG with the same pixels,
    /// and the profile has to survive the round trip.
    #[test]
    fn iccp_is_spliced_and_readable() {
        let png = bare_png();
        let icc = b"not-a-real-profile-but-opaque-bytes".repeat(4);
        let out = png_with_icc(png.clone(), &icc);

        assert!(out.len() > png.len(), "chunk was not inserted");
        let decoded = image::load_from_memory(&out).expect("still a valid PNG");
        assert_eq!((decoded.width(), decoded.height()), (8, 8));
        assert_eq!(icc_of(&out).as_deref(), Some(icc.as_slice()));
    }

    /// Never write a second one, and never fight an sRGB chunk.
    #[test]
    fn existing_colour_information_is_left_alone() {
        let once = png_with_icc(bare_png(), b"profile");
        let twice = png_with_icc(once.clone(), b"other");
        assert_eq!(once, twice, "a second iCCP was written");
    }

    /// Anything that isn't a PNG comes back untouched rather than corrupted.
    #[test]
    fn non_png_input_is_returned_unchanged() {
        let jpeg = {
            let mut b = Cursor::new(Vec::new());
            DynamicImage::new_rgb8(4, 4)
                .write_to(&mut b, image::ImageFormat::Jpeg)
                .unwrap();
            b.into_inner()
        };
        assert_eq!(png_with_icc(jpeg.clone(), b"profile"), jpeg);
        assert_eq!(png_with_icc(vec![1, 2, 3], b"profile"), vec![1, 2, 3]);
        assert_eq!(png_with_icc(Vec::new(), b"profile"), Vec::<u8>::new());
    }

    #[test]
    fn exif_tag_6_is_rotate90() {
        // Tag 6 is the common "camera held on its side" value.
        assert_eq!(Orientation::from_exif(6), Some(Orientation::Rotate90));
        assert_eq!(Orientation::from_exif(1), Some(Orientation::NoTransforms));
    }

    // ---- iCCP splice, byte by byte -------------------------------------------
    // The tests below build PNG files by hand so each one can pin a single rule
    // of the chunk walk: where the profile lands, and when the file is left alone.

    /// One PNG chunk, with a correct length and CRC.
    fn chunk(kind: &[u8; 4], data: &[u8]) -> Vec<u8> {
        let mut crc = flate2::Crc::new();
        crc.update(kind);
        crc.update(data);
        let mut out = (data.len() as u32).to_be_bytes().to_vec();
        out.extend_from_slice(kind);
        out.extend_from_slice(data);
        out.extend_from_slice(&crc.sum().to_be_bytes());
        out
    }

    /// A 1×1 RGB header. 8 (signature) + 25 = 33: where the profile must land.
    fn ihdr() -> Vec<u8> {
        chunk(b"IHDR", &[0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0])
    }

    const AFTER_IHDR: usize = 33;

    fn png_of(parts: &[&[u8]]) -> Vec<u8> {
        let mut out = PNG_SIG.to_vec();
        for p in parts {
            out.extend_from_slice(p);
        }
        out
    }

    /// Read the iCCP chunk at `at`: checks its framing, returns the profile and
    /// the offset just past the chunk.
    fn read_iccp(png: &[u8], at: usize) -> (Vec<u8>, usize) {
        use std::io::Read;
        let len = u32::from_be_bytes(png[at..at + 4].try_into().unwrap()) as usize;
        assert_eq!(&png[at + 4..at + 8], b"iCCP");
        let data = &png[at + 8..at + 8 + len];
        let mut crc = flate2::Crc::new();
        crc.update(b"iCCP");
        crc.update(data);
        let stored = u32::from_be_bytes(png[at + 8 + len..at + 12 + len].try_into().unwrap());
        assert_eq!(stored, crc.sum(), "CRC does not match the chunk");
        assert_eq!(&data[..13], b"ICC profile\0\0", "name, terminator, method 0");
        let mut icc = Vec::new();
        flate2::read::ZlibDecoder::new(&data[13..])
            .read_to_end(&mut icc)
            .unwrap();
        (icc, at + 12 + len)
    }

    /// The profile goes right after IHDR, ahead of everything else, and the rest
    /// of the file is carried over untouched.
    #[test]
    fn profile_lands_directly_after_ihdr() {
        let gama = chunk(b"gAMA", &[0, 0, 0xb1, 0x8f]);
        let idat = chunk(b"IDAT", &[1, 2, 3]);
        let iend = chunk(b"IEND", &[]);
        let png = png_of(&[&ihdr(), &gama, &idat, &iend]);
        let icc = b"profile bytes".repeat(10);

        let out = png_with_icc(png.clone(), &icc);

        assert_eq!(&out[..AFTER_IHDR], &png[..AFTER_IHDR]);
        let (got, end) = read_iccp(&out, AFTER_IHDR);
        assert_eq!(got, icc);
        assert_eq!(&out[end..], &png[AFTER_IHDR..], "the rest moved or changed");
    }

    /// A file that is nothing but a header is still a PNG we can tag; the walk
    /// must not read the end of the buffer as a truncated chunk.
    #[test]
    fn header_only_png_is_tagged() {
        let png = png_of(&[&ihdr()]);
        let out = png_with_icc(png.clone(), b"profile");
        assert_ne!(out, png, "left alone");
        let (got, end) = read_iccp(&out, AFTER_IHDR);
        assert_eq!(got, b"profile");
        assert_eq!(end, out.len());
    }

    /// A chunk header with no room for its CRC is a cut-off file: leave it.
    #[test]
    fn chunk_header_at_the_very_end_is_a_truncated_file() {
        let png = png_of(&[&ihdr(), &[0, 0, 0, 0], b"tEXt"]);
        assert_eq!(png_with_icc(png.clone(), b"profile"), png);
    }

    /// A chunk that claims more bytes than the file has: leave it.
    #[test]
    fn chunk_longer_than_the_file_is_a_truncated_file() {
        let png = png_of(&[&ihdr(), &[0, 0, 0x03, 0xe8], b"tEXt", b"short"]);
        assert_eq!(png_with_icc(png.clone(), b"profile"), png);
    }

    /// A few stray bytes after the last whole chunk are too short to be a header.
    /// They are not an error and must not be read past the end of the buffer.
    #[test]
    fn stray_tail_shorter_than_a_header_is_carried_over() {
        let png = png_of(&[&ihdr(), &[7, 7, 7]]);
        let out = png_with_icc(png.clone(), b"profile");
        let (got, end) = read_iccp(&out, AFTER_IHDR);
        assert_eq!(got, b"profile");
        assert_eq!(&out[end..], &[7, 7, 7]);
    }

    /// Pixel data before any header means there is no place to put the profile.
    #[test]
    fn pixel_data_without_a_header_is_left_alone() {
        let png = png_of(&[&chunk(b"IDAT", &[1, 2, 3]), &chunk(b"IEND", &[])]);
        assert_eq!(png_with_icc(png.clone(), b"profile"), png);
    }

    /// `sRGB` and `iCCP` must not coexist, wherever the encoder put the first one.
    #[test]
    fn srgb_chunk_blocks_the_profile() {
        let png = png_of(&[&ihdr(), &chunk(b"sRGB", &[0]), &chunk(b"IEND", &[])]);
        assert_eq!(png_with_icc(png.clone(), b"profile"), png);
    }

    /// A palette ends the search: colour chunks may not follow it, so anything
    /// later is not looked at.
    #[test]
    fn colour_chunk_after_the_palette_is_not_searched_for() {
        let png = png_of(&[
            &ihdr(),
            &chunk(b"PLTE", &[0, 0, 0]),
            &chunk(b"sRGB", &[0]),
            &chunk(b"IEND", &[]),
        ]);
        let out = png_with_icc(png.clone(), b"profile");
        let (_, end) = read_iccp(&out, AFTER_IHDR);
        assert_eq!(&out[end..], &png[AFTER_IHDR..]);
    }

    /// Right length, wrong signature: not a PNG.
    #[test]
    fn eight_bytes_that_are_not_the_signature_are_left_alone() {
        let mut png = png_of(&[&ihdr()]);
        png[1] = b'X';
        assert_eq!(png_with_icc(png.clone(), b"profile"), png);
    }
}
