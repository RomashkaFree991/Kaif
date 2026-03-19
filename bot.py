#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Получает только Portals authData через update_auth(api_id, api_hash),
сохраняет в portals_auth.txt и печатает в stdout.

Зависимости:
    pip install portalsmp tgcrypto

Поведение:
- не делает торговых/поисковых запросов
- не крутится в фоне
- не обновляет authData слишком часто без необходимости
- при наличии свежего portals_auth.txt просто выводит его и выходит
"""

import asyncio
import sys
import time
from pathlib import Path

from portalsmp import update_auth

API_ID = 37264441
API_HASH = "ca91409a39ebea42a30ee556f9864165"

AUTH_FILE = Path("portals_auth.txt")
META_FILE = Path(".portals_auth_meta")
MIN_REFRESH_SECONDS = 15 * 60  # не переавторизовываться чаще, чем раз в 15 минут


def read_existing_auth():
    if AUTH_FILE.exists():
        token = AUTH_FILE.read_text(encoding="utf-8").strip()
        if token.startswith("tma "):
            return token
    return None


def read_last_refresh():
    try:
        return int(META_FILE.read_text(encoding="utf-8").strip())
    except Exception:
        return 0


def write_meta(ts: int):
    META_FILE.write_text(str(ts), encoding="utf-8")


async def get_auth():
    return await update_auth(API_ID, API_HASH)


def main():
    now = int(time.time())
    existing = read_existing_auth()
    last_refresh = read_last_refresh()

    # Если authData уже есть и он получен недавно — просто используем его,
    # чтобы не дёргать повторную авторизацию без нужды.
    if existing and (now - last_refresh) < MIN_REFRESH_SECONDS:
        print(existing)
        return

    try:
        token = asyncio.run(get_auth())
    except KeyboardInterrupt:
        print("Остановлено пользователем.", file=sys.stderr)
        sys.exit(130)
    except Exception as e:
        print(
            "Не удалось получить authData.\n"
            "Обычно нужен код входа Telegram, а если включена 2FA — ещё и пароль.\n"
            f"Ошибка: {e}",
            file=sys.stderr,
        )
        sys.exit(1)

    token = (token or "").strip()
    if not token.startswith("tma "):
        print("Получена строка, но она не похожа на authData формата 'tma ...'", file=sys.stderr)
        sys.exit(2)

    AUTH_FILE.write_text(token, encoding="utf-8")
    write_meta(now)

    # Печатаем только authData
    print(token)


if __name__ == "__main__":
    main()
