import asyncio
import logging
import uuid
import random
import datetime
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command, CommandObject
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.types import (
    LabeledPrice, PreCheckoutQuery, SuccessfulPayment, 
    InlineQueryResultArticle, InputTextMessageContent
)
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage

# --- КОНФИГУРАЦИЯ ---
TOKEN = "8271218748:AAHeJIQMXcN66Y0XglVcUByyIV0w9fPyS5c"
ADMIN_ID = 7968792398

bot = Bot(token=TOKEN)
dp = Dispatcher(storage=MemoryStorage())

# Базы данных в памяти
bot_settings = {"winning_enabled": True}
checks_db = {} 
temp_texts = {}
users_db = {}       
active_chats = {}   

# Состояния
class CheckCreation(StatesGroup):
    choosing_gift = State()
    writing_text = State()

class GameStates(StatesGroup):
    entering_bet = State()
    picking_number = State()

GIFTS = {
    "tree": {"name": "Ёлка", "price": 51, "id": "5922558454332916696", "media": "https://t.me/roxmangetgift/22"},
    "bear_ny": {"name": "Медведь (НГ)", "price": 51, "id": "5956217000635139069", "media": "https://t.me/roxmangetgift/23"},
    "bear_14": {"name": "Медведь (14 фев)", "price": 51, "id": "5800655655995968830", "media": "https://t.me/roxmangetgift/24"},
    "heart_14": {"name": "Сердце (14 фев)", "price": 51, "id": "5801108895304779062", "media": "https://t.me/roxmangetgift/25"},
    "champ": {"name": "Шампанское", "price": 51, "id": "6028601630662853006", "media": "https://t.me/roxmangetgift/26"},
    "gift": {"name": "Подарок", "price": 26, "id": "5170250947678437525", "media": "https://t.me/roxmangetgift/27"},
    "heart": {"name": "Сердце", "price": 16, "id": "5170145012310081615", "media": "https://t.me/roxmangetgift/28"},
    "rose": {"name": "Роза", "price": 26, "id": "5168103777563050263", "media": "https://t.me/roxmangetgift/29"},
    "bear": {"name": "Медведь", "price": 16, "id": "5170233102089322756", "media": "https://t.me/roxmangetgift/30"},
    "cup": {"name": "Кубок", "price": 101, "id": "5168043875654172773", "media": "https://t.me/roxmangetgift/31"},
    "rocket": {"name": "Ракета", "price": 51, "id": "5170564780938756245", "media": "https://t.me/roxmangetgift/32"},
    "bouquet": {"name": "Букет", "price": 51, "id": "5170314324215857265", "media": "https://t.me/roxmangetgift/33"},
    "cake": {"name": "Торт", "price": 51, "id": "5170144170496491616", "media": "https://t.me/roxmangetgift/34"},
    "ring": {"name": "Кольцо", "price": 101, "id": "5170690322832818290", "media": "https://t.me/roxmangetgift/35"},
    "diamond": {"name": "Алмаз", "price": 101, "id": "5170521118301225164", "media": "https://t.me/roxmangetgift/36"},
}

# --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
async def create_check_link(user_id, gift_key, text):
    check_id = f"chk_{uuid.uuid4().hex[:10]}"
    checks_db[check_id] = {"gift_key": gift_key, "text": text, "creator_id": user_id}
    builder = InlineKeyboardBuilder()
    builder.button(text="🔗 Отправить другу", switch_inline_query=check_id)
    return f"✅ Чек на <b>{GIFTS[gift_key]['name']}</b> готов!", builder.as_markup()

# --- ОБРАБОТЧИК /l (ЧАТ И РАССЫЛКА) ---
@dp.message(Command("l"))
async def handle_l_command(message: types.Message):
    if message.from_user.id != ADMIN_ID: return
    parts = message.text.split(maxsplit=2)
    if len(parts) < 2: return
    
    if parts[1].startswith("@") and len(parts) == 3 and parts[2].lower() in ["on", "off"]:
        username = parts[1].replace("@", "").lower()
        target_id = next((uid for uid, info in users_db.items() if info['username'] and info['username'].lower() == username), None)
        if not target_id:
            await message.answer("Юзер не найден в базе."); return
        if parts[2].lower() == "on":
            active_chats[ADMIN_ID] = target_id
            await message.answer(f"Чат с @{username} ВКЛ.")
        else:
            active_chats.pop(ADMIN_ID, None)
            await message.answer(f"Чат с @{username} ВЫКЛ.")
    else:
        # Рассылка
        txt = message.text[3:].strip()
        count = 0
        blocked = 0
        for uid in users_db.keys():
            try: 
                await bot.send_message(uid, txt)
                count += 1
            except: 
                blocked += 1
        await message.answer(f"Сколько людей отправленно: {count}\nСколько заблокировали бота: {blocked}")

