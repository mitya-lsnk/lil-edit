#!/bin/zsh
# Локальная сборка lil edit для этого Мака и установка в /Applications.
#
#   build-mac.sh        собрать .app и поставить в /Applications
#   build-mac.sh dmg    то же и ещё установщик .dmg в ~/Downloads
#
# Подпись — ad hoc, как записано в tauri.conf.json; сценарий её не трогает.
# Сборка для GitHub идёт своим путём (.github/workflows/build.yml) и сюда не
# заглядывает.
set -e
cd "${0:A:h}"

WHAT="${1:-app}"
case "$WHAT" in
  app|dmg) ;;
  *) echo "использование: build-mac.sh [app|dmg]"; exit 2 ;;
esac

APP="lil edit"
# Куда складывается сборка, задано в src-tauri/.cargo/config.toml: папку, чьё имя
# кончается на .noindex, Spotlight не обходит. Без этого каждая сборка оставляла
# в поиске ещё одну «lil edit.app» рядом с настоящей.
TARGET="$PWD/src-tauri/target.noindex"
BUILT="$TARGET/release/bundle/macos/$APP.app"
LSR=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister

# Том, оставшийся примонтированным от прошлой сборки, и в поиске светится, и
# ломает сборку нового .dmg («resource busy»). Отцепляем только своё: то, что
# смонтировано с образа внутри нашей папки сборки.
detach_ours() {
  hdiutil info -plist | python3 -I -c '
import plistlib, sys
root = sys.argv[1]
d = plistlib.loads(sys.stdin.buffer.read())
for img in d.get("images", []):
    if not str(img.get("image-path", "")).startswith(root):
        continue
    for ent in img.get("system-entities", []):
        mp = ent.get("mount-point")
        if mp:
            print(mp)
' "$TARGET" | while read -r mp; do
    echo "Отцепляю том от прошлой сборки: $mp"
    $LSR -u "$mp/$APP.app" 2>/dev/null || true
    hdiutil detach -force "$mp" >/dev/null 2>&1 || true
  done
}

detach_ours

if [[ "$WHAT" == dmg ]]; then
  npm run tauri build -- --bundles app,dmg
else
  npm run tauri build -- --bundles app
fi

# Копия в папке сборки не должна попадать ни в поиск, ни в «Открыть с помощью»:
# у lil edit прописаны типы файлов, и призрак из сборки перехватывал бы их.
$LSR -u "$BUILT" 2>/dev/null || true

if [[ "$WHAT" == dmg ]]; then
  # Образ монтирует сам упаковщик Tauri (bundle_dmg.sh), своими флагами — мы
  # туда не дотянемся. Поэтому убираем за ним: снимаем регистрацию копии на
  # томе и отцепляем том.
  $LSR -u "/Volumes/$APP/$APP.app" 2>/dev/null || true
  detach_ours
  DMG=$(ls -t "$TARGET/release/bundle/dmg/"*.dmg 2>/dev/null | head -1)
  if [[ -z "$DMG" ]]; then
    echo "Упаковщик не оставил .dmg — смотреть вывод сборки выше"; exit 1
  fi
  mkdir -p "$HOME/Downloads"
  ditto "$DMG" "$HOME/Downloads/${DMG:t}"
  echo "Установщик: $HOME/Downloads/${DMG:t}"
fi

ditto "$BUILT" "/Applications/$APP.app.new"
# Старая версия уходит в target.noindex/old, а НЕ в корзину: Pearcleaner,
# увидев .app в корзине, выносит следом настройки и данные приложения — так
# пропали данные у lil art и lil develop. Храним одну предыдущую, чтобы было
# куда вернуться, если новая не заведётся. Перед переносом снимаем регистрацию,
# иначе в поиске останется призрак.
if [[ -e "/Applications/$APP.app" ]]; then
  $LSR -u "/Applications/$APP.app" 2>/dev/null || true
  rm -rf "$TARGET/old"
  mkdir -p "$TARGET/old"
  mv "/Applications/$APP.app" "$TARGET/old/$APP.app"
fi
mv "/Applications/$APP.app.new" "/Applications/$APP.app"
$LSR -f "/Applications/$APP.app"
echo "Установлено: /Applications/$APP.app"
