from fastapi import APIRouter, Request
from ..core.config import settings
import httpx

router = APIRouter(prefix="/telegram", tags=["Telegram"])

# =========================================================
# 📤 შეტყობინების გაგზავნა
# =========================================================
async def send_telegram_message(text: str, chat_id: str = None):
    """ტელეგრამში შეტყობინების გაგზავნა"""
    token = settings.TELEGRAM_TOKEN
    if not chat_id:
        chat_id = settings.TELEGRAM_CHAT_ID

    if not token or not chat_id:
        return

    async with httpx.AsyncClient() as client:
        await client.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "HTML"
            }
        )

# =========================================================
# 🤖 WEBHOOK — ტელეგრამიდან შემოსული მოთხოვნები
# =========================================================
@router.post("/webhook")
async def telegram_webhook(request: Request):
    """Cloudflare Worker-იდან შემოსული webhook"""
    data = await request.json()
    message = data.get("message") or data.get("edited_message")

    if not message:
        return {"ok": True}

    chat_id = str(message["chat"]["id"])
    text = message.get("text", "").strip()

    # წვდომის შემოწმება
    allowed = settings.ALLOWED_CHAT_IDS.split(",")
    if chat_id not in [a.strip() for a in allowed]:
        await send_telegram_message("🚫 Access denied.", chat_id)
        return {"ok": True}

    await handle_command(text, chat_id)
    return {"ok": True}