# --- ИНЛАЙН РЕЖИМ (СТИКЕРЫ В ЧАТЕ) ---
@dp.inline_query()
async def inline_handler(query: types.InlineQuery):
    check_id = query.query.strip()
    if check_id in checks_db:
        c = checks_db[check_id]
        g = GIFTS[c['gift_key']]
        kb = InlineKeyboardBuilder()
        kb.button(text="🎁 Забрать подарок", url=f"https://t.me/{(await bot.get_me()).username}?start={check_id}")
        text = f"<a href='{g['media']}'>&#8203;</a>✨ Вам подарок: <b>{g['name']}</b>!"
        if c['text']: text += f"\n\n💬 <i>«{c['text']}»</i>"
        result = InlineQueryResultArticle(
            id=check_id, title=f"Подарок: {g['name']}",
            input_message_content=InputTextMessageContent(message_text=text, parse_mode="HTML"),
            reply_markup=kb.as_markup()
        )
        await query.answer([result], is_personal=True, cache_time=1)

# --- ГЛАВНОЕ МЕНЮ И СТАРТ ---
@dp.message(Command("start"))
async def cmd_start(message: types.Message, command: CommandObject, state: FSMContext):
    users_db[message.from_user.id] = {"username": message.from_user.username, "name": message.from_user.full_name}
    if command.args and command.args.startswith("chk"):
        cid = command.args
        if cid in checks_db:
            c = checks_db[cid]
            try:
                await bot.send_gift(user_id=message.from_user.id, gift_id=GIFTS[c['gift_key']]['id'], text=c['text'] or None)
                await message.answer(f"🎁 Вы получили подарок: {GIFTS[c['gift_key']]['name']}!")
                del checks_db[cid]
            except: await message.answer("❌ Ошибка отправки (нет звезд у бота).")
        return
    await state.clear()
    builder = InlineKeyboardBuilder()
    builder.button(text="🎁 Подарки", callback_data="menu_gifts")
    builder.button(text="🎫 Создать чек", callback_data="create_check")
    builder.button(text="🎮 Игры", callback_data="menu_games")
    if message.from_user.id == ADMIN_ID:
        builder.button(text="🛠 Админ панель", callback_data="admin_panel")
    builder.adjust(1)
    await message.answer("<b>Главное меню:</b>", reply_markup=builder.as_markup(), parse_mode="HTML")

# --- ПОДАРКИ СЕБЕ ---
@dp.callback_query(F.data == "menu_gifts")
async def menu_self(callback: types.CallbackQuery):
    builder = InlineKeyboardBuilder()
    # СОРТИРОВКА ПО ЦЕНЕ
    for k, v in sorted(GIFTS.items(), key=lambda x: x[1]['price']):
        builder.button(text=f"{v['name']} — {v['price']} ⭐", callback_data=f"buy_self:{k}")
    builder.adjust(1).button(text="⬅️ Назад", callback_data="to_main")
    await callback.message.edit_text("Покупка себе:", reply_markup=builder.as_markup())

@dp.callback_query(F.data.startswith("buy_self:"))
async def buy_self_inv(callback: types.CallbackQuery):
    gk = callback.data.split(":")[1]
    await bot.send_invoice(chat_id=callback.from_user.id, title=f"Подарок: {GIFTS[gk]['name']}", description=f"Цена: {GIFTS[gk]['price']} ⭐", payload=f"self:{gk}", currency="XTR", prices=[LabeledPrice(label="Оплата", amount=GIFTS[gk]['price'])], provider_token="")

# --- СОЗДАНИЕ ЧЕКА ---
@dp.callback_query(F.data.in_(["create_check", "admin_free_check"]))
async def start_check(callback: types.CallbackQuery, state: FSMContext):
    await state.update_data(is_free=(callback.data == "admin_free_check"))
    builder = InlineKeyboardBuilder()
    # СОРТИРУЕМ ПО ЦЕНЕ ОТ МЕНЬШЕЙ К БОЛЬШЕЙ
    sorted_gifts = sorted(GIFTS.items(), key=lambda x: x[1]['price'])
    for k, v in sorted_gifts: 
        builder.button(text=f"{v['name']} ({v['price']} ⭐)", callback_data=f"chk_gift:{k}")
    builder.adjust(1)
    await state.set_state(CheckCreation.choosing_gift)
    await callback.message.edit_text("Выберите подарок для чека:", reply_markup=builder.as_markup())

