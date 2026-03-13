import asyncio
import random
from aiogram import Bot, Dispatcher, Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
from aiogram.filters import CommandStart
from aportalsmp.gifts import collections, giftsFloors
from aportalsmp.auth import update_auth

BOT_TOKEN = "8791052397:AAFYHdOk3VVuz2v_gaeAUS1up9gn6yNoUso"
API_ID = 36802263
API_HASH = "e5c4411432be9fb6bbb1b59b4cad53d4"

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()
router = Router()
auth_data = None


async def init_auth():
    global auth_data
    if not auth_data:
        auth_data = await update_auth(api_id=API_ID, api_hash=API_HASH)
    return auth_data


async def get_random_gift():
    auth = await init_auth()
    all_cols = await collections(authData=auth, limit=100)
    floors = await giftsFloors(authData=auth)
    floors_dict = floors.toDict()
    short_names = list(floors_dict.keys())
    random_short = random.choice(short_names)
    try:
        gift = all_cols.gift(random_short)
    except Exception:
        from aportalsmp.utils.functions import toShortName
        for name in short_names:
            try:
                gift = all_cols.gift(name)
                break
            except Exception:
                continue
    return gift


def kb_gift():
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="🎁 Подарок", callback_data="rg")]])


def kb_more():
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="🔄 Ещё", callback_data="rg")]])


@router.message(CommandStart())
async def cmd_start(message: Message):
    await message.answer("Привет! Жми кнопку!", reply_markup=kb_gift())


@router.callback_query(F.data == "rg")
async def on_gift(callback: CallbackQuery):
    await callback.answer("Ищу...")
    try:
        g = await get_random_gift()
        cap = f"🎁 <b>{g.name}</b>\n💰 Floor: <b>{g.floor_price}</b>\n📦 Supply: {g.supply}\n📊 Day vol: {g.day_volume}"
        try:
            await callback.message.answer_photo(photo=g.photo_url, caption=cap, parse_mode="HTML", reply_markup=kb_more())
        except Exception:
            cap += f"\n🖼 {g.photo_url}"
            await callback.message.answer(cap, parse_mode="HTML", reply_markup=kb_more())
    except Exception as e:
        await callback.message.answer(f"Ошибка: {e}", reply_markup=kb_gift())


dp.include_router(router)


async def main():
    print("Bot started!")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
