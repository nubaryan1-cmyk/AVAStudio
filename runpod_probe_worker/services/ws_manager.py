import asyncio

class WSManager:
    def __init__(self):
        self.connections = set()

    async def connect(self, ws):
        await ws.accept()
        self.connections.add(ws)

    def disconnect(self, ws):
        self.connections.discard(ws)

    async def broadcast(self, payload: dict):
        dead = set()
        for ws in self.connections:
            try:
                await ws.send_json(payload)
            except:
                dead.add(ws)
        self.connections -= dead

ws_manager = WSManager()