# =========================================================
# 🎯 COMMAND HANDLER
# =========================================================
async def handle_command(text: str, chat_id: str):
    """ბოტის command-ების დამუშავება"""
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy import select
    from ..core.database import AsyncSessionLocal
    from ..models.item import Item
    from ..models.history import History

    parts = text.split(" ")
    command = parts[0].lower().split("@")[0]
    args = " ".join(parts[1:]).lower().strip()

    async with AsyncSessionLocal() as db:
        if command in ["/start", "/help"]:
            reply = (
                "🤖 <b>IT Inventory Bot</b>\n\n"
                "Available commands:\n\n"
                "🔍 /stock [keyword] — search item\n"
                "⚠️ /low — low stock items\n"
                "📜 /history — last 10 operations\n"
                "📊 /summary — overview\n"
                "📍 /location [name] — items at location\n"
                "👤 /user [name] — user operations\n"
                "📅 /today — today's operations\n"
                "📋 /track [keyword] — item history"
            )

        elif command == "/stock":
            if not args:
                reply = "❌ Example: /stock cable"
            else:
                result = await db.execute(select(Item))
                items = result.scalars().all()
                found = [i for i in items if args in i.name.lower() or args in i.item_id.lower()]

                if not found:
                    reply = f"🔍 No items found for: <b>{args}</b>"
                else:
                    reply = f"🔍 Results for: <b>{args}</b>\n\n"
                    for i in found[:20]:
                        emoji = "🔴" if i.quantity <= 1 else "🟡" if i.quantity <= 3 else "🟢"
                        reply += f"{emoji} <b>{i.name}</b> [{i.item_id}]\n"
                        reply += f"   📍 {i.location} — Qty: <b>{i.quantity}</b>\n\n"

        elif command == "/low":
            result = await db.execute(select(Item))
            items = result.scalars().all()
            low_it = [i for i in items if i.category == "Consumables" and i.location == "IT Warehouse" and i.quantity <= 3]
            low_floor = [i for i in items if i.category == "Consumables" and i.location == "Floor's Cabinet" and i.quantity <= 1]

            if not low_it and not low_floor:
                reply = "✅ All stock levels are OK!"
            else:
                reply = "⚠️ <b>Low Stock Alert</b>\n\n"
                if low_it:
                    reply += "🏭 <b>IT Warehouse (≤3):</b>\n"
                    for i in low_it:
                        reply += f"  🔴 {i.name} — <b>{i.quantity}</b> left\n"
                    reply += "\n"
                if low_floor:
                    reply += "🏢 <b>Floor's Cabinet (≤1):</b>\n"
                    for i in low_floor:
                        reply += f"  🔴 {i.name} — <b>{i.quantity}</b> left\n"

        elif command == "/history":
            result = await db.execute(
                select(History).order_by(History.created_at.desc()).limit(10)
            )
            records = result.scalars().all()
            reply = "📜 <b>Last 10 Operations</b>\n\n"
            for r in records:
                reply += f"<b>{r.action}</b> — {r.created_at.strftime('%b %d, %H:%M')}\n"
                reply += f"  📦 {r.item_name} [{r.item_id}]\n"
                reply += f"  👤 {r.responsible}\n\n"

        elif command == "/summary":
            result = await db.execute(select(Item))
            items = result.scalars().all()
            total_qty = sum(i.quantity for i in items)
            low = [i for i in items if i.category == "Consumables" and i.quantity <= 3]
            reply = (
                f"📊 <b>Inventory Summary</b>\n\n"
                f"📋 Unique items: <b>{len(items)}</b>\n"
                f"📦 Total quantity: <b>{total_qty}</b>\n"
                f"⚠️ Low stock: <b>{len(low)}</b>"
            )

        elif command == "/location":
            if not args:
                reply = "❌ Example: /location IT Warehouse"
            else:
                result = await db.execute(select(Item))
                items = result.scalars().all()
                found = [i for i in items if args in i.location.lower()]
                if not found:
                    reply = f"🔍 No items at: <b>{args}</b>"
                else:
                    total = sum(i.quantity for i in found)
                    reply = f"📍 <b>{args}</b> — {len(found)} items, Total: <b>{total}</b>\n\n"
                    for i in found[:30]:
                        emoji = "🔴" if i.quantity <= 1 else "🟡" if i.quantity <= 3 else "🟢"
                        reply += f"{emoji} <b>{i.name}</b> [{i.item_id}] — <b>{i.quantity}</b>\n"
                    if len(found) > 30:
                        reply += f"\n... and {len(found) - 30} more"

        elif command == "/user":
            if not args:
                reply = "❌ Example: /user giorgi"
            else:
                result = await db.execute(
                    select(History).order_by(History.created_at.desc())
                )
                records = result.scalars().all()
                found = [r for r in records if args in (r.responsible or "").lower()][:20]
                if not found:
                    reply = f"🔍 No operations by: <b>{args}</b>"
                else:
                    reply = f"👤 <b>{args}</b> — {len(found)} operations\n\n"
                    for r in found:
                        emoji = {"ADD": "➕", "TRANSFER": "🔄", "ISSUE": "📤", "WRITE-OFF": "🗑️", "RESTOCK": "📥", "DELETE": "❌"}.get(r.action, "📋")
                        reply += f"{emoji} <b>{r.action}</b> — {r.created_at.strftime('%b %d, %H:%M')}\n"
                        reply += f"  📦 {r.item_name} [{r.item_id}]\n\n"

        elif command == "/today":
            from datetime import datetime, timezone
            today = datetime.now(timezone.utc).date()
            result = await db.execute(
                select(History).order_by(History.created_at.desc())
            )
            records = result.scalars().all()
            found = [r for r in records if r.created_at.date() == today][:20]
            if not found:
                reply = "📭 No operations today yet."
            else:
                reply = f"📅 <b>Today's Operations</b> ({len(found)} total)\n\n"
                for r in found:
                    emoji = {"ADD": "➕", "TRANSFER": "🔄", "ISSUE": "📤", "WRITE-OFF": "🗑️", "RESTOCK": "📥", "DELETE": "❌"}.get(r.action, "📋")
                    reply += f"{emoji} <b>{r.action}</b> — {r.created_at.strftime('%H:%M')}\n"
                    reply += f"  📦 {r.item_name} | 👤 {r.responsible}\n\n"

        elif command == "/track":
            if not args:
                reply = "❌ Example: /track cable"
            else:
                result = await db.execute(
                    select(History).order_by(History.created_at.desc())
                )
                records = result.scalars().all()
                found = [r for r in records if args in r.item_name.lower() or args in r.item_id.lower()][:20]
                if not found:
                    reply = f"🔍 No history for: <b>{args}</b>"
                else:
                    reply = f"📋 <b>History: {args}</b> ({len(found)} records)\n\n"
                    for r in found:
                        emoji = {"ADD": "➕", "TRANSFER": "🔄", "ISSUE": "📤", "WRITE-OFF": "🗑️", "RESTOCK": "📥", "DELETE": "❌"}.get(r.action, "📋")
                        reply += f"{emoji} <b>{r.action}</b> — {r.created_at.strftime('%b %d, %H:%M')}\n"
                        reply += f"  📦 {r.item_name} [{r.item_id}]\n"
                        reply += f"  📍 {r.from_location} ➔ {r.to_location} | 👤 {r.responsible}\n\n"

        else:
            reply = f"❓ Unknown command. Type /help"

    await send_telegram_message(reply, chat_id)