@dp.callback_query(CheckCreation.choosing_gift, F.data.startswith("chk_gift:"))
async def chk_gift_chosen(callback: types.CallbackQuery, state: FSMContext):
    await state.update_data(gift_key=callback.data.split(":")[1])
    await state.set_state(CheckCreation.writing_text)
    builder = InlineKeyboardBuilder().button(text="Пропустить ➡️", callback_data="skip_text")
    await callback.message.edit_text("Введите текст поздравления:", reply_markup=builder.as_markup())

@dp.callback_query(CheckCreation.writing_text, F.data == "skip_text")
async def chk_text_skipped(callback: types.CallbackQuery, state: FSMContext):
    data = await state.get_data()
    gk = data['gift_key']
    if data.get('is_free'):
        msg, kb = await create_check_link(callback.from_user.id, gk, "")
        await callback.message.answer(msg, reply_markup=kb, parse_mode="HTML")
    else:
        temp_texts[callback.from_user.id] = ""
        now = datetime.datetime.now().strftime("%d.%m.%Y %H:%M")
        invoice_desc = f"Чек\nПодарок: {GIFTS[gk]['name']}\nЦена: {GIFTS[gk]['price']} ⭐\nДата: {now}\nОписание: -"
        await bot.send_invoice(
            chat_id=callback.from_user.id, 
            title="Чек", 
            description=invoice_desc, 
            payload=f"check:{gk}", 
            currency="XTR", 
            prices=[LabeledPrice(label="Оплатить", amount=GIFTS[gk]['price'])], 
            provider_token=""
        )
    await state.clear()

# --- ИГРЫ ---
@dp.callback_query(F.data == "menu_games")
async def menu_games(callback: types.CallbackQuery):
    builder = InlineKeyboardBuilder().button(text="🔢 Отгадай число", callback_data="game_info").button(text="⬅️ Назад", callback_data="to_main").adjust(1)
    await callback.message.edit_text("Игры:", reply_markup=builder.as_markup())

@dp.callback_query(F.data == "game_info")
async def game_info(callback: types.CallbackQuery):
    await callback.message.edit_text("🎲 Шанс 33%. Ставки 5-10 или 15-20 ⭐.", reply_markup=InlineKeyboardBuilder().button(text="Продолжить", callback_data="game_start").as_markup())

@dp.callback_query(F.data == "game_start")
async def game_bet_in(callback: types.CallbackQuery, state: FSMContext):
    await state.set_state(GameStates.entering_bet)
    await callback.message.answer("Введите ставку:")

# --- ПЛАТЕЖИ ---
@dp.pre_checkout_query()
async def pre_checkout(q: PreCheckoutQuery): await q.answer(ok=True)

@dp.message(F.successful_payment)
async def on_pay(message: types.Message, state: FSMContext):
    p = message.successful_payment.invoice_payload
    uid = message.from_user.id
    if p.startswith("check:"):
        gk = p.split(":")[1]
        msg, kb = await create_check_link(uid, gk, temp_texts.get(uid, ""))
        await message.answer(msg, reply_markup=kb, parse_mode="HTML")
    elif p.startswith("game:"):
        amt = int(p.split(":")[1])
        await state.update_data(paid_bet=amt); await state.set_state(GameStates.picking_number)
        kb = InlineKeyboardBuilder(); [kb.button(text=str(i), callback_data=f"guess:{i}") for i in range(1,4)]; kb.adjust(3)
        await message.answer("Выбери число (1-3):", reply_markup=kb.as_markup())
    elif p.startswith("self:"):
        await bot.send_gift(user_id=uid, gift_id=GIFTS[p.split(":")[1]]['id'])
        await message.answer("✅ Отправлено!")

