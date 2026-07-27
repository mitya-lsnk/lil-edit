// Helpers for commands that move image bytes across the IPC boundary.
//
// A `Vec<u8>` command argument (or return) is serialized as a JSON array of
// numbers: a 50 MB PNG becomes fifty million boxed JS numbers plus the JSON text
// for them, in both directions. Taking the bytes as a raw `InvokeBody::Raw` and
// answering with `ipc::Response` keeps them as an ArrayBuffer the whole way.
//
// The trade-off is that everything *else* has to travel in headers, which are
// ASCII-only — hence `header_decoded` for values that can hold arbitrary text
// (file paths: Cyrillic, emoji, anything the user's filesystem allows).

use tauri::ipc::{InvokeBody, Request};

/// The raw ArrayBuffer the frontend passed as the invoke payload.
pub fn raw_body(request: &Request<'_>) -> Result<Vec<u8>, String> {
    match request.body() {
        InvokeBody::Raw(bytes) => Ok(bytes.clone()),
        InvokeBody::Json(_) => Err("ожидались сырые байты, пришёл JSON".into()),
    }
}

/// A plain ASCII header value.
pub fn header(request: &Request<'_>, name: &str) -> Result<String, String> {
    request
        .headers()
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned)
        .ok_or_else(|| format!("отсутствует заголовок {name}"))
}

/// A header value written by `encodeURIComponent` on the JS side. Percent-decoded
/// as UTF-8 so non-ASCII paths survive the trip.
pub fn header_decoded(request: &Request<'_>, name: &str) -> Result<String, String> {
    percent_decode(&header(request, name)?)
}

fn percent_decode(s: &str) -> Result<String, String> {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' {
            let hex = b
                .get(i + 1..i + 3)
                .ok_or_else(|| "обрезанная %-последовательность".to_string())?;
            let hex = std::str::from_utf8(hex).map_err(|e| e.to_string())?;
            out.push(u8::from_str_radix(hex, 16).map_err(|e| e.to_string())?);
            i += 3;
        } else {
            out.push(b[i]);
            i += 1;
        }
    }
    String::from_utf8(out).map_err(|e| format!("некорректный UTF-8: {e}"))
}

#[cfg(test)]
mod tests {
    use super::percent_decode;

    #[test]
    fn decodes_ascii_unchanged() {
        assert_eq!(percent_decode("/Users/me/pic.png").unwrap(), "/Users/me/pic.png");
    }

    #[test]
    fn decodes_multibyte_utf8() {
        // encodeURIComponent("/Users/маша/фото 1.png")
        let enc = "%2FUsers%2F%D0%BC%D0%B0%D1%88%D0%B0%2F%D1%84%D0%BE%D1%82%D0%BE%201.png";
        assert_eq!(percent_decode(enc).unwrap(), "/Users/маша/фото 1.png");
    }

    #[test]
    fn decodes_emoji_and_windows_paths() {
        // encodeURIComponent("D:\\фото\\🎨.png")
        let enc = "D%3A%5C%D1%84%D0%BE%D1%82%D0%BE%5C%F0%9F%8E%A8.png";
        assert_eq!(percent_decode(enc).unwrap(), "D:\\фото\\🎨.png");
    }

    #[test]
    fn rejects_truncated_escape() {
        assert!(percent_decode("abc%2").is_err());
        assert!(percent_decode("abc%").is_err());
    }

    #[test]
    fn rejects_invalid_utf8() {
        assert!(percent_decode("%FF%FE").is_err());
    }
}
