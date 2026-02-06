import time

class BaseExecutor:
    def __init__(self, payload):
        self.payload = payload

    def run(self):
        raise NotImplementedError