@dp.callback_query(GameStates.picking_number, F.data.startswith("guess:"))
async def game_res(callback: types.CallbackQuery, state: FSMContext):
    choice = int(callback.data.split(":")[1]); data = await state.get_data(); bet = data.get("paid_bet", 5)
    if not bot_settings["winning_enabled"]:
        w = [1,2,3]; w.remove(choice); win_num = random.choice(w); is_win = False
    else: win_num = random.randint(1,3); is_win = (choice == win_num)
    if is_win:
        prz = random.choice(["bear","heart","gift","rose"] if bet <= 10 else ["tree","bear_ny","bear_14","heart_14"])
        try:
            await bot.send_gift(user_id=callback.from_user.id, gift_id=GIFTS[prz]['id'])
            await callback.message.edit_text(f"🎉 Выиграл! Выпало {win_num}.")
        except: await callback.message.edit_text("🎉 Угадал, но у бота нет звезд.")
    else: await callback.message.edit_text(f"❌ Проиграл! Выпало {win_num}.")
    await state.clear()

# --- ОБРАБОТКА ТЕКСТА (FSM + АДМИН ЧАТ) ---
@dp.message(F.text)
async def text_handler(message: types.Message, state: FSMContext):
    curr_state = await state.get_state()
    # 1. Если вводят текст для чека
    if curr_state == CheckCreation.writing_text:
        data = await state.get_data()
        gk = data['gift_key']
        if data.get('is_free'):
            msg, kb = await create_check_link(message.from_user.id, gk, message.text)
            await message.answer(msg, reply_markup=kb, parse_mode="HTML")
        else:
            temp_texts[message.from_user.id] = message.text
            now = datetime.datetime.now().strftime("%d.%m.%Y %H:%M")
            invoice_desc = f"Чек\nПодарок: {GIFTS[gk]['name']}\nЦена: {GIFTS[gk]['price']} ⭐\nДата: {now}\nОписание: {message.text}"
            await bot.send_invoice(
                chat_id=message.from_user.id, 
                title="Чек", 
                description=invoice_desc, 
                payload=f"check:{gk}", 
                currency="XTR", 
                prices=[LabeledPrice(label="Оплатить", amount=GIFTS[gk]['price'])], 
                provider_token=""
            )
        await state.clear(); return

    # 2. Если вводят ставку для игры
    if curr_state == GameStates.entering_bet:
        if message.text.isdigit():
            amt = int(message.text)
            await bot.send_invoice(chat_id=message.from_user.id, title="Игра", description="Ставка", payload=f"game:{amt}", currency="XTR", prices=[LabeledPrice(label="Оплата", amount=amt)], provider_token="")
            await state.clear(); return

    # 3. Админ-чат
    if message.from_user.id == ADMIN_ID and ADMIN_ID in active_chats:
        try: await bot.send_message(active_chats[ADMIN_ID], f"💬 Админ: {message.text}")
        except: pass
        return
    for aid, tid in active_chats.items():
        if message.from_user.id == tid:
            await bot.send_message(aid, f"👤 @{message.from_user.username}: {message.text}"); return

# --- АДМИНКА ---
@dp.callback_query(F.data == "admin_panel")
async def admin_panel(c: types.CallbackQuery):
    if c.from_user.id != ADMIN_ID: return
    status = "✅ ВКЛ" if bot_settings["winning_enabled"] else "❌ ВЫКЛ"
    kb = InlineKeyboardBuilder().button(text=f"Выигрыши: {status}", callback_data="toggle_w").button(text="🧪 Тест Подарок", callback_data="t_p").button(text="🧪 Тест Чек", callback_data="admin_free_check").button(text="👥 Юзеры", callback_data="u_l").button(text="⬅️ Назад", callback_data="to_main").adjust(1)
    await c.message.edit_text(f"Админка. Выигрыши: {status}", reply_markup=kb.as_markup())

@dp.callback_query(F.data == "toggle_w")
async def tw(c: types.CallbackQuery): bot_settings["winning_enabled"] = not bot_settings["winning_enabled"]; await admin_panel(c)

@dp.callback_query(F.data == "t_p")
async def tp(c: types.CallbackQuery):
    try: await bot.send_gift(user_id=c.from_user.id, gift_id=GIFTS["bear"]["id"]); await c.answer("Ок")
    except: await c.answer("Нет звезд", show_alert=True)

@dp.callback_query(F.data == "u_l")
async def ul(c: types.CallbackQuery):
    txt = "\n".join([f"• @{i['username']} ({k})" for k,i in users_db.items()])
    await c.message.answer(txt or "Пусто"); await c.answer()

@dp.callback_query(F.data == "to_main")
async def back(c: types.CallbackQuery, state: FSMContext): await state.clear(); await cmd_start(c.message, CommandObject(command="start"), state)

async def main():
    logging.basicConfig(level=logging.INFO)
    await dp.start_polling(bot)

if __name__ == "__main__": asyncio.run(main())
