from fastapi import WebSocket, APIRouter, Query
from services.ws_manager import ws_manager

router = APIRouter()

@router.websocket("/ws")
async def ws_endpoint(ws: WebSocket, token: str = Query(None)):
    """
    ЗАЩИЩЕННЫЙ КАНАЛ: Без токена соединение сбрасывается.
    """
    if not token:
        await ws.close(code=4001)
        return
        
    await ws.accept()
    await ws_manager.connect(ws)
    try:
        while True:
            # Слушаем сообщения (если нужно)
            data = await ws.receive_text()
    except Exception:
        pass
    finally:
        ws_manager.disconnect(ws)